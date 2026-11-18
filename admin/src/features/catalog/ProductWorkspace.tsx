import { useEffect, useState } from "react";
import {
  ChevronRight,
  Download,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import { deleteProduct, exportProducts, loadProduct } from "./catalogApi";
import { ProductDetail } from "./ProductDetail";
import { ProductForm } from "./ProductForm";
import { ProductManagementHeader } from "./ProductManagementHeader";
import { MasterForm } from "./MasterForm";
import type {
  CatalogAttribute,
  Product,
  WarehouseLocation,
  CatalogMasters,
} from "./types";
import type { ProductListPage } from "./CatalogPage";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  FilterBar,
  StatusBadge,
} from "../../components/ui";
import {
  emptyMasters,
  useCatalogResource,
  useProductEditorData,
} from "./useCatalogData";
import type { ProductRouteMode } from "../../app/routes";

type Props = {
  pagination?: ProductListPage["meta"];
  queryParams: string;
  onQueryChange: (params: URLSearchParams) => void;
  listMasters: Pick<CatalogMasters, "productTypes" | "categories" | "hsnCodes">;
  filterError?: string;
  onRetryFilters: () => void;
  canManageInventory: boolean;
  products: Product[];
  notice?: string;
  onSaved: () => void;
  onRefresh: () => void;
  route?: { mode: ProductRouteMode; productId?: string };
  onRouteChange?: (mode: ProductRouteMode, productId?: string) => void;
};

export function ProductWorkspace({
  pagination,
  queryParams,
  onQueryChange,
  listMasters,
  filterError,
  onRetryFilters,
  canManageInventory,
  products,
  notice,
  onSaved,
  onRefresh,
  route,
  onRouteChange,
}: Props) {
  const params = new URLSearchParams(queryParams);
  const [query, setQuery] = useState(params.get("search") ?? "");
  const [productTypeId, setProductTypeId] = useState(
    params.get("product_type_id") ?? "all",
  );
  const [categoryId, setCategoryId] = useState(
    params.get("category_id") ?? "all",
  );
  const [hsnCodeId, setHsnCodeId] = useState(
    params.get("hsn_code_id") ?? "all",
  );
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [stock, setStock] = useState(params.get("stock") ?? "all");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  useEffect(() => {
    const current = new URLSearchParams(queryParams);
    setQuery(current.get("search") ?? "");
    setProductTypeId(current.get("product_type_id") ?? "all");
    setCategoryId(current.get("category_id") ?? "all");
    setHsnCodeId(current.get("hsn_code_id") ?? "all");
    setStatus(current.get("status") ?? "all");
    setStock(current.get("stock") ?? "all");
    setSort(current.get("sort") ?? "newest");
  }, [queryParams]);
  const [selected, setSelected] = useState<Product>();
  const [editing, setEditing] = useState<Product>();
  const [creating, setCreating] = useState(route?.mode === "create");
  const [actionError, setActionError] = useState<string>();
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productReload, setProductReload] = useState(0);
  const [deletingId, setDeletingId] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const editor = useProductEditorData(
    creating || Boolean(editing) || Boolean(selected),
    false,
  );
  const coreMasters = editor.data?.masters;
  const canCreate = Boolean(
    coreMasters?.brands.length &&
    coreMasters.productTypes.some((item) => item.is_active) &&
    coreMasters.categories.some((item) => item.is_active),
  );
  const relatedEnabled =
    Boolean(editor.data) &&
    ((creating && canCreate) || Boolean(editing) || Boolean(selected));
  const attributeQuery = useCatalogResource<CatalogAttribute[]>(
    relatedEnabled ? "/attributes" : null,
  );
  const warehouseQuery = useCatalogResource<WarehouseLocation[]>(
    relatedEnabled && canManageInventory ? "/warehouses" : null,
  );
  const masters = {
    ...(editor.data?.masters ?? emptyMasters),
    warehouses: warehouseQuery.data ?? [],
  };
  // Existing inactive definitions remain visible even while masters refresh.
  const attributes = [
    ...new Map([
      ...(editing?.specifications ?? selected?.specifications ?? []).map(
        (item) => [item.attribute.id, item.attribute] as const,
      ),
      ...(attributeQuery.data ?? []).map((item) => [item.id, item] as const),
    ]).values(),
  ];
  const listProductTypes = listMasters.productTypes;

  useEffect(() => {
    function refreshed(product?: Product): Product | undefined {
      if (!product) return undefined;
      const listed = products.find((candidate) => candidate.id === product.id);
      // List resources omit detail relationships. Keep the loaded detail/edit
      // resource when the list refreshes after a save.
      return listed ? { ...listed, ...product, available_stock: listed.available_stock } : product;
    }

    setEditing(refreshed);
    setSelected(refreshed);
  }, [products]);

  useEffect(() => {
    let active = true;
    const mode = route?.mode ?? "list";
    const id = route?.productId;

    if (mode === "list") {
      setCreating(false);
      setEditing(undefined);
      setSelected(undefined);
      return;
    }
    if (mode === "create") {
      setCreating(true);
      setEditing(undefined);
      setSelected(undefined);
      return;
    }
    if (!id) return;

    setActionError(undefined);
    setLoadingProduct(true);
    void loadProduct(id)
      .then((response) => {
        if (!active) return;
        setCreating(false);
        if (mode === "edit") {
          setSelected(undefined);
          setEditing(response.data);
        } else {
          setEditing(undefined);
          setSelected(response.data);
        }
      })
      .catch((reason) => {
        if (active) setActionError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoadingProduct(false);
      });

    return () => {
      active = false;
    };
  }, [route?.mode, route?.productId, productReload]);

  const filtered = products;
  function applyFilters() {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({
      search: query.trim(),
      product_type_id: productTypeId,
      category_id: categoryId,
      hsn_code_id: hsnCodeId,
      status,
      stock,
      sort,
    })) {
      if (value && value !== "all" && value !== "newest") next.set(key, value);
    }
    onQueryChange(next);
  }

  function closeForm() {
    setCreating(false);
    setEditing(undefined);
    onRouteChange?.("list");
  }
  function resetFilters() {
    setQuery("");
    setProductTypeId("all");
    setCategoryId("all");
    setHsnCodeId("all");
    setStatus("all");
    setStock("all");
    setSort("newest");
    onQueryChange(new URLSearchParams());
  }
  async function saved(product: Product) {
    setCreating(false);
    setEditing(undefined);
    setActionError(undefined);
    try {
      const response = await loadProduct(product.id);
      setSelected(response.data);
    } catch (reason) {
      // The write has succeeded; preserve the returned ProductResource when
      // the follow-up read cannot be completed.
      setSelected(product);
      setActionError(errorMessage(reason));
    }
    onRouteChange?.("detail", product.id);
    onSaved();
  }

  async function beginEdit(product: Product) {
    if (onRouteChange) {
      onRouteChange("edit", product.id);
      return;
    }
    setActionError(undefined);
    setLoadingProduct(true);
    try {
      const response = await loadProduct(product.id);
      setSelected(undefined);
      setEditing(response.data);
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setLoadingProduct(false);
    }
  }

  async function exportCsv() {
    setActionError(undefined);
    setExporting(true);
    try {
      const blob = await exportProducts({
        search: query,
        product_type_id: productTypeId,
        category_id: categoryId,
        hsn_code_id: hsnCodeId,
        status,
        stock,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "products.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setExporting(false);
    }
  }

  async function remove(product: Product) {
    if (
      deletingId ||
      !window.confirm(
        `Delete ${product.name}? It will be removed from the catalogue. Existing history will be retained.`,
      )
    )
      return;
    setActionError(undefined);
    setDeletingId(product.id);
    try {
      await deleteProduct(product.id);
      setSelected(undefined);
      if (route?.productId === product.id) onRouteChange?.("list");
      onSaved();
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setDeletingId(undefined);
    }
  }

  if (
    (route?.mode === "edit" && editing?.id !== route.productId) ||
    (route?.mode === "detail" && selected?.id !== route.productId)
  ) {
    const editingRoute = route.mode === "edit";
    return (
      <section className="workspace-form">
        <ProductManagementHeader
          title={editingRoute ? "Edit Product" : "Product Details"}
          breadcrumb={[
            "Product Management",
            "Products",
            editingRoute ? "Edit Product" : "Product Details",
          ]}
        />
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setSelected(undefined);
            closeForm();
          }}
        >
          Back to Products
        </button>
        {actionError ? (
          <ErrorState
            message={actionError}
            onRetry={() => setProductReload((value) => value + 1)}
          />
        ) : (
          <LoadingState label="Loading product…" />
        )}
      </section>
    );
  }

  if (creating || editing) {
    if (!editor.data)
      return (
        <section className="workspace-form">
          <ProductManagementHeader
            title={
              editing || route?.mode === "edit" ? "Edit Product" : "Add Product"
            }
            breadcrumb={[
              "Product Management",
              "Products",
              editing || route?.mode === "edit"
                ? "Edit Product"
                : "Add Product",
            ]}
          />
          <button type="button" className="secondary" onClick={closeForm}>
            Back to Products
          </button>
          {editor.error ? (
            <ErrorState message={editor.error} onRetry={editor.refresh} />
          ) : (
            <LoadingState label="Loading product form…" />
          )}
        </section>
      );
    const hasProductType = masters.productTypes.some((item) => item.is_active);
    const hasCategory = masters.categories.some((item) => item.is_active);
    if (masters.brands.length === 0 || !hasProductType || !hasCategory)
      return (
        <section className="workspace-form">
          <button type="button" className="secondary" onClick={closeForm}>
            Back to Products
          </button>
          <ProductManagementHeader
            title="Products"
            description="Products require an existing Brand, active Product Type, active Category, and price."
          />
          <section className="card">
            <h2>Classification required</h2>
          
          </section>
          {masters.brands.length === 0 && (
            <MasterForm
              path="brands"
              title="Brand"
              onSaved={() => {
                editor.refresh();
                onSaved();
              }}
              onCancel={closeForm}
            />
          )}
        </section>
      );
    return (
      <section className="workspace-form">
        <ProductManagementHeader
          title={editing ? "Edit Product" : "Add Product"}
          breadcrumb={[
            "Product Management",
            "Products",
            editing ? "Edit Product" : "Add Product",
          ]}
          description={
            editing
              ? ""
              : ""
          }
        />
        <ProductForm
          key={editing?.id ?? "new"}
          mode={editing ? "edit" : "create"}
          product={editing}
          masters={masters}
          attributes={attributes}
          onAttributesChanged={attributeQuery.refresh}
          canManageInventory={canManageInventory}
          attributesLoading={
            attributeQuery.data === undefined && !attributeQuery.error
          }
          attributesError={attributeQuery.error}
          onRetryAttributes={attributeQuery.refresh}
          warehousesLoading={
            canManageInventory &&
            warehouseQuery.data === undefined &&
            !warehouseQuery.error
          }
          warehousesError={warehouseQuery.error}
          onRetryWarehouses={warehouseQuery.refresh}
          onSaved={saved}
          onCancel={closeForm}
        />
      </section>
    );
  }

  if (selected) {
    if (!editor.data) {
      return (
        <section className="workspace-list">
          <button
            type="button"
            className="secondary"
            onClick={() => setSelected(undefined)}
          >
            Back to Products
          </button>
          {editor.error ? (
            <ErrorState message={editor.error} onRetry={editor.refresh} />
          ) : (
            <LoadingState label="Loading product details…" />
          )}
        </section>
      );
    }
    return (
      <section className="workspace-list">
        <ProductDetail
          product={selected}
          masters={masters}
          onBack={() => {
            setSelected(undefined);
            onRouteChange?.("list");
          }}
          onEdit={() => void beginEdit(selected)}
          attributes={attributes}
        />
      </section>
    );
  }

  return (
    <section className="workspace-list space-y-5">
      <ProductManagementHeader
        title="Products"
        breadcrumb={["Product Management", "Products"]}
        description=""
        actions={
          <div className="flex items-center gap-2.5">
         
            <button
              className="secondary"
              onClick={() => void exportCsv()}
              disabled={exporting}
            >
              <Download size={17} /> {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <button
              className="add-product-btn"
              onClick={() => {
                if (onRouteChange) onRouteChange("create");
                else setCreating(true);
              }}
            >
              <Plus size={18} /> Add Product
            </button>
          </div>
        }
      />
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {loadingProduct && (
        <p className="loading-state" role="status">
          Loading product…
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="card p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <FilterBar className="mb-4">
          <input
            aria-label="Search products"
            maxLength={100}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyFilters();
              }
            }}
            placeholder="Search name, SKU, or ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 min-w-[200px] h-[38px] px-3.5 bg-white border border-slate-200/80 rounded-lg text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
          {filtersOpen && (
            <>
              <select
                aria-label="Filter products by type"
                value={productTypeId}
                onChange={(event) => setProductTypeId(event.target.value)}
                className="h-[38px] px-3 bg-white border border-slate-200/80 rounded-lg text-[13px] text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              >
                <option value="all">All types</option>
                {listProductTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter products by status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
                className="h-[38px] px-3 bg-white border border-slate-200/80 rounded-lg text-[13px] text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </>
          )}
          <button
            className="filter-toggle h-[38px] px-3.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-200/60 hover:bg-orange-100 transition-colors shadow-none cursor-pointer"
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter size={15} aria-hidden="true" /> Filter
          </button>
          <button
            type="button"
            className="secondary h-[38px] px-3.5 rounded-lg text-[13px] font-medium text-slate-600 bg-white border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-none cursor-pointer"
            onClick={resetFilters}
          >
            Reset
          </button>
        </FilterBar>
        {filterError && (
          <ErrorState message={filterError} onRetry={onRetryFilters} />
        )}
       

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[60px]" />
              <col className="min-w-[220px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-[200px]" />
              <col className="w-[100px]" />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 text-center">Image</th>
                <th className="py-3 px-3 text-left">Product</th>
                <th className="py-3 px-3 text-left">SKU</th>
                <th className="py-3 px-3 text-left">Type</th>
                <th className="py-3 px-3 text-left">Stock</th>
                <th className="py-3 px-3 text-right">MRP</th>
                <th className="py-3 px-3 text-right">Sale Price</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  {/* 1. IMAGE */}
                  <td className="py-3 px-3 align-middle text-center">
                    <div className="w-11 h-11 min-w-11 min-h-11 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1 overflow-hidden mx-auto">
                      {product.images?.[0] ? (
                        <img
                          className="w-full h-full object-contain"
                          src={product.images[0].url}
                          alt=""
                        />
                      ) : (
                        <span className="text-[12px] text-slate-300 font-mono">
                          —
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. PRODUCT NAME */}
                  <td className="py-3 px-3 align-middle text-left">
                    <div className="flex flex-col">
                      <span
                        className="text-[13px] font-semibold text-slate-900 leading-[18px] line-clamp-2 hover:text-orange-600 transition-colors cursor-pointer"
                        onClick={() => void beginEdit(product)}
                      >
                        {product.name}
                      </span>
                      {product.group_name && (
                        <span className="text-[11px] text-slate-400 leading-[14px] mt-0.5 truncate">
                          {product.group_name}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 3. SKU */}
                  <td className="py-3 px-3 align-middle text-left">
                    <span className="text-[12px] font-mono text-slate-600 font-medium bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/60 inline-block">
                      {product.sku}
                    </span>
                  </td>

                  {/* 4. TYPE */}
                  <td className="py-3 px-3 align-middle text-left">
                    <span className="text-[13px] font-medium text-slate-700">
                      {product.product_type.name}
                    </span>
                  </td>

                  {/* 5. STOCK (Available / By Warehouse) */}
                  <td className="py-3 px-3 align-middle text-left">
                    {product.inventory ? (
                      <div className="flex flex-col gap-1 text-left min-w-[170px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[13px] font-semibold leading-[18px] ${
                              product.inventory.available > 0
                                ? "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                product.inventory.available > 0
                                  ? "bg-emerald-500"
                                  : "bg-rose-500"
                              }`}
                            />
                            {product.inventory.available > 0
                              ? `${product.inventory.available} Available`
                              : "Out of Stock"}
                          </span>
                        </div>
                        {product.inventory.warehouses.length > 0 && (
                          <details className="group mt-0.5">
                            <summary className="cursor-pointer text-[11px] font-medium text-orange-600 hover:text-orange-700 list-none flex items-center gap-1 select-none">
                              <ChevronRight
                                size={12}
                                className="transition-transform group-open:rotate-90 text-orange-500 flex-shrink-0"
                              />
                              <span>
                                By warehouse (
                                {product.inventory.warehouses.length})
                              </span>
                            </summary>
                            <ul className="mt-1 pl-2 border-l-2 border-orange-200/80 space-y-1 text-[11px] text-slate-600 max-h-24 overflow-y-auto custom-scrollbar">
                              {product.inventory.warehouses.map((warehouse) => (
                                <li
                                  key={warehouse.warehouse_id}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="truncate text-slate-600">
                                    {warehouse.warehouse_name}:
                                  </span>
                                  <span
                                    className={
                                      warehouse.available > 0
                                        ? "text-emerald-600 font-semibold flex-shrink-0"
                                        : "text-slate-400 flex-shrink-0"
                                    }
                                  >
                                    {warehouse.available > 0
                                      ? `${warehouse.available} avail`
                                      : "0 avail"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-400 italic">
                        Stock unavailable
                      </span>
                    )}
                  </td>

                  {/* 6. MRP */}
                  <td className="py-3 px-3 align-middle text-right">
                    <span
                      className={`text-[13px] font-medium ${
                        product.price.sale
                          ? "text-slate-400 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      ₹{product.price.mrp}
                    </span>
                  </td>

                  {/* 7. SALE PRICE */}
                  <td className="py-3 px-3 align-middle text-right">
                    <span
                      className={`text-[13px] font-bold ${
                        product.price.sale ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {product.price.sale ? `₹${product.price.sale}` : "—"}
                    </span>
                  </td>

                  {/* 8. STATUS */}
                  <td className="py-3 px-3 align-middle text-center">
                    <div className="flex justify-center">
                      <StatusBadge active={product.is_active} size="sm" />
                    </div>
                  </td>

                  {/* 9. ACTIONS */}
                  <td className="py-3 px-3 align-middle text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        className="w-8 h-8 min-w-8 min-h-8 p-0 rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/50 flex items-center justify-center transition-all shadow-none"
                        title={`Edit ${product.name}`}
                        aria-label={`Edit ${product.name}`}
                        onClick={() => void beginEdit(product)}
                        disabled={loadingProduct}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="w-8 h-8 min-w-8 min-h-8 p-0 rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 flex items-center justify-center transition-all shadow-none"
                        title={`Delete ${product.name}`}
                        aria-label={`Delete ${product.name}`}
                        disabled={Boolean(deletingId) || loadingProduct}
                        aria-busy={deletingId === product.id}
                        onClick={() => void remove(product)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Transformation (md:hidden) */}
        <div className="md:hidden flex flex-col gap-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-3"
            >
              {/* Top: Image + Name + SKU + Status */}
              <div className="flex items-start gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 min-w-12 min-h-12 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].url}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[12px] text-slate-300 font-mono">
                        —
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-[14px] font-semibold text-slate-900 leading-tight truncate hover:text-orange-600 cursor-pointer"
                      onClick={() => void beginEdit(product)}
                    >
                      {product.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {product.sku}
                      </span>
                      <span className="text-[12px] text-slate-500 font-medium">
                        {product.product_type.name}
                      </span>
                    </div>
                  </div>
                </div>
                <StatusBadge active={product.is_active} size="sm" />
              </div>

              {/* Stock Section */}
              <div className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-100 flex flex-col gap-1">
                {product.inventory ? (
                  <>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500 font-medium">Stock:</span>
                      <span
                        className={`font-semibold ${
                          product.inventory.available > 0
                            ? "text-emerald-700"
                            : "text-rose-600"
                        }`}
                      >
                        {product.inventory.available > 0
                          ? `${product.inventory.available} Available`
                          : "Out of Stock"}
                      </span>
                    </div>
                    {product.inventory.warehouses.length > 0 && (
                      <details className="group mt-1 pt-1 border-t border-slate-200/60">
                        <summary className="cursor-pointer text-[11px] font-medium text-orange-600 hover:text-orange-700 list-none flex items-center gap-1 select-none">
                          <ChevronRight
                            size={12}
                            className="transition-transform group-open:rotate-90 text-orange-500"
                          />
                          <span>
                            By warehouse ({product.inventory.warehouses.length})
                          </span>
                        </summary>
                        <ul className="mt-1 pl-2 border-l-2 border-orange-200 space-y-1 text-[11px] text-slate-600">
                          {product.inventory.warehouses.map((warehouse) => (
                            <li
                              key={warehouse.warehouse_id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate">
                                {warehouse.warehouse_name}:
                              </span>
                              <span
                                className={
                                  warehouse.available > 0
                                    ? "text-emerald-600 font-semibold"
                                    : "text-slate-400"
                                }
                              >
                                {warehouse.available > 0
                                  ? `${warehouse.available} avail`
                                  : "0 avail"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    Stock unavailable
                  </span>
                )}
              </div>

              {/* Pricing & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-baseline gap-2">
                  {product.price.sale && (
                    <span className="text-[14px] font-bold text-slate-900">
                      ₹{product.price.sale}
                    </span>
                  )}
                  <span
                    className={`text-[12px] font-medium ${
                      product.price.sale
                        ? "text-slate-400 line-through"
                        : "text-slate-700 font-semibold text-[13px]"
                    }`}
                  >
                    ₹{product.price.mrp}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="w-8 h-8 p-0 rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:text-orange-600 hover:bg-orange-50/50 flex items-center justify-center transition-all shadow-none"
                    title={`Edit ${product.name}`}
                    aria-label={`Edit ${product.name}`}
                    onClick={() => void beginEdit(product)}
                    disabled={loadingProduct}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="w-8 h-8 p-0 rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50/50 flex items-center justify-center transition-all shadow-none"
                    title={`Delete ${product.name}`}
                    aria-label={`Delete ${product.name}`}
                    disabled={Boolean(deletingId) || loadingProduct}
                    aria-busy={deletingId === product.id}
                    onClick={() => void remove(product)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState>No products match the current filters.</EmptyState>
        )}
        <p className="record-count text-[12px] text-slate-400 mt-4">
          {pagination?.from ?? 0}–{pagination?.to ?? 0} of{" "}
          {pagination?.total ?? 0} products
        </p>
        {pagination && pagination.last_page > 1 && (
          <nav
            aria-label="Product pages"
            className="flex items-center justify-between gap-4 mt-4"
          >
            <button
              type="button"
              className="secondary"
              disabled={pagination.current_page <= 1}
              onClick={() => {
                const next = new URLSearchParams(queryParams);
                next.set("page", String(pagination.current_page - 1));
                onQueryChange(next);
              }}
            >
              Previous
            </button>
            <span>
              Page {pagination.current_page} of {pagination.last_page}
            </span>
            <button
              type="button"
              className="secondary"
              disabled={pagination.current_page >= pagination.last_page}
              onClick={() => {
                const next = new URLSearchParams(queryParams);
                next.set("page", String(pagination.current_page + 1));
                onQueryChange(next);
              }}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}
