import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "../../api/client";
import {
  deleteSpecification,
  deleteProductImage,
  loadProduct,
  saveHighlights,
  saveProduct,
  saveSpecification,
  setWarehouseStock,
  uploadProductImage,
  updateProductImage,
  replaceProductImage,
} from "./catalogApi";
import {
  emptyProductRelatedDraft,
  ProductRelatedSections,
  type ProductRelatedDraft,
} from "./ProductRelatedSections";
import {
  persistProductForm,
  type ProductSaveProgress,
} from "./productFormPersistence";
import type {
  CatalogAttribute,
  CatalogMasters,
  Master,
  Product,
  ProductImage,
} from "./types";
import {
  hydrateProductRelatedDraft,
  snapshotProductHighlights,
  snapshotProductSpecifications,
} from "./productFormState";
import { sanitizeDescriptionHtml } from "../../../../shared/productDescription";
import { ProductDescriptionEditor } from "./ProductDescriptionEditor";
import { AttributesWorkspace } from "./AttributesWorkspace";
import { toast } from "../../components/ui/Toast";
import { ArrowDownRight } from "lucide-react";

type Props = {
  mode: "create" | "edit";
  product?: Product;
  masters: CatalogMasters;
  attributes: CatalogAttribute[];
  canManageInventory: boolean;
  attributesLoading?: boolean;
  attributesError?: string;
  onRetryAttributes: () => void;
  warehousesLoading?: boolean;
  warehousesError?: string;
  onRetryWarehouses: () => void;
  onSaved: (product: Product) => void;
  onCancel: () => void;
  onAttributesChanged: () => void;
};

export function ProductForm({
  mode,
  product,
  masters,
  attributes,
  canManageInventory,
  attributesLoading,
  attributesError,
  onRetryAttributes,
  warehousesLoading,
  warehousesError,
  onRetryWarehouses,
  onSaved,
  onCancel,
  onAttributesChanged,
}: Props) {
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saveSection, setSaveSection] =
    useState<ProductSaveProgress["section"]>();
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(product));
  const [ready, setReady] = useState(!product);
  const [reload, setReload] = useState(0);
  const [pendingEntry, setPendingEntry] = useState(false);
  const [requiresReview, setRequiresReview] = useState(false);
  const [showAttributeLibrary, setShowAttributeLibrary] = useState(false);
  const [draft, setDraft] = useState<ProductRelatedDraft>(
    emptyProductRelatedDraft,
  );
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const persistedId = useRef(product?.id);
  const editToken = useRef(product?.edit_token);
  const submitLock = useRef(false);
  const leaveAllowed = useRef(false);
  const savedSpecifications = useRef(new Map<string, string>());
  const savedHighlights = useRef("[]");
  const formId = "product-form";

  useEffect(() => {
    if (!isDirty && !pendingEntry && !submitting) return;
    const protectedUrl = window.location.pathname + window.location.search;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaveAllowed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigation = (event: Event) => {
      if (leaveAllowed.current) return;
      if (
        submitLock.current ||
        !window.confirm(
          "Discard unsaved product changes? Completed saves will be retained.",
        )
      ) {
        event.preventDefault();
        if (
          (event as CustomEvent<{ historyTraversal: boolean }>).detail
            .historyTraversal
        )
          window.history.pushState({}, "", protectedUrl);
        if (submitLock.current)
          setError(
            "Please wait for the current save to finish before leaving.",
          );
      } else leaveAllowed.current = true;
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("durafit:before-navigation", beforeNavigation);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("durafit:before-navigation", beforeNavigation);
    };
  }, [isDirty, pendingEntry, submitting]);

  useEffect(() => {
    if (!product) {
      persistedId.current = undefined;
      setReady(true);
      setLoading(false);
      return;
    }
    persistedId.current = product.id;
    editToken.current = product.edit_token;
    setLoading(true);
    setReady(false);
    setError(undefined);
    savedSpecifications.current = snapshotProductSpecifications(product);
    savedHighlights.current = snapshotProductHighlights(product);
    setDraft(hydrateProductRelatedDraft(product));
    setImages(product.images ?? []);
    setReady(true);
    setLoading(false);
  }, [product?.id, reload]);

  function changeDraft(value: ProductRelatedDraft) {
    setDraft(value);
    setIsDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || !ready || requiresReview) return;
    submitLock.current = true;
    const data = new FormData(event.currentTarget);
    setError(undefined);
    setSubmitting(true);
    setFieldErrors({});
    const progress: ProductSaveProgress = {
      productId: persistedId.current,
      editToken: editToken.current,
      draft: {
        ...draft,
        specifications: draft.specifications.map((item) => ({ ...item })),
      },
      specifications: savedSpecifications.current,
      highlights: savedHighlights.current,
      images,
      requiresReview: false,
    };
    function checkpoint() {
      setSaveSection(progress.section);
      persistedId.current = progress.productId;
      editToken.current = progress.editToken;
      savedHighlights.current = progress.highlights;
      setImages(progress.images);
      setRequiresReview(progress.requiresReview);
      setDraft({ ...progress.draft });
    }
    try {
      if (pendingEntry)
        throw new Error(
          "Finish adding the specification, image, or stock operation before saving, or clear that entry.",
        );
      validateRelatedDraft(progress.draft);
      if (!canManageInventory && progress.draft.inventory.length)
        throw new Error("You do not have permission to change inventory.");
      const saved = await persistProductForm(
        {
          brand_id: data.get("brand_id"),
          category_id: data.get("category_id"),
          product_type_id: data.get("product_type_id"),
          hsn_code_id: data.get("hsn_code_id") || null,
          name: data.get("name"),
          group_name: data.get("group_name") || null,
          sku: data.get("sku"),
          mrp_price: data.get("mrp_price"),
          sale_price: data.get("sale_price") || null,
          description: data.get("description")
            ? sanitizeDescriptionHtml(String(data.get("description")))
            : null,
          ...(data.has("slug") ? { slug: data.get("slug") || null } : {}),
          ...(data.has("short_description") ? { short_description: data.get("short_description") || null } : {}),
          ...(data.has("details_payload") ? { details: JSON.parse(String(data.get("details_payload"))) } : {}),
          ...(data.has("generic_name") ? {
            additional_details: Object.fromEntries(
              ["generic_name", "model_number", "net_quantity", "country_of_origin", "manufactured_by", "marketed_by", "consumer_complaints"]
                .map((field) => [field, data.get(field) || null]),
            ),
          } : {}),
          tag: data.get("tag") || null,
          sort_order: data.get("sort_order") || 0,
          is_active: data.get("is_active") === "1",
          is_trade_product: data.get("is_trade_product") === "on",
        },
        progress,
        {
          saveProduct,
          loadProduct,
          deleteSpecification,
          saveSpecification,
          saveHighlights,
          uploadProductImage,
          updateProductImage,
          replaceProductImage,
          deleteProductImage,
          setWarehouseStock,
        },
        checkpoint,
      );
      setIsDirty(false);
      leaveAllowed.current = true;
      toast.success(mode === "create" ? "Product created successfully." : "Product changes saved successfully.");
      await onSaved(saved.data);
    } catch (reason) {
      toast.error(errorMessage(reason));
      if (reason instanceof ApiError && reason.status === 409)
        setRequiresReview(true);
      if (
        reason instanceof ApiError &&
        reason.status === 422 &&
        reason.details &&
        progress.section === "product"
      ) {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(reason.details).map(([field, messages]) => [
              field,
              messages[0],
            ]),
          ),
        );
      }
      setError(
        (progress.section ? `Could not finish ${progress.section}. ` : "") +
          (persistedId.current ? "Some changes may already be saved. " : "") +
          errorMessage(reason),
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function cancel() {
    if (
      (!isDirty && !pendingEntry) ||
      window.confirm(
        "Discard unsaved changes? Completed saves will be retained.",
      )
    ) {
      leaveAllowed.current = true;
      onCancel();
    }
  }

  function openAttributeLibrary() {
    setShowAttributeLibrary(true);
  }

  return (
    <>
      <fieldset
        className="product-editor product-editor-fieldset"
        disabled={submitting}
        onChange={(event) => {
          setIsDirty(true);
          const target = event.target;
          const name =
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement
              ? target.name
              : "";
          if (name) setFieldErrors((previous) => ({ ...previous, [name]: "" }));
        }}
      >
        <form
          id={formId}
          onSubmit={submit}
          className="min-w-0 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs"
        >
          <div className="px-6 py-6 sm:px-8">
            <ProductCoreFields
              product={product}
              masters={masters}
              canManageInventory={canManageInventory}
              errors={fieldErrors}
            />
          </div>

          <div className="px-6 py-6 sm:px-8">
            <ProductContent product={product} onEdit={() => setIsDirty(true)} />
          </div>

          {loading && (
            <div className="px-6 py-8 text-center sm:px-8">
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                <span role="status">Loading saved product details…</span>
              </div>
            </div>
          )}

          {ready && (
            <div className="px-6 py-6 sm:px-8">
              <ProductRelatedSections
                productId={persistedId.current}
                images={images}
                attributes={attributes}
                masters={masters}
                draft={draft}
                onChange={changeDraft}
                onPendingEntry={setPendingEntry}
                onManageAttributes={openAttributeLibrary}
                canManageInventory={canManageInventory}
                attributesLoading={attributesLoading}
                attributesError={attributesError}
                onRetryAttributes={onRetryAttributes}
                warehousesLoading={warehousesLoading}
                warehousesError={warehousesError}
                onRetryWarehouses={onRetryWarehouses}
              />
            </div>
          )}

          {mode === "create" && persistedId.current && error && (
            <div className="px-6 py-4 sm:px-8">
              <p
                className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs font-medium text-emerald-800"
                role="status"
              >
                Core product saved. Review and retry any remaining sections before creating another product.
              </p>
            </div>
          )}
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs font-medium text-red-800" role="alert">
            {error}
          </div>
        )}

        {requiresReview && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!persistedId.current) {
                  cancel();
                  return;
                }
                if (
                  persistedId.current &&
                  window.confirm(
                    "Open the saved product for review? Unsaved entries in this form will be discarded.",
                  )
                ) {
                  void loadProduct(persistedId.current)
                    .then((response) => {
                      leaveAllowed.current = true;
                      onSaved(response.data);
                    })
                    .catch((reason) => setError(errorMessage(reason)));
                }
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-300 bg-orange-50 px-5 text-xs font-semibold text-orange-800 shadow-xs hover:bg-orange-100"
            >
              Review saved product
            </button>
          </div>
        )}

        {!loading && !ready && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              Retry loading details
            </button>
          </div>
        )}

        {/* Floating / Sticky Modern Action Bar */}
        <div className="sticky bottom-0 z-30 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white/95 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {submitting ? (
              <div className="flex items-center gap-2 text-orange-600">
                <span className="inline-block h-2 w-2 animate-ping rounded-full bg-orange-500" />
                <span role="status">Saving {saveSection ?? "product"}…</span>
              </div>
            ) : isDirty ? (
              <div className="flex items-center gap-2 text-amber-600">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                <span>Unsaved changes in draft</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span>All changes ready</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancel}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-400 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              form={formId}
              type="submit"
              disabled={submitting || !ready || requiresReview}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 text-sm font-semibold text-white shadow-xs transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving product…
                </>
              ) : mode === "create" && !persistedId.current ? (
                "Save Product"
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </fieldset>

      {showAttributeLibrary && (
        <AttributesWorkspace
          onChanged={onAttributesChanged}
          onClose={() => setShowAttributeLibrary(false)}
        />
      )}
    </>
  );
}

function validateRelatedDraft(draft: ProductRelatedDraft) {
  const seen = new Set<string>();
  for (const item of draft.specifications) {
    if (!item.value.trim() || seen.has(item.attribute_id))
      throw new Error(
        "Each specification needs a unique attribute and a value.",
      );
    seen.add(item.attribute_id);
    if (
      !Number.isInteger(item.sort_order) ||
      item.sort_order < 0 ||
      !Number.isInteger(item.highlight_order) ||
      item.highlight_order < 0
    )
      throw new Error(
        "Specification and highlight order must be non-negative whole numbers.",
      );
  }
  for (const item of draft.media) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(item.file.type) ||
      !/\.(jpe?g|png|webp)$/i.test(item.file.name) ||
      item.file.size <= 0 ||
      item.file.size > 5 * 1024 * 1024
    )
      throw new Error(
        "Images must be JPG, PNG, or WebP and no larger than 5 MB.",
      );
    if (
      !item.type.trim() ||
      !Number.isInteger(item.sort_order) ||
      item.sort_order < 0
    )
      throw new Error(
        "Images need a media type and a non-negative whole-number order.",
      );
  }
  for (const item of draft.imageUpdates) {
    if (!Number.isInteger(item.sort_order) || item.sort_order < 0)
      throw new Error("Image order must be a non-negative whole number.");
  }
  for (const item of draft.inventory) {
    if (
      !item.warehouse_id ||
      !Number.isInteger(item.quantity) ||
      item.quantity < (item.operation === "adjustment" ? 0 : 1) ||
      item.quantity > 1000000
    )
      throw new Error(
        "Select a warehouse and enter a valid whole-number stock quantity.",
      );
  }
}

function ProductCoreFields({
  product,
  masters,
  canManageInventory,
  errors,
}: {
  product?: Product;
  masters: CatalogMasters;
  canManageInventory: boolean;
  errors: Record<string, string>;
}) {
  const invalid = (field: string) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `product-error-${field}` : undefined,
  });
  const message = (field: string) =>
    errors[field] && (
      <small id={`product-error-${field}`} className="mt-1.5 block text-xs font-medium text-red-600" role="alert">
        {errors[field]}
      </small>
    );

  return (
    <section id="product-basic" className="min-w-0">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 ">
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            Basic Information
          </h2>

      </div>

      {/* Group 1: Product Identification */}
      <div className="pt-3">
      
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-6">
            <label className="block text-xs font-semibold text-slate-700">
              Product Name <span className="text-red-500">*</span>
              <input
                name="name"
                {...invalid("name")}
                placeholder="Name"
                defaultValue={product?.name ?? ""}
                required
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              />
            </label>
            {message("name")}
          </div>

          <div className="sm:col-span-1 lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">
              SKU <span className="text-red-500">*</span>
              <input
                name="sku"
                {...invalid("sku")}
                placeholder="DFT-TRD-001"
                defaultValue={product?.sku ?? ""}
                required
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm tracking-wide text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              />
            </label>
            {message("sku")}
          </div>

          <div className="sm:col-span-1 lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">
              Group Name
              <input
                name="group_name"
                {...invalid("group_name")}
                placeholder="Optional product group"
                defaultValue={product?.group_name ?? ""}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              />
            </label>
            {message("group_name")}
          </div>

        </div>
      </div>

      {/* Group 2: Taxonomy & Classification */}
      <div className="pt-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Classification
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div id="product-classification" className="min-w-0">
            <MasterSelect
              label="Product Type"
              name="product_type_id"
              values={masters.productTypes}
              initial={product?.product_type?.id}
              error={errors.product_type_id}
              required
            />
          </div>
          <MasterSelect
            label="Brand"
            name="brand_id"
            values={masters.brands}
            initial={product?.brand?.id}
            error={errors.brand_id}
            required
          />
          <MasterSelect
            label="Category"
            name="category_id"
            values={masters.categories}
            initial={product?.category?.id}
            error={errors.category_id}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              HSN Code (optional)
              <select
                name="hsn_code_id"
                {...invalid("hsn_code_id")}
                defaultValue={product?.hsn_code?.id ?? ""}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              >
                <option value="">Not set</option>
                {masters.hsnCodes.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.title}
                    {value.hsn_code ? ` (${value.hsn_code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            {message("hsn_code_id")}
          </div>
        </div>
      </div>

      {/* Group 3: Pricing & Merchandising */}
      <div className="pt-6">
        <div className="mb-3 flex items-center gap-2">
  
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pricing
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div id="product-pricing">
            <label className="block text-xs font-semibold text-slate-700">
              MRP / Price <span className="text-red-500">*</span>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-slate-400">
                  ₹
                </span>
                <input
                  name="mrp_price"
                  {...invalid("mrp_price")}
                  placeholder="0.00"
                  type="number"
                  min=".01"
                  step=".01"
                  defaultValue={product?.price?.mrp ?? ""}
                  required
                  className="block w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
                />
              </div>
            </label>
            {message("mrp_price")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Sale Price
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-slate-400">
                  ₹
                </span>
                <input
                  name="sale_price"
                  {...invalid("sale_price")}
                  placeholder="0.00"
                  type="number"
                  min=".01"
                  step=".01"
                  defaultValue={product?.price?.sale ?? ""}
                  className="block w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
                />
              </div>
            </label>
            {message("sale_price")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Tag / Badge
              <input
                name="tag"
                {...invalid("tag")}
                placeholder="e.g. Best Seller"
                defaultValue={product?.tag ?? ""}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              />
            </label>
            {message("tag")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Catalog Sort Order
              <input
                name="sort_order"
                {...invalid("sort_order")}
                type="number"
                min="0"
                step="1"
                defaultValue={product?.sort_order ?? 0}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              />
            </label>
            {message("sort_order")}
          </div>
        </div>
      </div>

      {/* Group 4: Status & Visibility */}
      <div className="pt-6">
        <div className="mb-3 flex items-center gap-2">
        
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Status &amp; Visibility
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Publication Status
              <select
                name="is_active"
                {...invalid("is_active")}
                defaultValue={product?.is_active === false ? "0" : "1"}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
              >
                <option value="1">Active </option>
                <option value="0">Inactive</option>
              </select>
            </label>
            {message("is_active")}
          </div>

          <div className="flex items-end">
            <label className="flex h-[44px] w-full items-center gap-3 rounded-xl border border-slate-300 bg-slate-50/60 px-4 transition hover:bg-slate-50 cursor-pointer">
              <input
                name="is_trade_product"
                {...invalid("is_trade_product")}
                type="checkbox"
                defaultChecked={product?.is_trade_product ?? false}
                className="h-4 w-4"
              />
              <span className="text-xs font-semibold text-slate-800">
                Trade 
              </span>
            </label>
            {message("is_trade_product")}
          </div>
        </div>
      </div>
    </section>
  );
}

function MasterSelect({
  label,
  name,
  values,
  initial,
  error,
  required,
}: {
  label: string;
  name: string;
  values: Master[];
  initial?: string;
  error?: string;
  required?: boolean;
}) {
  const selectable =
    name === "brand_id"
      ? values
      : values.filter((value) => value.is_active || value.id === initial);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
        <select
          name={name}
          defaultValue={initial ?? ""}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `product-error-${name}` : undefined}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {selectable.map((value) => (
            <option key={value.id} value={value.id}>
              {value.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <small id={`product-error-${name}`} className="mt-1.5 block text-xs font-medium text-red-600" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

function ProductContent({
  product,
  onEdit,
}: {
  product?: Product;
  onEdit: () => void;
}) {
  return (
    <section id="product-content" className="min-w-0">
      <ProductDescriptionEditor
        key={product?.id ?? "new"}
        initialValue={product?.description ?? ""}
        onEdit={onEdit}
      />
    </section>
  );
}
