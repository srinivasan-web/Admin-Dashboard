import { StockMovementHistory } from "./StockMovementHistory";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import {
  Warehouse,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  Save,
  RefreshCw,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Package,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import {
  loadWarehouseStock,
  setWarehouseStock,
  uploadProductImage,
} from "./catalogApi";
import type { CatalogMasters, Product, WarehouseStockSnapshot } from "./types";

export function ProductOperations({
  product,
  masters,
  onSaved,
  mode = "all",
  readOnly = false,
}: {
  product: Product;
  masters: CatalogMasters;
  onSaved: (product?: Product) => void;
  mode?: "all" | "media" | "stock";
  readOnly?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [image, setImage] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [stockOperation, setStockOperation] = useState<
    "adjustment" | "stock_in" | "stock_out"
  >("adjustment");
  const [stock, setStock] = useState<WarehouseStockSnapshot>();
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockReload, setStockReload] = useState(0);

  useEffect(() => {
    if (mode === "media") return;
    setWarehouseId((current) =>
      masters.warehouses.some((warehouse) => warehouse.id === current)
        ? current
        : (masters.warehouses[0]?.id ?? ""),
    );
  }, [masters.warehouses, mode]);

  useEffect(() => {
    if (mode === "media" || !warehouseId) {
      setStock(undefined);
      return;
    }
    let cancelled = false;
    setLoadingStock(true);
    setStock(undefined);
    setError(undefined);
    void loadWarehouseStock(warehouseId, product.id)
      .then((response) => {
        if (!cancelled) setStock(response.data);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoadingStock(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, product.id, warehouseId, stockReload]);

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    setImage(event.target.files?.[0]);
  }

  async function submitImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) {
      setError("Choose a JPG, PNG, or WebP image first.");
      return;
    }
    setError(undefined);
    setNotice(undefined);
    setUploading(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await uploadProductImage(
        product.id,
        image,
        data.get("is_primary") === "on",
        String(data.get("type") || "gallery"),
        Number(data.get("sort_order") || 0),
      );
      onSaved(response.data);
      setNotice("Product image uploaded.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUploading(false);
    }
  }

  async function submitStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      readOnly ||
      loadingStock ||
      savingStock ||
      !stock ||
      stock.warehouse_id !== warehouseId
    )
      return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(undefined);
    setNotice(undefined);
    setSavingStock(true);
    try {
      const response = await setWarehouseStock(
        warehouseId,
        product.id,
        Number(data.get("quantity")),
        stockOperation,
      );
      setStock(response.data);
      form.reset();
      onSaved();
      setNotice(
        response.data.quantity === stock.quantity
          ? "Warehouse stock saved."
          : stockOperation === "stock_in"
            ? "Stock received and movement recorded."
            : stockOperation === "stock_out"
              ? "Stock issued and movement recorded."
              : "Warehouse stock adjusted and movement recorded.",
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSavingStock(false);
    }
  }

  /* ── Stock-mode operation config ── */
  const opConfig = {
    adjustment: {
      icon: <SlidersHorizontal size={14} aria-hidden="true" />,
      label: "Adjustment — set current quantity",
      btnLabel: "Save adjustment",
    },
    stock_in: {
      icon: <ArrowDownCircle size={14} aria-hidden="true" />,
      label: "Stock In — add quantity",
      btnLabel: "Record stock in",
    },
    stock_out: {
      icon: <ArrowUpCircle size={14} aria-hidden="true" />,
      label: "Stock Out — remove quantity",
      btnLabel: "Record stock out",
    },
  };

  return (
    <section className={`card product-operations operations-${mode}`}>
      <h2>
        {mode === "stock"
          ? "Warehouse inventory"
          : mode === "media"
            ? "Product media"
            : `Product operations: ${product.name}`}
      </h2>

      {/* ── Notices ── */}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {notice}
        </div>
      )}

      <div className="operations-grid">
        {/* ── Image upload form (non-stock modes) ── */}
        {mode !== "stock" && (
          <form onSubmit={submitImage}>
            <h3>Upload image</h3>
            <label>
              Image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectImage}
                required
              />
            </label>
            <label>
              Media type
              <input name="type" defaultValue="gallery" maxLength={50} />
            </label>
            <label>
              Sort order
              <input
                name="sort_order"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
              />
            </label>
            <label className="checkbox">
              <input name="is_primary" type="checkbox" /> Make primary image
            </label>
            <button disabled={uploading}>
              {uploading ? "Uploading…" : "Upload image"}
            </button>
          </form>
        )}

        {/* ── Stock form (non-media modes) ── */}
        {mode !== "media" && (
          <form onSubmit={submitStock} className="space-y-0">
            {/* Warehouse selector */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Warehouse size={15} className="text-slate-600" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Warehouse stock
                </h3>
              </div>
              <div className="px-5 py-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Select warehouse
                  </span>
                  <select
                    name="warehouse_id"
                    disabled={savingStock}
                    required
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 transition"
                  >
                    <option value="">Choose a warehouse…</option>
                    {masters.warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* No warehouses notice */}
            {masters.warehouses.length === 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Create a warehouse in Stock → Warehouse Stock to continue.
              </div>
            )}

            {/* Stock snapshot tiles */}
            {warehouseId && (
              <div className="mb-5 grid grid-cols-3 gap-3">
                {/* Physical */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Package
                      size={13}
                      className="text-slate-400"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Physical
                    </span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-slate-800">
                    {loadingStock ? (
                      <RefreshCw
                        size={18}
                        className="animate-spin text-slate-300"
                        aria-hidden="true"
                      />
                    ) : (
                      (stock?.quantity ?? "—")
                    )}
                  </p>
                </div>
                {/* Reserved */}
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-1.5">
                    <TrendingDown
                      size={13}
                      className="text-amber-400"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                      Reserved
                    </span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-amber-700">
                    {loadingStock ? (
                      <RefreshCw
                        size={18}
                        className="animate-spin text-amber-200"
                        aria-hidden="true"
                      />
                    ) : (
                      (stock?.reserved_quantity ?? "—")
                    )}
                  </p>
                </div>
                {/* Available */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-1.5">
                    <TrendingUp
                      size={13}
                      className="text-emerald-500"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      Available
                    </span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">
                    {loadingStock ? (
                      <RefreshCw
                        size={18}
                        className="animate-spin text-emerald-200"
                        aria-hidden="true"
                      />
                    ) : (
                      (stock?.available_quantity ?? "—")
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Stock action panel */}
            {!readOnly && (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-800">
                    Record stock action
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    For opening stock, use Adjustment to set the initial quantity.
                  </p>
                </div>
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                  {/* Operation */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Operation
                    </span>
                    <select
                      disabled={savingStock}
                      value={stockOperation}
                      onChange={(event) =>
                        setStockOperation(
                          event.target.value as
                            | "adjustment"
                            | "stock_in"
                            | "stock_out",
                        )
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 transition"
                    >
                      {Object.entries(opConfig).map(([value, cfg]) => (
                        <option key={value} value={value}>
                          {cfg.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Quantity */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      {stockOperation === "adjustment"
                        ? "New total quantity"
                        : "Quantity"}
                    </span>
                    <input
                      name="quantity"
                      disabled={savingStock}
                      type="number"
                      min={stockOperation === "adjustment" ? "0" : "1"}
                      step="1"
                      required
                      placeholder={
                        stockOperation === "adjustment" ? "0" : "Enter quantity"
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 transition"
                    />
                  </label>
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-4">
                  <button
                    type="submit"
                    disabled={savingStock || loadingStock || !stock || !warehouseId}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                  >
                    {savingStock ? (
                      <>
                        <RefreshCw
                          size={13}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={13} aria-hidden="true" />
                        {opConfig[stockOperation].btnLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Product images table (non-stock modes) */}
      {mode !== "stock" && product.images && product.images.length > 0 && (
        <div className="table-scroll product-media-table">
          <table>
            <thead>
              <tr>
                <th>Media</th>
                <th>Type</th>
                <th>Primary</th>
              </tr>
            </thead>
            <tbody>
              {product.images.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open image
                    </a>
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <span
                      className={`status-badge ${item.is_primary ? "active" : "inactive"}`}
                    >
                      {item.is_primary ? "Primary" : "Gallery"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Movement history */}
      {mode !== "media" && warehouseId && (
        <div className="mt-5">
          {stock && warehouseId && (
            <StockMovementHistory
              key={warehouseId}
              productId={product.id}
              warehouseId={warehouseId}
              refreshKey={stock}
            />
          )}
        </div>
      )}
    </section>
  );
}
