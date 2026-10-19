import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  History,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { apiRequest, errorMessage } from "../../api/client";
import type { StockMovement } from "./types";

type HistoryPage = {
  data: StockMovement[];
  meta: { current_page: number; last_page: number; total: number };
};

function movementIcon(type: string) {
  if (type.includes("in") || type.includes("add") || type.includes("receive")) {
    return (
      <ArrowDownCircle
        size={14}
        className="text-emerald-500"
        aria-hidden="true"
      />
    );
  }
  if (type.includes("out") || type.includes("remove") || type.includes("issue")) {
    return (
      <ArrowUpCircle size={14} className="text-red-400" aria-hidden="true" />
    );
  }
  return (
    <SlidersHorizontal size={14} className="text-orange-400" aria-hidden="true" />
  );
}

function movementLabel(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deltaBadge(delta: number) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-emerald-700">
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-red-600">
        {delta}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-slate-400">0</span>
  );
}

export function StockMovementHistory({
  productId,
  warehouseId,
  refreshKey,
}: {
  productId: string;
  warehouseId: string;
  refreshKey: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryPage>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => setPage(1), [productId, warehouseId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setData(undefined);
    setError(undefined);
    const query = new URLSearchParams({
      product_id: productId,
      warehouse_id: warehouseId,
      page: String(page),
      per_page: "20",
    });
    void apiRequest<HistoryPage>(
      `/stock-movements?${query}`,
      "GET",
      undefined,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [open, page, productId, warehouseId, refreshKey, revision]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 transition hover:bg-slate-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <History size={15} className="text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Movement history</p>
            {data && (
              <p className="text-xs text-slate-400">
                {data.meta.total} total movement
                {data.meta.total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" aria-hidden="true" />
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="border-t border-slate-100">
          {error ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 px-6 py-10 text-center"
            >
              <AlertCircle
                size={28}
                className="text-red-400"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-700">
                Failed to load history
              </p>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                type="button"
                onClick={() => setRevision((v) => v + 1)}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={12} aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : !data ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-slate-500"
            >
              <RefreshCw
                size={14}
                className="animate-spin text-slate-400"
                aria-hidden="true"
              />
              Loading movement history…
            </div>
          ) : data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <History size={26} className="text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600">
                No movements yet
              </p>
              <p className="text-xs text-slate-400">
                Stock changes will appear here once recorded.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                        When
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                        Operation
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                        Performed by
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.data.map((movement) => (
                      <tr
                        key={movement.id}
                        className="transition-colors hover:bg-slate-50/60"
                      >
                        <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                          {movement.created_at
                            ? new Date(movement.created_at).toLocaleString(
                                undefined,
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                },
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {movementIcon(movement.movement_type)}
                            <span className="text-xs font-medium text-slate-700">
                              {movementLabel(movement.movement_type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          {deltaBadge(movement.quantity_delta)}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-500">
                          {movement.created_by?.name ?? (
                            <span className="italic text-slate-400">System</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.meta.last_page > 1 && (
                <nav
                  aria-label="Movement history pages"
                  className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-3"
                >
                  <button
                    type="button"
                    disabled={data.meta.current_page <= 1}
                    onClick={() => setPage((v) => v - 1)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft size={12} aria-hidden="true" />
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page{" "}
                    <span className="font-semibold text-slate-700">
                      {data.meta.current_page}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-700">
                      {data.meta.last_page}
                    </span>{" "}
                    &middot;{" "}
                    <span className="font-semibold text-slate-700">
                      {data.meta.total}
                    </span>{" "}
                    total
                  </span>
                  <button
                    type="button"
                    disabled={data.meta.current_page >= data.meta.last_page}
                    onClick={() => setPage((v) => v + 1)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ArrowRight size={12} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
