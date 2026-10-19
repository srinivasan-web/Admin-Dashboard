import type { ProductRelatedDraft } from "./ProductRelatedSections";
import type { ProductImage } from "./types";

export type ProductSaveProgress = {
  productId?: string;
  editToken?: string;
  section?:
    | "product"
    | "specifications"
    | "highlights"
    | "media"
    | "inventory"
    | "reload";
  draft: ProductRelatedDraft;
  specifications: Map<string, string>;
  highlights: string;
  images: ProductImage[];
  requiresReview: boolean;
};

type Api = Pick<
  typeof import("./catalogApi"),
  | "deleteSpecification"
  | "saveSpecification"
  | "saveHighlights"
  | "uploadProductImage"
  | "updateProductImage"
  | "replaceProductImage"
  | "deleteProductImage"
  | "setWarehouseStock"
>;

// Each request commits independently. Keep the acknowledged ID/checkpoints so
// retrying a dependent failure updates this product instead of creating another.
export async function persistProductForm(
  core: Parameters<typeof import("./catalogApi").saveProduct>[0],
  progress: ProductSaveProgress,
  api: Api & Pick<typeof import("./catalogApi"), "saveProduct" | "loadProduct">,
  checkpoint: () => void,
) {
  if (progress.requiresReview)
    throw new Error(
      "Review the saved product before retrying an uncertain request.",
    );
  try {
    progress.section = "product";
    checkpoint();
    const saved = await api.saveProduct(
      {
        ...core,
        ...(progress.productId && progress.editToken
          ? { edit_token: progress.editToken }
          : {}),
      },
      progress.productId,
    );
    progress.productId = saved.data.id;
    progress.editToken = saved.data.edit_token;
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 0;
    if (!progress.productId && (!status || status >= 500 || status === 408)) {
      progress.requiresReview = true;
      checkpoint();
      throw new Error(
        "Creation response interrupted. Return to Products and check the SKU before creating again.",
      );
    }
    throw error;
  }
  checkpoint();
  await persistProductRelations(progress.productId!, progress, api, checkpoint);
  progress.section = "reload";
  checkpoint();
  return api.loadProduct(progress.productId!);
}

export async function persistProductRelations(
  productId: string,
  progress: ProductSaveProgress,
  api: Api,
  checkpoint: () => void,
) {
  if (progress.requiresReview)
    throw new Error(
      "Review saved product data before retrying an uncertain upload or stock operation.",
    );
  const pending = progress.draft;
  progress.section = "specifications";
  checkpoint();
  for (const removedId of [...pending.removedSpecificationIds]) {
    try {
      await api.deleteSpecification(productId, removedId);
    } catch (error) {
      if (!(
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 404
      ))
        throw error;
    }
    pending.removedSpecificationIds = pending.removedSpecificationIds.filter(
      (value) => value !== removedId,
    );
    progress.specifications.delete(removedId);
    checkpoint();
  }
  for (const item of pending.specifications) {
    const payload = {
      attribute_id: item.attribute_id,
      value: item.value,
      sort_order: item.sort_order,
      // Keep the legacy API field in sync as a projection of the single
      // canonical highlight selection, not as a second piece of UI state.
      show_on_top: item.highlight,
    };
    if (
      item.id &&
      progress.specifications.get(item.id) === JSON.stringify(payload)
    )
      continue;
    let saved;
    try {
      saved = await api.saveSpecification(productId, payload, item.id);
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : 0;
      if (!item.id && (!status || status >= 500 || status === 408)) {
        progress.requiresReview = true;
        checkpoint();
        throw new Error(
          "Specification response interrupted. Review the saved product before adding it again.",
        );
      }
      throw error;
    }
    item.id = saved.data.id;
    progress.specifications.set(item.id, JSON.stringify(payload));
    checkpoint();
  }
  progress.section = "highlights";
  checkpoint();
  const highlights = pending.specifications
    .filter((item) => item.highlight)
    .map((item) => ({
      product_attribute_id: item.id,
      sort_order: item.highlight_order,
      is_active: item.highlight_active,
    }))
    .sort((a, b) =>
      a.product_attribute_id!.localeCompare(b.product_attribute_id!),
    );
  if (JSON.stringify(highlights) !== progress.highlights) {
    await api.saveHighlights(productId, highlights);
    progress.highlights = JSON.stringify(highlights);
    checkpoint();
  }
  try {
    progress.section = "media";
    checkpoint();
    for (const id of [...pending.removedImageIds]) {
      const saved = await api.deleteProductImage(productId, id);
      progress.images = saved.data.images ?? progress.images;
      pending.removedImageIds = pending.removedImageIds.filter(
        (item) => item !== id,
      );
      checkpoint();
    }
    for (const item of [...pending.imageUpdates].sort(
      (a, b) => Number(a.is_primary) - Number(b.is_primary),
    )) {
      const saved = await api.updateProductImage(productId, item.id, {
        sort_order: item.sort_order,
        is_primary: item.is_primary,
      });
      progress.images = saved.data.images ?? progress.images;
      pending.imageUpdates = pending.imageUpdates.filter(
        (candidate) => candidate.id !== item.id,
      );
      checkpoint();
    }
    while (pending.media.length) {
      const item = pending.media[0];
      const saved = item.replace_image_id
        ? await api.replaceProductImage(
            productId,
            item.replace_image_id,
            item.file,
          )
        : await api.uploadProductImage(
            productId,
            item.file,
            item.is_primary,
            item.type,
            item.sort_order,
          );
      progress.images = saved.data.images ?? progress.images;
      pending.media = pending.media.slice(1);
      checkpoint();
    }
    progress.section = "inventory";
    checkpoint();
    while (pending.inventory.length) {
      const item = pending.inventory[0];
      await api.setWarehouseStock(
        item.warehouse_id,
        productId,
        item.quantity,
        item.operation,
        item.idempotency_key,
      );
      pending.inventory = pending.inventory.slice(1);
      checkpoint();
    }
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 0;
    if (
      (!status || status >= 500 || status === 408) &&
      !(
        progress.section === "inventory" &&
        pending.inventory[0]?.idempotency_key
      )
    ) {
      progress.requiresReview = true;
      checkpoint();
      throw new Error(
        "An image or stock response was interrupted. Review the saved product before retrying to avoid duplicate changes.",
      );
    }
    throw error;
  }
}
