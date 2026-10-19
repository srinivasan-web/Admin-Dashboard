import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Minus,
  Package,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import { saveCombo } from "./catalogApi";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { Combo, Product } from "./types";
import { useCatalogResource } from "./useCatalogData";
import type { CatalogRouteMode, CatalogRouteState } from "../../app/routes";
import {
  ErrorState,
  FilterBar,
  LoadingState,
  StatusBadge,
} from "../../components/ui";

type ItemDraft = { product_id: string; quantity: number };
type Props = {
  combos: Combo[];
  notice?: string;
  onSaved: () => void;
  route: CatalogRouteState;
  onRouteChange: (mode: CatalogRouteMode, recordId?: string) => void;
};

function parsePrice(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getProductPrice(product?: Product): number {
  if (!product) return 0;
  const sale = parsePrice(product.price?.sale);
  if (sale > 0) return sale;
  return parsePrice(product.price?.mrp);
}

function getProductImage(product?: Product): string | undefined {
  if (!product || !product.images || product.images.length === 0) return undefined;
  const primary = product.images.find((img) => img.is_primary);
  return primary?.url || product.images[0]?.url;
}

export function ComboWorkspace({ combos, notice, onSaved, route, onRouteChange }: Props) {
  const [query, setQuery] = useState("");
  const editing = route.mode === "edit"
    ? combos.find((combo) => combo.id === route.recordId)
    : undefined;
  const creating = route.mode === "create";
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Image-based catalog product picker modal
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState<string>("all");

  useEffect(() => {
    if (route.mode === "edit") {
      const combo = combos.find((item) => item.id === route.recordId);
      setItems(combo?.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })) ?? []);
    } else {
      setItems([]);
    }
    setError(undefined);
    setIsDirty(false);
    setIsPickerOpen(false);
  }, [route.mode, route.recordId]);

  const productData = useCatalogResource<Product[]>(
    creating || editing ? "/products" : null,
  );
  const products = productData.data ?? [];

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of products) {
      if (p.category?.id && p.category?.name) {
        set.set(p.category.id, p.category.name);
      }
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filteredCombos = useMemo(
    () =>
      combos.filter((combo) =>
        combo.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [combos, query],
  );

  const modalProducts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchCat =
        pickerCategory === "all" || p.category?.id === pickerCategory;
      return matchQuery && matchCat;
    });
  }, [products, pickerSearch, pickerCategory]);

  function openCreate() {
    setItems([]);
    setError(undefined);
    setIsDirty(false);
    onRouteChange("create");
  }

  function openEdit(combo: Combo) {
    setItems(
      combo.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    );
    setError(undefined);
    setIsDirty(false);
    onRouteChange("edit", combo.id);
  }

  function closeForm() {
    if (isDirty && !window.confirm("Discard unsaved combo changes?")) {
      return;
    }
    onRouteChange("list");
    setItems([]);
    setError(undefined);
    setIsDirty(false);
    setIsPickerOpen(false);
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setIsDirty(true);
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeItem(index: number) {
    setIsDirty(true);
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function toggleProductInBundle(product: Product) {
    setIsDirty(true);
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.product_id === product.id,
      );
      if (existingIndex >= 0) {
        return current.filter((_, idx) => idx !== existingIndex);
      }
      return [...current, { product_id: product.id, quantity: 1 }];
    });
  }

  function addProductToBundle(productId: string) {
    if (!productId) return;
    setIsDirty(true);
    setItems((current) => {
      if (current.some((item) => item.product_id === productId)) {
        return current;
      }
      return [...current, { product_id: productId, quantity: 1 }];
    });
  }

  // Summary calculations
  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    [items],
  );

  const estimatedTotalValue = useMemo(() => {
    return items.reduce((sum, item) => {
      const prod = productMap.get(item.product_id);
      const price = getProductPrice(prod);
      return sum + price * (item.quantity || 1);
    }, 0);
  }, [items, productMap]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const validItems = items.filter((item) => item.product_id.trim() !== "");

    if (validItems.length === 0) {
      setError("Please add at least one product to this combo bundle.");
      return;
    }

    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError("Combo Name is required.");
      return;
    }

    const isActiveVal = data.get("is_active");
    const isActive =
      isActiveVal === "active" || isActiveVal === "on" || isActiveVal === "true";

    setError(undefined);
    setSubmitting(true);
    try {
      await saveCombo(
        {
          name,
          is_active: isActive,
          items: validItems,
        },
        editing?.id,
      );
      setIsDirty(false);
      onRouteChange("list");
      setItems([]);
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  if (route.mode === "edit" && !editing)
    return <section className="workspace-form" role="alert">
      <p className="error">Combo not found or no longer available.</p>
      <button className="secondary" onClick={() => onRouteChange("list")}>Back to Combos</button>
    </section>;

  if (creating || editing) {
    return (
      <section className="workspace-form w-full space-y-6">
        <ProductManagementHeader
          title={editing ? "Edit Combo" : "Add Combo"}
          description="."
          breadcrumb={[
            "Product Management",
            "Combos",
            editing ? "Edit Combo" : "Add Combo",
          ]}
          actions={
            <button
              className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold leading-[20px] text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer"
              type="button"
              onClick={closeForm}
            >
              <ArrowLeft size={16} className="text-slate-500" />
              <span>Combos</span>
            </button>
          }
        />

        {productData.error && (
          <ErrorState
            message={productData.error}
            onRetry={productData.refresh}
          />
        )}
        {!productData.data && !productData.error && (
          <LoadingState label="Loading catalog products…" />
        )}

        <form
          key={editing?.id ?? "create"}
          className="space-y-6 w-full"
          onSubmit={submit}
          onChange={() => setIsDirty(true)}
          noValidate
        >
          {/* Section 1: COMBO DETAILS */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 transition-all duration-200">
            <div className="pb-5 mb-6 border-b border-slate-100">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 m-0">
                COMBO DETAILS
              </h2>
            
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Combo Name */}
              <div className="flex flex-col gap-1.5 w-full">
                <label
                  htmlFor="combo-name"
                  className="text-[13px] font-medium leading-[20px] text-slate-700 select-none flex items-center gap-1"
                >
                  <span>Combo Name</span>
                  <span
                    className="text-orange-500 font-bold"
                    aria-hidden="true"
                  >
                    *
                  </span>
                </label>
                <input
                  id="combo-name"
                  name="name"
                  defaultValue={editing?.name}
                  required
                  placeholder="e.g. Cardio Fitness Bundle"
                  disabled={submitting}
                  className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              {/* Status Select */}
              <div className="flex flex-col gap-1.5 w-full">
                <label
                  htmlFor="combo-status"
                  className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
                >
                  Status
                </label>
                <div className="relative flex items-center w-full">
                  <select
                    id="combo-status"
                    name="is_active"
                    defaultValue={
                      editing?.is_active === false ? "inactive" : "active"
                    }
                    disabled={submitting}
                    className="w-full h-11 pl-3.5 pr-10 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="active">Active in Catalog</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3.5 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: PRODUCTS IN COMBO */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 transition-all duration-200">
            <div className="pb-5 mb-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 m-0">
                  PRODUCTS IN COMBO
                </h2>
              
              </div>

              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                disabled={submitting || !productData.data}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-[10px] shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer flex-shrink-0"
              >
                <Plus size={16} className="text-orange-600" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Empty State */}
            {items.length === 0 ? (
              <div className="py-12 px-4 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-3 shadow-2xs">
                  <Package size={22} />
                </div>
                <p className="text-[14px] font-semibold text-slate-800 m-0">
                  No products selected
                </p>
                <p className="text-[13px] text-slate-500 max-w-sm mt-1 mb-4 leading-normal">
                  Click &ldquo;+ Add Product&rdquo; above to include items and define their
                  quantities in this bundle.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  disabled={submitting || !productData.data}
                  className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <Search size={15} />
                  <span>Browse Catalog Products</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Product Items List */}
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const product = productMap.get(item.product_id);
                    const imageUrl = getProductImage(product);
                    const unitPrice = getProductPrice(product);
                    const lineTotal = unitPrice * (item.quantity || 1);

                    return (
                      <div
                        key={`${item.product_id}-${index}`}
                        className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-4 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
                      >
                        {/* 1. Image Thumbnail */}
                        <div className="w-14 h-14 min-w-14 min-h-14 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center p-1 overflow-hidden flex-shrink-0 shadow-2xs">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product?.name ?? "Product image"}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package size={20} className="text-slate-300" />
                          )}
                        </div>

                        {/* 2. Product Information or Selector */}
                        <div className="flex-1 min-w-0">
                          {product ? (
                            <div className="space-y-1">
                              <h4 className="text-[14px] font-semibold text-slate-900 truncate m-0">
                                {product.name}
                              </h4>
                              <div className="flex items-center gap-2 text-[12px] text-slate-500 flex-wrap">
                                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                  {product.sku}
                                </span>
                                {product.category?.name && (
                                  <span className="text-slate-400">
                                    • {product.category.name}
                                  </span>
                                )}
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium text-[11px] border border-emerald-200/60">
                                  {product.available_stock > 0
                                    ? `${product.available_stock} in stock`
                                    : "Out of stock"}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="relative flex items-center w-full">
                              <select
                                value={item.product_id}
                                required
                                disabled={submitting}
                                onChange={(event) =>
                                  updateItem(index, {
                                    product_id: event.target.value,
                                  })
                                }
                                className="w-full h-11 pl-3.5 pr-10 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                <option value="">Choose product</option>
                                {products
                                  .filter(
                                    (p) =>
                                      p.id === item.product_id ||
                                      !items.some(
                                        (selected, selIdx) =>
                                          selIdx !== index &&
                                          selected.product_id === p.id,
                                      ),
                                  )
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.sku})
                                    </option>
                                  ))}
                              </select>
                              <ChevronDown
                                size={16}
                                className="absolute right-3.5 text-slate-400 pointer-events-none"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        </div>

                        {/* 3. Unit Price & Line Total */}
                        {product && (
                          <div className="text-right flex-shrink-0 hidden sm:block">
                            <div className="text-[13px] font-semibold text-slate-900">
                              ₹{lineTotal.toLocaleString("en-IN")}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              ₹{unitPrice.toLocaleString("en-IN")} each
                            </div>
                          </div>
                        )}

                        {/* 4. Interactive Quantity Stepper */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(index, {
                                quantity: Math.max(1, (item.quantity || 1) - 1),
                              })
                            }
                            disabled={submitting || (item.quantity || 1) <= 1}
                            className="stepper-btn"
                            aria-label="Decrease quantity"
                            title="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(index, {
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value) || 1,
                                ),
                              })
                            }
                            required
                            disabled={submitting}
                            className="stepper-input"
                            aria-label="Item quantity"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(index, {
                                quantity: (item.quantity || 1) + 1,
                              })
                            }
                            disabled={submitting}
                            className="stepper-btn"
                            aria-label="Increase quantity"
                            title="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* 5. Remove Action */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={submitting}
                          className="icon-button danger"
                          aria-label={`Remove ${product?.name ?? "product"} from combo`}
                          title={`Remove ${product?.name ?? "product"} from combo`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Bundle Summary Bar */}
                <div className="mt-4 p-4 rounded-xl bg-orange-50/60 border border-orange-100/90 flex flex-wrap items-center justify-between gap-4 text-slate-800">
                  <div className="flex items-center gap-6 text-[13px]">
                    <div>
                      <span className="text-slate-500">Products in bundle: </span>
                      <strong className="text-slate-900">{items.length}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Total units: </span>
                      <strong className="text-slate-900">{totalUnits}</strong>
                    </div>
                  </div>

                  {estimatedTotalValue > 0 && (
                    <div className="text-[13px]">
                      <span className="text-slate-500">Bundle Estimated Value: </span>
                      <strong className="text-orange-700 font-bold text-[15px]">
                        ₹{estimatedTotalValue.toLocaleString("en-IN")}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Semantic Form Error Banner */}
          {error && (
            <div
              className="p-3.5 bg-red-50/90 border border-red-200/90 rounded-xl flex items-start gap-2.5 text-red-800"
              role="alert"
            >
              <AlertCircle
                size={18}
                className="text-red-600 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="text-[13px] leading-[18px] font-medium">
                {error}
              </span>
            </div>
          )}

          {/* Form Action Bar: Symmetrical with Cancel and Primary Submit */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className="w-full sm:w-auto h-11 px-5 text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-[10px] shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting || !productData.data || Boolean(productData.error)
              }
              aria-busy={submitting}
              className="w-full sm:w-auto h-11 px-6 text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-[10px] shadow-xs hover:shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin text-white"
                    aria-hidden="true"
                  />
                  <span>Saving…</span>
                </>
              ) : (
                <span>{editing ? "Save changes" : "Create combo"}</span>
              )}
            </button>
          </div>
        </form>

        {/* ============================================================ */}
        {/* INTERACTIVE IMAGE-BASED CATALOG PRODUCT PICKER MODAL           */}
        {/* ============================================================ */}
        {isPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3
                    id="modal-title"
                    className="text-[17px] font-bold text-slate-900 m-0"
                  >
                    Select Products for Combo
                  </h3>
                  <p className="text-[13px] text-slate-500 mt-0.5 m-0">
                    Search and pick products to bundle together in this package.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                  aria-label="Close product picker"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Filters */}
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3">
                <div className="relative flex items-center">
                  <Search
                    size={16}
                    className="absolute left-3.5 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="search"
                    placeholder="Search by product name, SKU..."
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 text-[13px] bg-white rounded-lg border border-slate-200/90 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[12px] no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setPickerCategory("all")}
                      className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer flex-shrink-0 ${
                        pickerCategory === "all"
                          ? "bg-orange-600 text-white"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setPickerCategory(cat.id)}
                        className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer flex-shrink-0 ${
                          pickerCategory === cat.id
                            ? "bg-orange-600 text-white"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Products List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {modalProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <Package size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-[14px] font-medium m-0">No products found</p>
                    <p className="text-[12px] text-slate-400 mt-1 m-0">
                      Try adjusting your search query or category filter.
                    </p>
                  </div>
                ) : (
                  modalProducts.map((product) => {
                    const isSelected = items.some(
                      (item) => item.product_id === product.id,
                    );
                    const imageUrl = getProductImage(product);
                    const price = getProductPrice(product);

                    return (
                      <div
                        key={product.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isSelected
                            ? "bg-orange-50/40 border-orange-200"
                            : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        {/* Image Thumbnail */}
                        <div className="w-12 h-12 min-w-12 min-h-12 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package size={18} className="text-slate-300" />
                          )}
                        </div>

                        {/* Title & SKU & Category */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-semibold text-slate-900 truncate m-0">
                            {product.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono text-slate-600">
                              {product.sku}
                            </span>
                            {product.category?.name && (
                              <span>• {product.category.name}</span>
                            )}
                            <span className="text-emerald-600 font-medium">
                              • {product.available_stock} in stock
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-[13px] font-semibold text-slate-900">
                            ₹{price.toLocaleString("en-IN")}
                          </div>
                        </div>

                        {/* Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleProductInBundle(product)}
                          className={`h-9 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 ${
                            isSelected
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                              : "bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 shadow-2xs"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check size={14} />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[13px] text-slate-600">
                  <strong>{items.length}</strong> product(s) selected in this bundle
                </span>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="px-5 py-2 text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="workspace-list space-y-6">
      <ProductManagementHeader
        title="Combos"
      
        breadcrumb={["Product Management", "Combos"]}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 h-10 px-4 text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-lg shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer"
          >
            <Plus size={16} /> Add Combo
          </button>
        }
      />

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-5">
        <FilterBar>
          <input
            aria-label="Search combos"
            placeholder="Search combos by name..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 px-3.5 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 focus:bg-white"
          />
          <button
            className="inline-flex items-center gap-1.5 h-10 px-3.5 text-[13px] font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            onClick={() => setQuery("")}
            type="button"
          >
            <RotateCcw size={15} /> Reset
          </button>
        </FilterBar>

        <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Combo</th>
                <th className="py-3 px-4">Products in Bundle</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right" aria-label="Actions">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {filteredCombos.map((combo) => (
                <tr
                  key={combo.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    {combo.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium text-[12px]">
                      <Package size={13} className="text-slate-400" />
                      <span>{combo.items.length} product(s)</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge active={Boolean(combo.is_active)} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${combo.name}`}
                      title={`Edit ${combo.name}`}
                      onClick={() => openEdit(combo)}
                    >
                      <PencilLine size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCombos.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            No combos match this search.
          </div>
        )}

        <p className="text-[12px] text-slate-400 m-0">
          {filteredCombos.length} of {combos.length} loaded combos shown.
        </p>
      </section>
    </section>
  );
}
