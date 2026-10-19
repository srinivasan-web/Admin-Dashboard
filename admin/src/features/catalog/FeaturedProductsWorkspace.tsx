import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ImageOff,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui";
import {
  addMerchandisingProduct,
  loadEligibleMerchandisingProducts,
  loadMerchandising,
  removeMerchandisingProduct,
  updateMerchandisingProduct,
  type MerchandisingItem,
  type MerchandisingPlacement,
} from "./catalogApi";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { CatalogMasters, Product } from "./types";

const gridClass =
  "grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
const inputClass =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-200";
const outlineButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 text-sm font-semibold text-white transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
const formatPrice = (value: number) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;

function ProductCard({
  product,
  selected = false,
  children,
}: {
  product: Product;
  selected?: boolean;
  children: ReactNode;
}) {
  const image =
    product.images?.find((item) => item.is_primary) ?? product.images?.[0];
  const mrp = Number(product.price?.mrp);
  const sale = product.price?.sale == null ? null : Number(product.price.sale);
  const sellingPrice = sale !== null && Number.isFinite(sale) ? sale : mrp;

  return (
    <article
      className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-within:ring-2 focus-within:ring-orange-200 ${selected ? "border-orange-300 bg-orange-50/30" : "border-slate-200 hover:border-slate-300"}`}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center border-b border-slate-100 bg-slate-50 p-3">
        {image ? (
          <img
            src={image.url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex flex-col items-center gap-2 text-slate-400"
            aria-label="No product image"
          >
            <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-xs">No image</span>
          </div>
        )}
        {selected && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200">
            <Check size={12} aria-hidden="true" /> Assigned
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <h3
            className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-900"
            title={product.name}
          >
            {product.name}
          </h3>
          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={product.sku}
          >
            SKU {product.sku}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
          <span
            className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1"
            title={product.product_type.name}
          >
            {product.product_type.name}
          </span>
          <span
            className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1"
            title={product.category.name}
          >
            {product.category.name}
          </span>
        </div>
        <div className="mt-auto flex min-h-8 flex-wrap items-baseline gap-x-2 gap-y-1">
          {Number.isFinite(sellingPrice) ? (
            <strong className="text-sm text-slate-900">
              {formatPrice(sellingPrice)}
            </strong>
          ) : (
            <span className="text-xs text-slate-500">Price unavailable</span>
          )}
          {sale !== null &&
            Number.isFinite(sale) &&
            Number.isFinite(mrp) &&
            mrp > sale && (
              <span
                className="text-xs text-slate-400 line-through"
                aria-label={`MRP ${formatPrice(mrp)}`}
              >
                {formatPrice(mrp)}
              </span>
            )}
        </div>
        {children}
      </div>
    </article>
  );
}

export function FeaturedProductsWorkspace({
  placement,
  masters,
}: {
  placement: MerchandisingPlacement;
  masters: CatalogMasters;
}) {
  const [items, setItems] = useState<MerchandisingItem[]>([]);
  const [eligible, setEligible] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState<string>();
  const busyRef = useRef(false);
  const [configuredLoading, setConfiguredLoading] = useState(true);
  const [eligibleLoading, setEligibleLoading] = useState(true);
  const [configuredError, setConfiguredError] = useState<string>();
  const [eligibleError, setEligibleError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const title =
    placement === "featured" ? "Choose Your Product" : "Explore Bestsellers";

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Candidate filters never reload or clear the configured collection.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setConfiguredLoading(true);
    setConfiguredError(undefined);
    void loadMerchandising(placement, {
      signal: controller.signal,
      force: reloadKey > 0,
    })
      .then((response) => {
        if (active) setItems(response.data.items);
      })
      .catch((reason) => {
        if (active) setConfiguredError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setConfiguredLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [placement, reloadKey]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setEligibleLoading(true);
    setEligibleError(undefined);
    void loadEligibleMerchandisingProducts(
      placement,
      { search, product_type_id: productTypeId, category_id: categoryId, page },
      { signal: controller.signal, force: reloadKey > 0 },
    )
      .then((response) => {
        if (!active) return;
        setEligible(response.data);
        setLastPage(response.meta.last_page);
        setTotal(response.meta.total);
      })
      .catch((reason) => {
        if (active) setEligibleError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setEligibleLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [placement, search, productTypeId, categoryId, page, reloadKey]);

  async function change(
    productId: string,
    action: () => Promise<unknown>,
    message: string,
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(productId);
    setActionError(undefined);
    setNotice(undefined);
    try {
      await action();
      const response = await loadMerchandising(placement, { force: true });
      setItems(response.data.items);
      setNotice(message);
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusyId(undefined);
    }
  }

  function resetFilters() {
    setQuery("");
    setSearch("");
    setProductTypeId("");
    setCategoryId("");
    setPage(1);
  }

  const assigned = new Set(items.map((item) => item.product.id));
  const hasFilters = Boolean(query || productTypeId || categoryId);

  return (
    <section className="workspace-list featured-workspace">
      <ProductManagementHeader
        title={title}
        breadcrumb={["Featured Products", title]}
        description={
          placement === "featured"
            ? "Choose products for the featured collection."
            : "Curate the Explore Bestsellers collection."
        }
      />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Configured products</h2>
            {!configuredLoading && !configuredError && (
              <p className="mt-1 text-xs text-slate-500">
                {items.length} assigned
              </p>
            )}
          </div>
        </div>
        {configuredLoading ? (
          <LoadingState label="Loading configured products…" />
        ) : configuredError ? (
          <ErrorState
            message={configuredError}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : items.length ? (
          <div className={gridClass}>
            {items.map((item) => (
              <ConfiguredProduct
                key={item.product.id}
                item={item}
                busy={Boolean(busyId)}
                saving={busyId === item.product.id}
                onSave={(data) =>
                  void change(
                    item.product.id,
                    () =>
                      updateMerchandisingProduct(
                        placement,
                        item.product.id,
                        data,
                      ),
                    "Placement updated.",
                  )
                }
                onRemove={() => {
                  if (
                    window.confirm(`Remove ${item.product.name} from ${title}?`)
                  ) {
                    void change(
                      item.product.id,
                      () =>
                        removeMerchandisingProduct(placement, item.product.id),
                      "Product removed.",
                    );
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No products assigned">
            Use the product catalog below to add your first product.
          </EmptyState>
        )}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Add products</h2>
            {!eligibleLoading && !eligibleError && (
              <p className="mt-1 text-xs text-slate-500" role="status">
                {total} matching {total === 1 ? "product" : "products"}
              </p>
            )}
          </div>
        </div>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(150px,200px)_minmax(150px,200px)_auto]">
          <input
            aria-label="Search eligible products"
            className={inputClass}
            placeholder="Search product name or SKU"
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Product type"
            className={inputClass}
            value={productTypeId}
            onChange={(event) => {
              setProductTypeId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All product types</option>
            {masters.productTypes
              .filter((type) => type.is_active)
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
          </select>
          <select
            aria-label="Category"
            className={inputClass}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {masters.categories
              .filter((category) => category.is_active)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className={outlineButton}
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
        </div>
        {eligibleLoading ? (
          <LoadingState label="Loading products…" />
        ) : eligibleError ? (
          <ErrorState
            message={eligibleError}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : eligible.length ? (
          <div className={gridClass}>
            {eligible.map((product) => {
              const selected = assigned.has(product.id);
              const saving = busyId === product.id;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  selected={selected}
                >
                  <button
                    type="button"
                    className={`${primaryButton} w-full`}
                    disabled={selected || Boolean(busyId)}
                    onClick={() =>
                      void change(
                        product.id,
                        () => addMerchandisingProduct(placement, product.id),
                        "Product added.",
                      )
                    }
                  >
                    {saving ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : selected ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Plus size={16} aria-hidden="true" />
                    )}
                    {saving ? "Adding…" : selected ? "Added" : "Add product"}
                  </button>
                </ProductCard>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No matching products">
            {hasFilters
              ? "Try another search or reset the filters."
              : "No active products are available to add."}
          </EmptyState>
        )}
        {!eligibleLoading && !eligibleError && lastPage > 1 && (
          <nav
            aria-label="Product pages"
            className="mt-5 flex items-center justify-end gap-3 text-sm text-slate-600"
          >
            <button
              type="button"
              className={outlineButton}
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {lastPage}
            </span>
            <button
              type="button"
              className={outlineButton}
              disabled={page >= lastPage}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}

function ConfiguredProduct({
  item,
  busy,
  saving,
  onSave,
  onRemove,
}: {
  item: MerchandisingItem;
  busy: boolean;
  saving: boolean;
  onSave: (data: { sort_order: number; is_active: boolean }) => void;
  onRemove: () => void;
}) {
  const [sortOrder, setSortOrder] = useState(item.sort_order);
  const [active, setActive] = useState(item.is_active);
  useEffect(() => {
    setSortOrder(item.sort_order);
    setActive(item.is_active);
  }, [item.sort_order, item.is_active]);

  return (
    <ProductCard product={item.product}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-slate-100 pt-3">
        <label className="min-w-0 text-xs font-medium text-slate-600">
          Display order
          <input
            aria-label={`Order for ${item.product.name}`}
            className={`${inputClass} mt-1`}
            type="number"
            min="0"
            step="1"
            value={sortOrder}
            onChange={(event) => setSortOrder(Number(event.target.value))}
          />
        </label>
        <label className="flex min-h-11 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            className="accent-orange-600 focus-visible:outline-2 focus-visible:outline-orange-500"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={
            busy ||
            !Number.isInteger(sortOrder) ||
            sortOrder < 0 ||
            (sortOrder === item.sort_order && active === item.is_active)
          }
          onClick={() => onSave({ sort_order: sortOrder, is_active: active })}
        >
          {saving && (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          )}
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={outlineButton}
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove ${item.product.name}`}
          title="Remove product"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </ProductCard>
  );
}
