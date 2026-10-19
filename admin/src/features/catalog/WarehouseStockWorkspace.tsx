import { useMemo, useState } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Warehouse,
  Search,
  X,
  Package,
  RotateCcw,
} from "lucide-react";
import { ProductOperations } from "./ProductOperations";
import { WarehouseMasterPanel } from "./WarehouseMasterPanel";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { CatalogMasters, Product } from "./types";

type Props = {
  products: Product[];
  masters: CatalogMasters;
  notice?: string;
  onSaved: () => void;
  onRefresh: () => void;
};

export function WarehouseStockWorkspace({
  products,
  masters,
  notice,
  onSaved,
  onRefresh,
}: Props) {
  const [query, setQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [selected, setSelected] = useState<Product>();

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const matchesQuery = `${product.name} ${product.sku}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        if (warehouseFilter === "all") return matchesQuery;
        const hasStock = product.inventory?.warehouses.some(
          (item) => item.warehouse_id === warehouseFilter,
        );
        return matchesQuery && hasStock;
      }),
    [products, query, warehouseFilter],
  );

  const visibleWarehouses = useMemo(
    () =>
      warehouseFilter === "all"
        ? masters.warehouses
        : masters.warehouses.filter((w) => w.id === warehouseFilter),
    [masters.warehouses, warehouseFilter],
  );

  /* ── Detail / Edit view ── */
  if (selected) {
    return (
      <section className="workspace-form">
        <ProductManagementHeader
          title={`${selected.name}`}
          breadcrumb={["Stock", "Warehouse Stock", selected.name]}
          actions={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
              onClick={() => setSelected(undefined)}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back to stock
            </button>
          }
        />

        {/* Product context banner */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
            <Package size={18} className="text-orange-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {selected.name}
            </p>
            <p className="text-xs text-slate-500">
              SKU:{" "}
              <span className="font-mono font-medium text-slate-700">
                {selected.sku}
              </span>
            </p>
          </div>
        </div>

        <ProductOperations
          product={selected}
          masters={masters}
          mode="stock"
          onSaved={onSaved}
        />
      </section>
    );
  }

  /* ── List / Overview view ── */
  return (
    <section className="workspace-list">
      {/* Page header */}
      <ProductManagementHeader
        title="Warehouse stock"
        breadcrumb={["Stock", "Warehouse Stock"]}
        description=""
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
            onClick={onRefresh}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh stock
          </button>
        }
      />

      {/* Notice banner */}
      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {notice}
        </div>
      )}

      {/* Warehouse master panel */}
      <WarehouseMasterPanel warehouses={masters.warehouses} onSaved={onSaved} />

      {/* Product Stock Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

        {/* Section heading */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <Warehouse size={15} className="text-slate-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                Product stock
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {filtered.length} of {products.length} products
              </p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3.5">
          {/* Search */}
          <div className="relative min-w-0 flex-1" style={{ maxWidth: 320 }}>
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              aria-label="Search products for stock"
              placeholder="Search product name or SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Warehouse filter */}
          <select
            aria-label="Filter by warehouse"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
          >
            <option value="all">All warehouses</option>
            {masters.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Reset */}
          {(query || warehouseFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setWarehouseFilter("all");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-10">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Product / SKU
                </th>
                {visibleWarehouses.map((w) => (
                  <th
                    key={w.id}
                    className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400"
                  >
                    {w.name}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product, index) => (
                <tr
                  key={product.id}
                  className="group transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-6 py-4 text-xs text-slate-400 tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-800 leading-tight">
                      {product.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {product.sku}
                    </p>
                  </td>
                  {visibleWarehouses.map((w) => {
                    const stockEntry = product.inventory?.warehouses.find(
                      (item) => item.warehouse_id === w.id,
                    );
                    const available = stockEntry?.available ?? 0;
                    return (
                      <td key={w.id} className="px-4 py-4 text-right tabular-nums">
                        {available > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1 font-semibold text-slate-700">
                            {available}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(product)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                    >
                      <Warehouse size={13} aria-hidden="true" />
                      View / Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <Package size={22} className="text-slate-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                No products found
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {query || warehouseFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "No products have been created yet."}
              </p>
            </div>
            {(query || warehouseFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setWarehouseFilter("all");
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={12} />
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Footer record count */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 px-6 py-3">
            <p className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-600">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-600">
                {products.length}
              </span>{" "}
              products
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
