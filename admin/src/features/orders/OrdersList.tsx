import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, RotateCcw, Search } from "lucide-react";
import { errorMessage } from "../../api/client";
import { loadOrders } from "./ordersApi";
import {
  formatDate,
  formatMoney,
  OrderPanel,
  OrdersPageHeader,
  OrderStatusBadge,
} from "./OrderUi";
import type {
  LaravelPaginationMeta,
  OrderFilters,
  OrderListItem,
} from "./types";

const initialFilters: OrderFilters = {
  search: "",
  status: "all",
  paymentStatus: "all",
  dateFrom: "",
  dateTo: "",
  sort: "placed_at",
  direction: "desc",
  page: 1,
  perPage: 20,
};

export function OrdersList({
  abandoned,
  onView,
}: {
  abandoned: boolean;
  onView: (id: string) => void;
}) {
  const [filters, setFilters] = useState<OrderFilters>(initialFilters);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [meta, setMeta] = useState<LaravelPaginationMeta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(undefined);
    void loadOrders(filters, abandoned)
      .then((response) => {
        if (version !== requestVersion.current) return;
        setOrders(response.data);
        setMeta(response.meta);
      })
      .catch((reason) => {
        if (version === requestVersion.current) setError(errorMessage(reason));
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });
  }, [abandoned, filters, reload]);

  function patchFilters(patch: Partial<OrderFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    patchFilters({ search: search.trim() });
  }

  function resetFilters() {
    setSearch("");
    setFilters(initialFilters);
  }

  const title = abandoned ? "Abandoned orders" : "Orders";
  return (
    <section className="!w-full !py-6 lg:!py-8">
      <OrdersPageHeader
        title={title}
        description={
          abandoned
            ? "Review orders explicitly marked as abandoned in the order lifecycle."
            : "Search customer orders, inspect payment and shipment progress, and continue order operations."
        }
        trail={["Sales", title]}
      />

      <OrderPanel>
        <form
          onSubmit={submitSearch}
          className="!grid !gap-3 xl:!grid-cols-[minmax(240px,1.5fr)_repeat(5,minmax(130px,1fr))_auto]"
        >
          <label className="!relative !block">
            <span className="!sr-only">Search orders</span>
            <Search className="!pointer-events-none !absolute !left-3 !top-1/2 !h-4 !w-4 !-translate-y-1/2 !text-slate-400" />
            <input
              className="!h-11 !w-full !rounded-xl !border !border-slate-300 !bg-white !pl-10 !pr-3 !text-sm !text-slate-900 placeholder:!text-slate-400 focus:!border-orange-500 focus:!outline-none focus:!ring-2 focus:!ring-orange-100"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order number or customer"
            />
          </label>
          {!abandoned && (
            <select
              aria-label="Order status"
              value={filters.status}
              onChange={(event) =>
                patchFilters({
                  status: event.target.value as OrderFilters["status"],
                })
              }
              className="!h-11 !rounded-xl !border !border-slate-300 !bg-white !px-3 !text-sm focus:!border-orange-500 focus:!outline-none focus:!ring-2 focus:!ring-orange-100"
            >
              <option value="all">All statuses</option>
              {(
                [
                  "pending",
                  "confirmed",
                  "processing",
                  "picked",
                  "packed",
                  "invoiced",
                  "ready_to_ship",
                  "hold",
                  "completed",
                  "cancelled",
                  "abandoned",
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Payment status"
            value={filters.paymentStatus}
            onChange={(event) =>
              patchFilters({
                paymentStatus: event.target
                  .value as OrderFilters["paymentStatus"],
              })
            }
            className="!h-11 !rounded-xl !border !border-slate-300 !bg-white !px-3 !text-sm focus:!border-orange-500 focus:!outline-none focus:!ring-2 focus:!ring-orange-100"
          >
            <option value="all">All payments</option>
            {(
              ["pending", "authorized", "paid", "failed", "refunded"] as const
            ).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            aria-label="Orders from date"
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(event) => patchFilters({ dateFrom: event.target.value })}
            className="!h-11 !rounded-xl !border !border-slate-300 !bg-white !px-3 !text-sm focus:!border-orange-500 focus:!outline-none focus:!ring-2 focus:!ring-orange-100"
          />
          <input
            aria-label="Orders to date"
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(event) => patchFilters({ dateTo: event.target.value })}
            className="!h-11 !rounded-xl !border !border-slate-300 !bg-white !px-3 !text-sm focus:!border-orange-500 focus:!outline-none focus:!ring-2 focus:!ring-orange-100"
          />

          <div className="!flex !gap-2">
            <button
              type="submit"
              className="!h-11 !min-h-0 !rounded-xl !bg-orange-600 !px-4 !text-sm !font-semibold !text-white hover:!bg-orange-700"
            >
              <Search className="!h-4 !w-4" /> Apply
            </button>
            <button
              type="button"
              aria-label="Reset filters"
              onClick={resetFilters}
              className="!h-11 !min-h-0 !rounded-xl !border !border-slate-300 !bg-white !px-3 !text-slate-700 hover:!bg-slate-50"
            >
              <RotateCcw className="!h-4 !w-4" />
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="!mt-5 !flex !items-center !justify-between !gap-4 !rounded-xl !border !border-red-200 !bg-red-50 !p-4 !text-sm !text-red-700"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="!min-h-0 !rounded-lg !bg-red-700 !px-3 !py-2 !text-xs !text-white"
            >
              Retry
            </button>
          </div>
        )}

        <div className="!relative !mt-5 !overflow-x-auto !rounded-xl !border !border-slate-200">
          {loading && (
            <div
              role="status"
              className="!absolute !inset-x-0 !top-0 !z-10 !h-1 !animate-pulse !bg-orange-500"
            >
              <span className="!sr-only">Loading orders</span>
            </div>
          )}
          <table className="!w-full !min-w-[1120px] !border-collapse !text-left !text-sm">
            <thead className="!bg-slate-50 !text-xs !uppercase !tracking-wide !text-slate-500">
              <tr>
                {[
                  "Order #",
                  "Customer",
                  "Total",
                  "Payment",
                  "Shipment",
                  "Status",
                  "Date",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="!border-b !border-slate-200 !px-4 !py-3 !font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="!divide-y !divide-slate-100 !bg-white">
              {!loading &&
                orders.map((order) => (
                  <tr key={order.id} className="hover:!bg-slate-50/80">
                    <td className="!px-4 !py-4">
                      <strong className="!font-semibold !text-slate-950">
                        {order.order_number}
                      </strong>
                    </td>
                    <td className="!px-4 !py-4">
                      <div className="!font-medium !text-slate-900">
                        {order.customer?.name ?? "Deleted customer"}
                      </div>
                      <div className="!mt-1 !text-xs !text-slate-500">
                        {order.customer?.phone ??
                          order.customer?.email ??
                          "No contact"}
                      </div>
                    </td>
                    <td className="!px-4 !py-4 !font-semibold !tabular-nums !text-slate-950">
                      {formatMoney(order.total_amount)}
                    </td>
                    <td className="!px-4 !py-4">
                      <OrderStatusBadge status={order.payment_status} />
                    </td>
                    <td className="!px-4 !py-4">
                      <OrderStatusBadge status={order.fulfillment_status} />
                    </td>
                    <td className="!px-4 !py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="!px-4 !py-4 !whitespace-nowrap !text-slate-600">
                      {formatDate(order.placed_at, false)}
                    </td>
                    <td className="!px-4 !py-4 !text-right">
                      <button
                        type="button"
                        onClick={() => onView(order.id)}
                        className="!min-h-0 !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-2 !text-xs !font-semibold !text-slate-700 hover:!border-orange-300 hover:!bg-orange-50 hover:!text-orange-700"
                      >
                        <Eye className="!h-4 !w-4" /> View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && !error && orders.length === 0 && (
            <div className="!p-12 !text-center">
              <p className="!font-semibold !text-slate-900">No orders found</p>
              <p className="!mt-1 !text-sm !text-slate-500">
                Try changing the current search or filters.
              </p>
            </div>
          )}
          {loading && orders.length === 0 && (
            <div className="!p-12 !text-center !text-sm !text-slate-500">
              Loading orders…
            </div>
          )}
        </div>

        {meta && meta.total > 0 && (
          <footer className="!mt-4 !flex !flex-col !gap-3 !text-sm !text-slate-600 sm:!flex-row sm:!items-center sm:!justify-between">
            <span>
              Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
            </span>
            <div className="!flex !items-center !gap-2">
              <button
                type="button"
                disabled={meta.current_page <= 1 || loading}
                onClick={() => patchFilters({ page: meta.current_page - 1 })}
                className="!min-h-0 !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-2 !text-sm !text-slate-700 disabled:!opacity-40"
              >
                Previous
              </button>
              <span className="!px-2 !font-medium !text-slate-900">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <button
                type="button"
                disabled={meta.current_page >= meta.last_page || loading}
                onClick={() => patchFilters({ page: meta.current_page + 1 })}
                className="!min-h-0 !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-2 !text-sm !text-slate-700 disabled:!opacity-40"
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </OrderPanel>
    </section>
  );
}
