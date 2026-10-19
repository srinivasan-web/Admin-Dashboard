import { useEffect, useRef, useState } from "react";
import {
  cachedApiRequest,
  errorMessage,
  type ApiResponse,
} from "../../api/client";
import { ProductManagementHeader } from "./ProductManagementHeader";
import { WarehouseMasterPanel } from "./WarehouseMasterPanel";
import { setWarehouseStock } from "./catalogApi";
import type { WarehouseLocation } from "./types";

type Warehouse = WarehouseLocation;
type Balance = {
  id: string;
  name: string;
  sku: string;
  warehouses: Array<{
    warehouse_id: string;
    available: number;
  }>;
};
type Snapshot = {
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
};
type Page<T> = {
  data: T[];
  current_page?: number;
  last_page?: number;
  total?: number;
};
const emptyFilters = {
  search: "",
  warehouse_id: "",
};

export function InventoryPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selected, setSelected] = useState<{
    product: Balance;
    warehouse: Warehouse;
  }>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [quantity, setQuantity] = useState("");
  const [stockOperation, setStockOperation] = useState<
    "adjustment" | "stock_in" | "stock_out"
  >("adjustment");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void cachedApiRequest<ApiResponse<Warehouse[]>>("/warehouses", {
      signal: controller.signal,
      force: refresh > 0,
    })
      .then((response) => {
        if (active) setWarehouses(response.data);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let inFlight = false;
    const version = ++latest.current;
    setLoading(true);
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value),
      ),
      view: "matrix",
      page: String(page),
    });
    async function load(force = false) {
      if (inFlight || saving || document.hidden) return;
      inFlight = true;
      try {
        if (selected?.product) {
          const stock = await cachedApiRequest<ApiResponse<Snapshot>>(
            `/warehouses/${selected.warehouse.id}/products/${selected.product.id}/stock?include_history=0`,
            { signal: controller.signal, force },
          );
          if (!active || version !== latest.current) return;
          setSnapshot(stock.data);
        } else {
          const response = await cachedApiRequest<Page<Balance>>(
            `/warehouse-stocks?${query}`,
            { signal: controller.signal, force },
          );
          if (!active || version !== latest.current) return;
          setBalances(response.data);
          setPagination({
            current_page: response.current_page!,
            last_page: response.last_page!,
            total: response.total!,
          });
        }
        setError(undefined);
      } catch (reason) {
        if (active) setError(errorMessage(reason));
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    const debounce = window.setTimeout(() => void load(refresh > 0), 250);
    const timer = window.setInterval(() => void load(true), 15000);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(debounce);
      window.clearInterval(timer);
    };
  }, [filters, page, selected, refresh, saving]);

  async function saveQuantity() {
    if (!selected?.product || saving || quantity === "") return;
    setSaving(true);
    ++latest.current;
    try {
      await setWarehouseStock(
        selected.warehouse.id,
        selected.product.id,
        Number(quantity),
        stockOperation,
      );
      setNotice(
        `Stock action recorded for ${selected.product.name} at ${selected.warehouse.name}.`,
      );
      setQuantity("");
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  function changeFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  const visibleWarehouses = warehouses.filter(
    (warehouse) =>
      !filters.warehouse_id || warehouse.id === filters.warehouse_id,
  );

  function openProductStock(product: Balance) {
    const warehouse =
      visibleWarehouses.find((candidate) =>
        product.warehouses.some(
          (stock) =>
            stock.warehouse_id === candidate.id && stock.available > 0,
        ),
      ) ?? visibleWarehouses[0];
    if (!warehouse) return;
    setSelected({ product, warehouse });
    setSnapshot(undefined);
    setNotice(undefined);
    setError(undefined);
    setLoading(true);
    setQuantity("");
    setStockOperation("adjustment");
  }
  return (
    <section className="workspace-list">
      <ProductManagementHeader
        title={
          selected
            ? `${selected.product?.name} — ${selected.warehouse.name}`
            : "Warehouse stock"
        }
        breadcrumb={["Stock", "Warehouse stock"]}
        actions={
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh
          </button>
        }
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {loading && <p role="status">Refreshing inventory…</p>}
      {selected ? (
        <>
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => {
              setSelected(undefined);
              setSnapshot(undefined);
              setNotice(undefined);
            }}
          >
            Back to warehouse stock
          </button>
          {snapshot && (
            <section className="card">
              <div className="mb-6 grid gap-4 border-b border-neutral-200 pb-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-neutral-500">Warehouse</p>
                  <h2>{selected.warehouse.name}</h2>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Product</p>
                  <h2>{selected.product?.name}</h2>
                  <p className="text-sm text-neutral-500">
                    SKU: {selected.product?.sku}
                  </p>
                </div>
              </div>
              <label className="mb-4 block">
                Warehouse
                <select
                  value={selected.warehouse.id}
                  disabled={saving}
                  onChange={(event) => {
                    const warehouse = warehouses.find(
                      (candidate) => candidate.id === event.target.value,
                    );
                    if (warehouse) {
                      setSelected({ product: selected.product, warehouse });
                      setSnapshot(undefined);
                    }
                  }}
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <p>
                  Physical: <strong>{snapshot.quantity}</strong>
                </p>
                <p>
                  Reserved (read-only):{" "}
                  <strong>{snapshot.reserved_quantity}</strong>
                </p>
                <p>
                  Available (read-only):{" "}
                  <strong>{snapshot.available_quantity}</strong>
                </p>
              </div>
              <form
                className="mt-6 grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveQuantity();
                }}
              >
                <label>
                  Stock action
                  <select
                    value={stockOperation}
                    disabled={saving}
                    onChange={(event) =>
                      setStockOperation(
                        event.target.value as typeof stockOperation,
                      )
                    }
                  >
                    <option value="adjustment">Set physical quantity</option>
                    <option value="stock_in">Stock in</option>
                    <option value="stock_out">Stock out</option>
                  </select>
                </label>
                <label>
                  {stockOperation === "adjustment"
                    ? "New physical quantity"
                    : "Quantity"}
                  <input
                    required
                    type="number"
                    min={stockOperation === "adjustment" ? "0" : "1"}
                    step="1"
                    aria-describedby="stock-adjustment-help"
                    value={quantity}
                    disabled={saving}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <button disabled={saving || loading || quantity === ""}>
                  {saving ? "Saving…" : "Save stock"}
                </button>
                <p
                  id="stock-adjustment-help"
                  className="text-sm text-neutral-600 sm:col-span-3"
                >
                  {stockOperation === "adjustment"
                    ? "Enter the new total physical quantity."
                    : "Enter the quantity to move; the server validates and records the movement."}{" "}
                  Reserved and available balances are returned by the server.
                </p>
              </form>
            </section>
          )}
        </>
      ) : (
        <>
          <details className="card">
            <summary className="cursor-pointer font-semibold">
              Manage warehouses
            </summary>
            <WarehouseMasterPanel
              warehouses={warehouses}
              onSaved={() => setRefresh((value) => value + 1)}
            />
          </details>
          <section className="card">
            <div className="mb-6 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
              <label>
                Warehouse
                <select
                  aria-label="Warehouse filter"
                  value={filters.warehouse_id}
                  onChange={(event) =>
                    changeFilter("warehouse_id", event.target.value)
                  }
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Product / SKU
                <input
                  aria-label="Product name or SKU"
                  placeholder="Search product name or SKU"
                  value={filters.search}
                  onChange={(event) =>
                    changeFilter("search", event.target.value)
                  }
                />
              </label>
              <button
                className="secondary"
                onClick={() => {
                  setFilters(emptyFilters);
                  setPage(1);
                }}
              >
                Reset
              </button>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product / SKU</th>
                    {visibleWarehouses.map((warehouse) => (
                      <th key={warehouse.id}>{warehouse.name}</th>
                    ))}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((row, index) => (
                    <tr key={row.id}>
                      <td>{(pagination.current_page - 1) * 20 + index + 1}</td>
                      <td>
                        <strong>{row.name}</strong>
                        <span className="block text-xs text-neutral-500">
                          {row.sku}
                        </span>
                      </td>
                      {visibleWarehouses.map((warehouse) => {
                        const stock = row.warehouses.find(
                          (stock) => stock.warehouse_id === warehouse.id,
                        );
                        return (
                          <td key={warehouse.id}>
                            {stock && stock.available > 0
                              ? stock.available
                              : "—"}
                          </td>
                        );
                      })}
                      <td>
                        <button
                          className="secondary"
                          disabled={visibleWarehouses.length === 0}
                          onClick={() => openProductStock(row)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && (!balances.length || !warehouses.length) && (
                <p className="empty-state">
                  No warehouse stock matches these filters.
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>
                {pagination.total} products · Page {pagination.current_page} of{" "}
                {pagination.last_page}
              </span>
              <button
                className="secondary"
                disabled={page >= pagination.last_page}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
