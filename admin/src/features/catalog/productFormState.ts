import type { ProductRelatedDraft } from "./ProductRelatedSections";
import type { CatalogAttribute, Product } from "./types";

type DraftSpecification = ProductRelatedDraft["specifications"][number];

export function filterableSpecifications(
  specifications: DraftSpecification[],
  attributes: CatalogAttribute[],
): DraftSpecification[] {
  const filterableAttributeIds = new Set(
    attributes
      .filter((attribute) => attribute.is_active && attribute.is_filterable)
      .map((attribute) => attribute.id),
  );

  return specifications.filter((item) =>
    filterableAttributeIds.has(item.attribute_id),
  );
}

export function selectedHighlightSpecifications(
  specifications: DraftSpecification[],
): DraftSpecification[] {
  return specifications
    .filter((item) => item.highlight)
    .sort((a, b) => a.highlight_order - b.highlight_order);
}

export function hydrateProductRelatedDraft(product: Product): ProductRelatedDraft {
  const highlights = new Map(
    (product.highlights ?? []).map((highlight) => [
      highlight.product_attribute_id,
      highlight,
    ] as const),
  );

  return {
    removedSpecificationIds: [],
    removedImageIds: [],
    imageUpdates: [],
    specifications: (product.specifications ?? []).map((specification) => {
      const highlight = highlights.get(specification.id);

      return {
        id: specification.id,
        attribute_id: specification.attribute.id,
        value: specification.value,
        sort_order: specification.sort_order,
        highlight: Boolean(highlight),
        highlight_order: highlight?.sort_order ?? specification.sort_order,
        highlight_active: highlight?.is_active ?? true,
      };
    }),
    media: [],
    inventory: [],
  };
}

export function snapshotProductSpecifications(product: Product): Map<string, string> {
  return new Map<string, string>(
    (product.specifications ?? []).map((specification) => [
      specification.id,
      JSON.stringify({
        attribute_id: specification.attribute.id,
        value: specification.value,
        sort_order: specification.sort_order,
        show_on_top: specification.show_on_top,
      })] as const,
    ),
  );
}

export function snapshotProductHighlights(product: Product): string {
  return JSON.stringify(
    (product.highlights ?? [])
      .map((highlight) => ({
        product_attribute_id: highlight.product_attribute_id,
        sort_order: highlight.sort_order,
        is_active: highlight.is_active,
      }))
      .sort((a, b) =>
        a.product_attribute_id.localeCompare(b.product_attribute_id),
      ),
  );
}
