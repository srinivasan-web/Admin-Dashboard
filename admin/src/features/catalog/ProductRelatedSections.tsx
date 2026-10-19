import { StockMovementHistory } from "./StockMovementHistory";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Plus,
  Sliders,
  Star,
  Trash2,
  UploadCloud,
  Warehouse,
} from "lucide-react";
import type {
  CatalogAttribute,
  CatalogMasters,
  ProductImage,
  WarehouseStockSnapshot,
} from "./types";
import { loadWarehouseStock } from "./catalogApi";
import { errorMessage } from "../../api/client";
import { selectedHighlightSpecifications } from "./productFormState";

export type ProductRelatedDraft = {
  removedSpecificationIds: string[];
  removedImageIds: string[];
  imageUpdates: Array<{ id: string; sort_order: number; is_primary: boolean }>;
  specifications: Array<{
    id?: string;
    attribute_id: string;
    value: string;
    sort_order: number;
    highlight: boolean;
    highlight_order: number;
    highlight_active: boolean;
  }>;
  media: Array<{
    file: File;
    type: string;
    sort_order: number;
    is_primary: boolean;
    replace_image_id?: string;
  }>;
  inventory: Array<{
    idempotency_key?: string;
    warehouse_id: string;
    operation: "adjustment" | "stock_in" | "stock_out";
    quantity: number;
  }>;
};

export const emptyProductRelatedDraft = (): ProductRelatedDraft => ({
  removedSpecificationIds: [],
  removedImageIds: [],
  imageUpdates: [],
  specifications: [],
  media: [],
  inventory: [],
});

export function ProductRelatedSections({
  attributes,
  masters,
  draft,
  onChange,
  productId,
  images,
  onPendingEntry,
  onManageAttributes,
  canManageInventory,
  attributesLoading,
  attributesError,
  onRetryAttributes,
  warehousesLoading,
  warehousesError,
  onRetryWarehouses,
}: {
  attributes: CatalogAttribute[];
  masters: CatalogMasters;
  draft: ProductRelatedDraft;
  onChange: (draft: ProductRelatedDraft) => void;
  productId?: string;
  images: ProductImage[];
  onPendingEntry: (pending: boolean) => void;
  onManageAttributes: () => void;
  canManageInventory: boolean;
  attributesLoading?: boolean;
  attributesError?: string;
  onRetryAttributes: () => void;
  warehousesLoading?: boolean;
  warehousesError?: string;
  onRetryWarehouses: () => void;
}) {
  const [attributeId, setAttributeId] = useState("");
  const [value, setValue] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [showInHighlights, setShowInHighlights] = useState(false);
  const [specificationEntryEdited, setSpecificationEntryEdited] =
    useState(false);
  const [specificationError, setSpecificationError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replacingImage, setReplacingImage] = useState<ProductImage>();
  const [mediaDropActive, setMediaDropActive] = useState(false);
  const [draggedMediaIndex, setDraggedMediaIndex] = useState<number>();
  const [mediaType, setMediaType] = useState("gallery");
  const [mediaError, setMediaError] = useState<string>();
  const [mediaEntryEdited, setMediaEntryEdited] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [operation, setOperation] = useState<
    "adjustment" | "stock_in" | "stock_out"
  >("adjustment");
  const [quantityInput, setQuantityInput] = useState("");
  const [stockEntryEdited, setStockEntryEdited] = useState(false);

  useEffect(() => {
    onPendingEntry(
      specificationEntryEdited ||
        Boolean(specificationError) ||
        mediaEntryEdited ||
        Boolean(mediaError) ||
        Boolean(replacingImage) ||
        stockEntryEdited,
    );
  }, [
    mediaEntryEdited,
    mediaError,
    onPendingEntry,
    replacingImage,
    specificationEntryEdited,
    specificationError,
    stockEntryEdited,
  ]);

  useEffect(
    () => () => {
      onPendingEntry(false);
    },
    [onPendingEntry],
  );

  const [stock, setStock] = useState<WarehouseStockSnapshot>();
  const [stockError, setStockError] = useState<string>();
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockReload, setStockReload] = useState(0);
  const quantity = Number(quantityInput);
  const validStockQuantity =
    /^\d+$/.test(quantityInput) &&
    quantity >= (operation === "adjustment" ? 0 : 1) &&
    quantity <= 1000000;

  useEffect(() => {
    let active = true;
    setStock(undefined);
    setStockError(undefined);
    if (!canManageInventory || !productId || !warehouseId) {
      setLoadingStock(false);
      return;
    }
    setLoadingStock(true);
    void loadWarehouseStock(warehouseId, productId)
      .then((response) => {
        if (active) setStock(response.data);
      })
      .catch((reason) => {
        if (active) setStockError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoadingStock(false);
      });
    return () => {
      active = false;
    };
  }, [
    canManageInventory,
    productId,
    warehouseId,
    draft.inventory.length,
    stockReload,
  ]);

  const availableAttributes = attributes.filter(
    (attribute) =>
      attribute.is_active &&
      !draft.specifications.some(
        (specification) => specification.attribute_id === attribute.id,
      ),
  );
  const selectedAttribute = attributes.find(
    (attribute) => attribute.id === attributeId,
  );
  const selectedHighlights = selectedHighlightSpecifications(
    draft.specifications,
  );
  const selectedPrimaryImageId = draft.imageUpdates.find(
    (item) => item.is_primary,
  )?.id;

  function addSpecification() {
    const attribute = attributes.find(
      (candidate) => candidate.id === attributeId,
    );
    if (!attributeId || !attribute?.is_active) {
      setSpecificationEntryEdited(true);
      setSpecificationError("Select an active attribute.");
      return;
    }
    if (
      draft.specifications.some(
        (specification) => specification.attribute_id === attributeId,
      )
    ) {
      setSpecificationEntryEdited(true);
      setSpecificationError(
        "This attribute is already assigned to the product.",
      );
      return;
    }
    if (!value.trim()) {
      setSpecificationEntryEdited(true);
      setSpecificationError("Enter a specification value.");
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setSpecificationEntryEdited(true);
      setSpecificationError("Sort order must be a non-negative whole number.");
      return;
    }
    onChange({
      ...draft,
      specifications: [
        ...draft.specifications,
        {
          attribute_id: attributeId,
          value: value.trim(),
          sort_order: sortOrder,
          highlight: showInHighlights,
          highlight_order: draft.specifications.filter((item) => item.highlight)
            .length,
          highlight_active: true,
        },
      ],
    });
    setAttributeId("");
    setValue("");
    setSortOrder(draft.specifications.length + 1);
    setShowInHighlights(false);
    setSpecificationEntryEdited(false);
    setSpecificationError(undefined);
  }

  function reorderSpecification(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.specifications.length) return;
    const specifications = [...draft.specifications];
    [specifications[index], specifications[target]] = [
      specifications[target],
      specifications[index],
    ];
    onChange({
      ...draft,
      specifications: specifications.map((item, order) => ({
        ...item,
        sort_order: order,
      })),
    });
  }

  function nextMediaSortOrder() {
    return (
      Math.max(
        -1,
        ...images.map((image) => image.sort_order ?? -1),
        ...draft.media.map((item) => item.sort_order),
      ) + 1
    );
  }

  function validImage(file: File) {
    return (
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      /\.(jpe?g|png|webp)$/i.test(file.name) &&
      file.size > 0 &&
      file.size <= 5 * 1024 * 1024
    );
  }

  function queueImages(files: File[]) {
    if (!files.length) return;
    if (files.some((file) => !validImage(file))) {
      setMediaError("Choose JPG, PNG or WebP images no larger than 5 MB each.");
      setMediaEntryEdited(true);
      return;
    }
    if (!mediaType.trim()) {
      setMediaError("Enter an image type before adding photos.");
      setMediaEntryEdited(true);
      return;
    }
    setMediaError(undefined);
    setMediaEntryEdited(false);
    onChange({
      ...draft,
      media: [
        ...draft.media,
        ...files.map((file, index) => ({
          file,
          type: mediaType.trim(),
          sort_order: nextMediaSortOrder() + index,
          is_primary:
            !images.some(
              (image) =>
                image.is_primary && !draft.removedImageIds.includes(image.id),
            ) &&
            !draft.media.some((item) => item.is_primary) &&
            index === 0,
        })),
      ],
    });
  }

  function reorderQueuedMedia(from: number, to: number) {
    if (from === to || to < 0 || to >= draft.media.length) return;
    const media = [...draft.media];
    const [moved] = media.splice(from, 1);
    media.splice(to, 0, moved);
    const firstQueuedOrder =
      Math.max(-1, ...images.map((image) => image.sort_order ?? -1)) + 1;
    onChange({
      ...draft,
      media: media.map((item, index) => ({
        ...item,
        sort_order: firstQueuedOrder + index,
      })),
    });
  }

  function addInventory() {
    if (
      !canManageInventory ||
      !warehouseId ||
      (productId && !stock) ||
      loadingStock ||
      !validStockQuantity
    )
      return;
    onChange({
      ...draft,
      inventory: [
        ...draft.inventory,
        {
          warehouse_id: warehouseId,
          operation,
          quantity,
          idempotency_key: crypto.randomUUID(),
        },
      ],
    });
    setQuantityInput("");
    setStockEntryEdited(false);
  }

  return (
    <div className="space-y-10">
      {/* SECTION 1: ATTRIBUTES & SPECIFICATIONS */}
      <section
        id="product-attributes"
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              Attributes &amp; Specifications
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Assign technical specifications and highlight key selling points for storefront filters.
            </p>
          </div>
          <button
            type="button"
            onClick={onManageAttributes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-400 cursor-pointer"
          >
            <Sliders size={14} className="text-slate-500" />
            <span>Manage Attribute Library</span>
          </button>
        </div>

        {attributesLoading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <span role="status">Loading attribute definitions…</span>
          </div>
        )}

        {attributesError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-medium text-red-800" role="alert">
            <p>{attributesError}</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
              onClick={onRetryAttributes}
            >
              Retry attributes
            </button>
          </div>
        )}

        {/* Add Specification Card */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Assign Specification
            </span>
            {selectedAttribute && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Type: {selectedAttribute.data_type}
                {selectedAttribute.unit ? ` · Unit: ${selectedAttribute.unit}` : ""}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-12">
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700">
                Attribute
                <select
                  value={attributeId}
                  disabled={attributesLoading || Boolean(attributesError)}
                  onChange={(event) => {
                    setAttributeId(event.target.value);
                    setSpecificationEntryEdited(true);
                    setSpecificationError(undefined);
                  }}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden disabled:opacity-50"
                >
                  <option value="">Select an attribute…</option>
                  {availableAttributes.map((attribute) => (
                    <option key={attribute.id} value={attribute.id}>
                      {attribute.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700">
                Value
                <div className="relative mt-1.5">
                  <input
                    value={value}
                    onChange={(event) => {
                      setValue(event.target.value);
                      setSpecificationEntryEdited(true);
                      setSpecificationError(undefined);
                    }}
                    maxLength={1000}
                    placeholder="Specification value"
                    className={`block w-full rounded-xl border border-slate-300 bg-white py-2 pl-3.5 ${selectedAttribute?.unit ? "pr-14" : "pr-3.5"} text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden`}
                  />
                  {selectedAttribute?.unit && (
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-slate-400">
                      {selectedAttribute.unit}
                    </span>
                  )}
                </div>
              </label>
            </div>

            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Sort Order
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(Number(event.target.value));
                    setSpecificationEntryEdited(true);
                    setSpecificationError(undefined);
                  }}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
                />
              </label>
            </div>

            <div className="sm:col-span-1 lg:col-span-2 flex items-end">
              <label className="flex h-[38px] w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 transition hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInHighlights}
                  onChange={(event) => {
                    setShowInHighlights(event.target.checked);
                    setSpecificationEntryEdited(true);
                    setSpecificationError(undefined);
                  }}
                  className="h-4 w-4 rounded-md border-slate-300 text-orange-600 focus:ring-orange-500/20"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Show on Top
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={addSpecification}
              disabled={attributesLoading || Boolean(attributesError)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-50 cursor-pointer"
            >
              <Plus size={15} /> Add Specification
            </button>
            <button
              type="button"
              onClick={() => {
                setAttributeId("");
                setValue("");
                setSortOrder(0);
                setShowInHighlights(false);
                setSpecificationEntryEdited(false);
                setSpecificationError(undefined);
              }}
              className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
            >
              Clear Entry
            </button>
          </div>
          {specificationError && (
            <p className="mt-2.5 text-xs font-medium text-red-600" role="alert">
              {specificationError}
            </p>
          )}
        </div>

        {/* Specifications Table */}
        <div className="mt-6">
          <DraftSpecifications
            specifications={draft.specifications}
            attributes={attributes}
            onRemove={(attributeId) =>
              onChange({
                ...draft,
                removedSpecificationIds: [
                  ...draft.removedSpecificationIds,
                  ...draft.specifications
                    .filter(
                      (specification) =>
                        specification.attribute_id === attributeId &&
                        specification.id,
                    )
                    .map((specification) => specification.id!),
                ],
                specifications: draft.specifications.filter(
                  (specification) => specification.attribute_id !== attributeId,
                ),
              })
            }
            onReorder={reorderSpecification}
            onEdit={(attributeId, changes) =>
              onChange({
                ...draft,
                specifications: draft.specifications.map((item) =>
                  item.attribute_id === attributeId
                    ? {
                        ...item,
                        ...changes,
                        ...(changes.highlight && !item.highlight
                          ? { highlight_order: selectedHighlights.length }
                          : {}),
                        ...(changes.highlight === true
                          ? { highlight_active: true }
                          : {}),
                      }
                    : item,
                ),
              })
            }
          />
        </div>
      </section>

      {/* SECTION 2: MEDIA & PRODUCT IMAGES */}
      <section
        id="product-media"
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              Media &amp; Product Imagery
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Upload, organize, and reorder high-resolution product photos. Changes apply upon saving.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {images.length -
              draft.removedImageIds.length +
              draft.media.filter((item) => !item.replace_image_id).length}{" "}
            image
            {images.length -
              draft.removedImageIds.length +
              draft.media.filter((item) => !item.replace_image_id).length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        {/* Saved Product Images Gallery */}
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Saved Product Images
          </h3>
          {images.some((image) => !draft.removedImageIds.includes(image.id)) ? (
            <div
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              aria-label="Saved product images"
            >
              {[...images]
                .filter((image) => !draft.removedImageIds.includes(image.id))
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((image, index) => (
                  <div
                    key={image.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
                      <img
                        src={image.url}
                        alt={`Product image ${index + 1}`}
                        className="h-full w-full object-contain"
                      />
                      <span className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                        {image.is_primary ? "★ Primary" : `#${index + 1}`}
                      </span>
                    </div>

                    {draft.media.some(
                      (item) => item.replace_image_id === image.id,
                    ) && (
                      <p className="mt-2 text-center text-[11px] font-semibold text-orange-600">
                        Replacement queued
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-slate-200 bg-white py-1 text-center text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            setReplacingImage(image);
                            setMediaEntryEdited(true);
                            replaceInput.current?.click();
                          }}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-red-200 bg-red-50/50 py-1 text-center text-[11px] font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                          onClick={() =>
                            onChange({
                              ...draft,
                              removedImageIds: [
                                ...draft.removedImageIds,
                                image.id,
                              ],
                              imageUpdates: draft.imageUpdates.filter(
                                (item) => item.id !== image.id,
                              ),
                              media: draft.media.filter(
                                (item) => item.replace_image_id !== image.id,
                              ),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={
                          selectedPrimaryImageId === image.id ||
                          (!selectedPrimaryImageId && image.is_primary)
                        }
                        onClick={() =>
                          onChange({
                            ...draft,
                            media: draft.media.map((item) => ({
                              ...item,
                              is_primary: false,
                            })),
                            imageUpdates: [
                              ...draft.imageUpdates
                                .filter((item) => item.id !== image.id)
                                .map((item) => ({
                                  ...item,
                                  is_primary: false,
                                })),
                              {
                                id: image.id,
                                sort_order:
                                  draft.imageUpdates.find(
                                    (item) => item.id === image.id,
                                  )?.sort_order ??
                                  image.sort_order ??
                                  index,
                                is_primary: true,
                              },
                            ],
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 text-center text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        Make Primary
                      </button>

                      <label className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Order</span>
                        <input
                          className="h-6 w-14 rounded-md border border-slate-300 px-1.5 text-center text-xs text-slate-900"
                          type="number"
                          min="0"
                          aria-label={`Sort order for image ${index + 1}`}
                          value={
                            draft.imageUpdates.find(
                              (item) => item.id === image.id,
                            )?.sort_order ??
                            image.sort_order ??
                            index
                          }
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              imageUpdates: [
                                ...draft.imageUpdates.filter(
                                  (item) => item.id !== image.id,
                                ),
                                {
                                  id: image.id,
                                  sort_order: Number(event.target.value),
                                  is_primary:
                                    draft.imageUpdates.find(
                                      (item) => item.id === image.id,
                                    )?.is_primary ?? image.is_primary,
                                },
                              ],
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
              No saved product images yet. Upload new images below.
            </p>
          )}

          {/* Modern Dropzone Card */}
          <div className="mt-5">
            <button
              type="button"
              className={`group flex min-h-[160px] w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed p-6 transition-all cursor-pointer ${
                mediaDropActive
                  ? "border-orange-500 bg-orange-50/40"
                  : "border-slate-300 bg-slate-50/40 hover:border-orange-500 hover:bg-orange-50/20"
              }`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setMediaDropActive(true);
              }}
              onDragLeave={() => setMediaDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setMediaDropActive(false);
                queueImages(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-xs ring-1 ring-slate-200/60 transition group-hover:scale-105 group-hover:text-orange-700">
                <UploadCloud size={24} aria-hidden="true" />
              </div>
              <div className="text-center">
                <strong className="block text-sm font-semibold text-slate-800">
                  Click to upload or drag images here
                </strong>
                <span className="mt-0.5 block text-xs text-slate-500">
                  JPG, PNG or WebP · Up to 5 MB each
                </span>
              </div>
            </button>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                queueImages(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <input
              ref={replaceInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Replace product image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && replacingImage) {
                  if (validImage(file)) {
                    setMediaError(undefined);
                    setMediaEntryEdited(false);
                    onChange({
                      ...draft,
                      media: [
                        ...draft.media.filter(
                          (item) => item.replace_image_id !== replacingImage.id,
                        ),
                        {
                          file,
                          type: replacingImage.type,
                          sort_order: replacingImage.sort_order ?? 0,
                          is_primary: replacingImage.is_primary,
                          replace_image_id: replacingImage.id,
                        },
                      ],
                    });
                  } else {
                    setMediaError(
                      "Choose a JPG, PNG or WebP replacement no larger than 5 MB.",
                    );
                  }
                }
                event.target.value = "";
                setReplacingImage(undefined);
              }}
            />
          </div>

          {/* Media Role & Queue Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-semibold text-slate-700">
                Default Image Type:
              </label>
              <input
                value={mediaType}
                maxLength={50}
                placeholder="gallery"
                onChange={(event) => {
                  setMediaType(event.target.value);
                  setMediaEntryEdited(true);
                  setMediaError(undefined);
                }}
                className="h-8 w-32 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            {(mediaEntryEdited || replacingImage || mediaError) && (
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  setMediaType("gallery");
                  setReplacingImage(undefined);
                  setMediaEntryEdited(false);
                  setMediaError(undefined);
                  if (fileInput.current) fileInput.current.value = "";
                  if (replaceInput.current) replaceInput.current.value = "";
                }}
              >
                Clear media entry
              </button>
            )}
          </div>

          {mediaError && (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              {mediaError}
            </p>
          )}
        </div>

        {/* Ready to Upload Queue */}
        {draft.media.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
            <h3 className="mb-3.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <ImagePlus size={16} className="text-orange-600" />
              <span>Ready to upload ({draft.media.length})</span>
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {draft.media.map((item, index) => (
                <article
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs transition hover:border-slate-300"
                  key={`${item.file.name}-${index}`}
                  draggable
                  onDragStart={() => setDraggedMediaIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedMediaIndex !== undefined)
                      reorderQueuedMedia(draggedMediaIndex, index);
                    setDraggedMediaIndex(undefined);
                  }}
                  onDragEnd={() => setDraggedMediaIndex(undefined)}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
                    <FilePreview file={item.file} />
                    {item.is_primary && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                        Primary
                      </span>
                    )}
                  </div>

                  <span
                    className="mt-2 block truncate text-[11px] font-medium text-slate-800"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </span>

                  <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2 text-xs">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="primary-product-image"
                        aria-label={`Make ${item.file.name} primary`}
                        checked={item.is_primary}
                        onChange={() =>
                          onChange({
                            ...draft,
                            media: draft.media.map(
                              (candidate, candidateIndex) => ({
                                ...candidate,
                                is_primary: candidateIndex === index,
                              }),
                            ),
                          })
                        }
                        className="text-orange-600"
                      />
                      <span>Make Primary</span>
                    </label>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Order #{item.sort_order + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          aria-label={`Move ${item.file.name} earlier`}
                          disabled={index === 0}
                          onClick={() => reorderQueuedMedia(index, index - 1)}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          aria-label={`Move ${item.file.name} later`}
                          disabled={index === draft.media.length - 1}
                          onClick={() => reorderQueuedMedia(index, index + 1)}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 cursor-pointer"
                          aria-label={`Remove ${item.file.name}`}
                          onClick={() =>
                            onChange({
                              ...draft,
                              media: draft.media.filter(
                                (_, candidate) => candidate !== index,
                              ),
                            })
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: INVENTORY ALLOCATION */}
      <section
        id="product-inventory"
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              Inventory Allocation
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Record physical stock adjustments, receipts, and dispatches across warehouse locations.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <Warehouse size={13} className="text-slate-500" />
            <span>{masters.warehouses.length} Warehouses</span>
          </span>
        </div>

        {!canManageInventory ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Inventory adjustments require warehouse management permissions. You can still save product catalog details.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {warehousesLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                <span role="status">Loading warehouse inventory…</span>
              </div>
            )}

            {warehousesError && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-medium text-red-800" role="alert">
                <p>{warehousesError}</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                  onClick={onRetryWarehouses}
                >
                  Retry warehouses
                </button>
              </div>
            )}

            {!productId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs font-medium text-amber-800">
                Stock will be allocated to the new product after its ID is saved. No initial ledger entry exists yet.
              </div>
            )}

            {/* Warehouse Stock Snapshot Banner */}
            {warehouseId && productId && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-xs">
                    <Warehouse size={18} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      {masters.warehouses.find((w) => w.id === warehouseId)?.name ?? "Selected Warehouse"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {loadingStock
                        ? "Querying warehouse ledger…"
                        : stock
                          ? `On-Hand: ${stock.quantity} · Reserved: ${stock.reserved_quantity} · Available: ${stock.available_quantity}`
                          : "Stock unavailable"}
                    </p>
                  </div>
                </div>

                {stock && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      Available: {stock.available_quantity}
                    </span>
                  </div>
                )}

                {stockError && (
                  <button
                    type="button"
                    onClick={() => setStockReload((value) => value + 1)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    Retry Stock Load
                  </button>
                )}
              </div>
            )}

            {stock && productId && (
              <StockMovementHistory
                key={warehouseId}
                productId={productId}
                warehouseId={warehouseId}
                refreshKey={stock}
              />
            )}

            {/* Allocation Operation Input Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
              <span className="mb-3.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Queue Stock Operation
              </span>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-12">
                <div className="sm:col-span-2 lg:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Warehouse
                    <select
                      value={warehouseId}
                      disabled={warehousesLoading || Boolean(warehousesError)}
                      onChange={(event) => {
                        setWarehouseId(event.target.value);
                        setQuantityInput("");
                        setStockEntryEdited(false);
                      }}
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden disabled:opacity-50"
                    >
                      <option value="">Select warehouse location…</option>
                      {masters.warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="sm:col-span-1 lg:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700">
                    Operation Type
                    <select
                      value={operation}
                      onChange={(event) => {
                        setOperation(event.target.value as typeof operation);
                        setQuantityInput("");
                        setStockEntryEdited(false);
                      }}
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
                    >
                      <option value="adjustment">Adjustment (Set absolute count)</option>
                      <option value="stock_in">Stock In (Add stock)</option>
                      <option value="stock_out">Stock Out (Remove stock)</option>
                    </select>
                  </label>
                </div>

                <div className="sm:col-span-1 lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    {operation === "adjustment" ? "New Quantity" : "Quantity"}
                    <input
                      type="number"
                      min={operation === "adjustment" ? 0 : 1}
                      max={1000000}
                      step="1"
                      placeholder="e.g. 100"
                      value={quantityInput}
                      onChange={(event) => {
                        setQuantityInput(event.target.value);
                        setStockEntryEdited(event.target.value !== "");
                      }}
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden"
                    />
                  </label>
                </div>
              </div>

              {quantityInput !== "" && !validStockQuantity && (
                <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                  Enter a whole-number quantity{" "}
                  {operation === "adjustment" ? "from 0" : "from 1"} to 1,000,000.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={
                    !warehouseId ||
                    Boolean(productId && !stock) ||
                    loadingStock ||
                    !validStockQuantity ||
                    Boolean(warehousesError)
                  }
                  onClick={addInventory}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-50 cursor-pointer"
                >
                  <Plus size={15} /> Queue Stock Operation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuantityInput("");
                    setStockEntryEdited(false);
                    if (
                      warehouseId &&
                      draft.inventory.some(
                        (item) => item.warehouse_id === warehouseId,
                      )
                    ) {
                      onChange({
                        ...draft,
                        inventory: draft.inventory.filter(
                          (item) => item.warehouse_id !== warehouseId,
                        ),
                      });
                    }
                  }}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
                >
                  Clear Entry
                </button>
              </div>
            </div>

            {/* Queued Operations Table */}
            {draft.inventory.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3">Operation</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {draft.inventory.map((item, index) => (
                      <tr key={`${item.warehouse_id}-${index}`} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {masters.warehouses.find(
                            (warehouse) => warehouse.id === item.warehouse_id,
                          )?.name ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                              item.operation === "stock_in"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : item.operation === "stock_out"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {item.operation.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-medium">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                            aria-label="Remove queued stock operation"
                            onClick={() =>
                              onChange({
                                ...draft,
                                inventory: draft.inventory.filter(
                                  (_, candidate) => candidate !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return (
    <img
      src={url}
      alt={file.name}
      className="h-full w-full object-contain"
    />
  );
}

function DraftSpecifications({
  specifications,
  attributes,
  onRemove,
  onReorder,
  onEdit,
}: {
  specifications: ProductRelatedDraft["specifications"];
  attributes: CatalogAttribute[];
  onRemove: (attributeId: string) => void;
  onReorder: (index: number, direction: -1 | 1) => void;
  onEdit: (
    attributeId: string,
    changes: Partial<ProductRelatedDraft["specifications"][number]>,
  ) => void;
}) {
  if (specifications.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <p className="text-xs font-medium text-slate-500">
          No specifications added. Select an attribute and enter its product value above.
        </p>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xs">
      <table className="w-full text-left text-xs" aria-label="Product specifications">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-3.5 py-3 w-12 text-center">#</th>
            <th className="px-3 py-3 w-20">Seq</th>
            <th className="px-4 py-3">Attribute</th>
            <th className="px-4 py-3">Specification Value</th>
            <th className="px-3 py-3 w-24">Filterable</th>
            <th className="px-3.5 py-3 w-40">Highlight / Top</th>
            <th className="px-4 py-3 text-right w-28">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {specifications.map((item, index) => {
            const attribute = attributes.find(
              (candidate) => candidate.id === item.attribute_id,
            );
            const name = attribute?.name ?? "Unavailable attribute";
            return (
              <tr key={item.attribute_id} className="hover:bg-slate-50/50">
                <td className="px-3.5 py-3 text-center text-slate-400 font-medium">
                  {index + 1}
                </td>
                <td className="px-3 py-3">
                  <input
                    className="h-7 w-14 rounded-md border border-slate-300 px-1.5 text-center text-xs font-mono text-slate-900"
                    aria-label={`Sequence for ${name}`}
                    type="number"
                    min="0"
                    step="1"
                    value={item.sort_order}
                    onChange={(event) =>
                      onEdit(item.attribute_id, {
                        sort_order: Number(event.target.value),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <strong className="block font-semibold text-slate-900">{name}</strong>
                  <small className="block text-[11px] text-slate-500">
                    {item.id ? "Existing specification" : "New · not saved"}
                    {attribute && !attribute.is_active
                      ? " · Inactive attribute"
                      : ""}
                  </small>
                </td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <input
                      aria-label={`Value for ${name}`}
                      value={item.value}
                      required
                      maxLength={1000}
                      onChange={(event) =>
                        onEdit(item.attribute_id, { value: event.target.value })
                      }
                      className="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                    />
                    {attribute?.unit && (
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        Unit: {attribute.unit}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      attribute?.is_filterable
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    title="Managed in Attribute Master"
                  >
                    {attribute?.is_filterable ? "Yes" : "No"}
                  </span>
                  {attribute &&
                    !attribute.is_active &&
                    attribute.is_filterable && (
                      <small className="block text-[10px] text-amber-600">
                        Inactive
                      </small>
                    )}
                </td>
                <td className="px-3.5 py-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label={`Show ${name} on top`}
                      checked={item.highlight}
                      onChange={(event) =>
                        onEdit(item.attribute_id, {
                          highlight: event.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500/20"
                    />
                    <span>Highlight</span>
                  </label>
                  {item.highlight && (
                    <details className="mt-1 text-[11px]">
                      <summary className="text-orange-600 cursor-pointer hover:underline">
                        Order settings
                      </summary>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          className="h-6 w-12 rounded-md border border-slate-300 px-1 text-center text-xs"
                          aria-label={`Highlight order for ${name}`}
                          type="number"
                          min="0"
                          step="1"
                          value={item.highlight_order}
                          onChange={(event) =>
                            onEdit(item.attribute_id, {
                              highlight_order: Number(event.target.value),
                            })
                          }
                        />
                        <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            aria-label={`Activate highlight ${name}`}
                            checked={item.highlight_active}
                            onChange={(event) =>
                              onEdit(item.attribute_id, {
                                highlight_active: event.target.checked,
                              })
                            }
                            className="h-3 w-3 rounded-xs text-orange-600"
                          />
                          <span>Active</span>
                        </label>
                      </div>
                    </details>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                      aria-label={`Move ${name} earlier`}
                      disabled={index === 0}
                      onClick={() => onReorder(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                      aria-label={`Move ${name} later`}
                      disabled={index === specifications.length - 1}
                      onClick={() => onReorder(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                      aria-label={`Remove ${name}`}
                      onClick={() => onRemove(item.attribute_id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
