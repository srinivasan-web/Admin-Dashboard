import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  MapPin,
  PackageCheck,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import {
  loadOrder,
  allocateOrderWarehouse,
  reserveOrderStock,
  updateOrderStatus,
  updatePaymentStatus,
  updateShipmentStatus,
} from "./ordersApi";
import { OrderInventoryPanel } from "./OrderInventoryPanel";
import {
  formatDate,
  formatMoney,
  OrderPanel,
  OrdersPageHeader,
  OrderStatusBadge,
} from "./OrderUi";
import type {
  FulfillmentStatus,
  OrderAddress,
  OrderDetail,
  OrderStatus,
  PaymentStatus,
} from "./types";

function AddressBlock({
  label,
  address,
}: {
  label: string;
  address: OrderAddress | null;
}) {
  return (
    <div className="!rounded-xl !border !border-slate-200 !bg-slate-50 !p-4">
      <h3 className="!mb-2 !text-sm !font-semibold !text-slate-950">{label}</h3>
      {address ? (
        <address className="!space-y-1 !text-sm !not-italic !leading-6 !text-slate-600">
          <strong className="!block !text-slate-900">{address.name}</strong>
          <span className="!block">{address.address}</span>
          <span className="!block">
            {[address.city, address.state, address.postal_code]
              .filter(Boolean)
              .join(", ") || "—"}
          </span>
          {address.phone && <span className="!block">{address.phone}</span>}
          {address.email && <span className="!block">{address.email}</span>}
        </address>
      ) : (
        <p className="!text-sm !text-slate-500">
          No {label.toLowerCase()} snapshot.
        </p>
      )}
    </div>
  );
}

export function OrderDetailPage({
  id,
  canManage,
  onBack,
}: {
  id: string;
  canManage: boolean;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail>();
  const [targetStatus, setTargetStatus] = useState<OrderStatus>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [reload, setReload] = useState(0);
  const requestVersion = useRef(0);
  const displayedStatus = useRef<OrderStatus | undefined>(undefined);
  displayedStatus.current = order?.status;

  useEffect(() => {
    let active = true;
    let pending = false;
    const timer = window.setInterval(() => {
      if (saving || pending || document.hidden) return;
      pending = true;
      const version = requestVersion.current;
      void loadOrder(id)
        .then((response) => {
          if (active && version === requestVersion.current) {
            const previous = displayedStatus.current;
            setTargetStatus((current) =>
              current === previous ? response.data.status : current,
            );
            setOrder(response.data);
          }
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        })
        .finally(() => {
          pending = false;
        });
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, saving]);

  async function changeInventory(warehouseId?: string) {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    ++requestVersion.current;
    try {
      if (warehouseId !== undefined) {
        const allocated = await allocateOrderWarehouse(
          id,
          warehouseId || undefined,
        );
        setOrder(allocated.data);
      }
      const response = await reserveOrderStock(id);
      setOrder(response.data);
      setNotice(
        warehouseId === undefined
          ? "Stock reserved."
          : "Warehouse allocated and stock reserved.",
      );
    } catch (reason) {
      setError(errorMessage(reason));
      // Allocation may have succeeded before reserve failed, or the response may have been lost.
      try {
        const current = await loadOrder(id);
        setOrder(current.data);
      } catch {
        /* Keep the last confirmed response and the original operation error. */
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    setOrder(undefined);
    setError(undefined);
    setNotice(undefined);
    void loadOrder(id)
      .then((response) => {
        if (version !== requestVersion.current) return;
        setOrder(response.data);
        setTargetStatus(response.data.status);
      })
      .catch((reason) => {
        if (version === requestVersion.current) setError(errorMessage(reason));
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });
  }, [id, reload]);

  async function saveStatus() {
    if (!order || !targetStatus || targetStatus === order.status || saving)
      return;
    if (
      !window.confirm(
        `Change order ${order.order_number} from ${order.status} to ${targetStatus}?`,
      )
    )
      return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    ++requestVersion.current;
    try {
      const response = await updateOrderStatus(
        order.id,
        order.status,
        targetStatus,
      );
      setOrder(response.data);
      setTargetStatus(response.data.status);
      setNotice(`Order status updated to ${response.data.status}.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function savePayment(paymentId: string, status: PaymentStatus) {
    if (
      !order ||
      saving ||
      !window.confirm(`Change payment status to ${status}?`)
    )
      return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    ++requestVersion.current;
    try {
      const response = await updatePaymentStatus(order.id, paymentId, status);
      setOrder(response.data);
      setTargetStatus(response.data.status);
      setNotice(`Payment status updated to ${status}.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function saveShipment(shipmentId: string, status: FulfillmentStatus) {
    if (
      !order ||
      saving ||
      !window.confirm(`Change shipment status to ${status}?`)
    )
      return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    ++requestVersion.current;
    try {
      const response = await updateShipmentStatus(order.id, shipmentId, status);
      setOrder(response.data);
      setNotice(`Shipment status updated to ${status}.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !order) {
    return (
      <section className="!w-full !py-12">
        <div
          role="status"
          className="!rounded-2xl !border !border-slate-200 !bg-white !p-12 !text-center !text-sm !text-slate-500"
        >
          Loading order…
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="!w-full !py-8">
        <button
          type="button"
          onClick={onBack}
          className="!mb-5 !min-h-0 !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-2 !text-sm !text-slate-700"
        >
          <ArrowLeft className="!h-4 !w-4" /> Back to orders
        </button>
        <div
          role="alert"
          className="!rounded-2xl !border !border-red-200 !bg-red-50 !p-6 !text-red-700"
        >
          <p>{error ?? "The order could not be loaded."}</p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="!mt-4 !min-h-0 !rounded-lg !bg-red-700 !px-4 !py-2 !text-sm !text-white"
          >
            <RefreshCw className="!h-4 !w-4" /> Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="!w-full !py-6 lg:!py-8">
      <OrdersPageHeader
        title={order.order_number}
        description={`Placed ${formatDate(order.placed_at)}${order.customer ? ` by ${order.customer.name}` : ""}.`}
        trail={["Sales", "Orders", order.order_number]}
        actions={
          <button
            type="button"
            onClick={onBack}
            className="!min-h-0 !rounded-xl !border !border-slate-300 !bg-white !px-4 !py-2.5 !text-sm !font-semibold !text-slate-700 hover:!bg-slate-50"
          >
            <ArrowLeft className="!h-4 !w-4" /> Back to orders
          </button>
        }
      />

      {notice && (
        <div
          role="status"
          className="!mb-5 !flex !items-center !gap-2 !rounded-xl !border !border-emerald-200 !bg-emerald-50 !p-4 !text-sm !font-medium !text-emerald-700"
        >
          <Check className="!h-4 !w-4" /> {notice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="!mb-5 !rounded-xl !border !border-red-200 !bg-red-50 !p-4 !text-sm !text-red-700"
        >
          {error}
        </div>
      )}

      <div className="!grid !gap-5 xl:!grid-cols-[minmax(0,2fr)_minmax(310px,1fr)]">
        <div className="!grid !min-w-0 !gap-5">
          <OrderPanel title="Order items">
            <div className="!overflow-x-auto !rounded-xl !border !border-slate-200">
              <table className="!w-full !min-w-[720px] !border-collapse !text-left !text-sm">
                <thead className="!bg-slate-50 !text-xs !uppercase !tracking-wide !text-slate-500">
                  <tr>
                    {[
                      "Product",
                      "SKU",
                      "Qty",
                      "Unit price",
                      "Discount",
                      "Tax",
                      "Line total",
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
                <tbody className="!divide-y !divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="!px-4 !py-4 !font-medium !text-slate-950">
                        {item.product_name}
                      </td>
                      <td className="!px-4 !py-4 !text-slate-600">
                        {item.product_sku}
                      </td>
                      <td className="!px-4 !py-4 !tabular-nums !text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="!px-4 !py-4 !whitespace-nowrap !tabular-nums !text-slate-600">
                        {formatMoney(item.unit_price)}
                      </td>
                      <td className="!px-4 !py-4 !whitespace-nowrap !tabular-nums !text-slate-600">
                        {item.discount_amount === null
                          ? "—"
                          : formatMoney(item.discount_amount)}
                      </td>
                      <td className="!px-4 !py-4 !whitespace-nowrap !tabular-nums !text-slate-600">
                        {item.tax_amount === null
                          ? "—"
                          : formatMoney(item.tax_amount)}
                      </td>
                      <td className="!px-4 !py-4 !whitespace-nowrap !font-semibold !tabular-nums !text-slate-950">
                        {formatMoney(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </OrderPanel>

          <OrderInventoryPanel
            order={order}
            canManage={canManage}
            saving={saving}
            onAllocate={(warehouseId) => void changeInventory(warehouseId)}
            onReserve={() => void changeInventory()}
          />
          <OrderPanel title="Reservation audit">
            {order.stock_reservations.length === 0 ? (
              <p className="!text-sm !text-slate-500">
                No stock reservation exists for this order.
              </p>
            ) : (
              <div className="!overflow-x-auto !rounded-xl !border !border-slate-200">
                <table className="!w-full !min-w-[620px] !border-collapse !text-left !text-sm">
                  <thead className="!bg-slate-50 !text-xs !uppercase !tracking-wide !text-slate-500">
                    <tr>
                      {[
                        "Product",
                        "Warehouse",
                        "Quantity",
                        "Inventory status",
                        "Updated",
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
                  <tbody className="!divide-y !divide-slate-100">
                    {order.stock_reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td className="!px-4 !py-3 !font-medium !text-slate-900">
                          {order.items.find(
                            (item) => item.id === reservation.order_item_id,
                          )?.product_name ?? reservation.product_id}
                        </td>
                        <td className="!px-4 !py-3 !text-slate-600">
                          {order.warehouse?.name ?? reservation.warehouse_id}
                        </td>
                        <td className="!px-4 !py-3 !tabular-nums !text-slate-700">
                          {reservation.quantity}
                        </td>
                        <td className="!px-4 !py-3">
                          <OrderStatusBadge status={reservation.status} />
                        </td>
                        <td className="!px-4 !py-3 !text-slate-500">
                          {formatDate(
                            reservation.committed_at ??
                              reservation.released_at ??
                              reservation.reserved_at,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OrderPanel>

          <OrderPanel title="Customer and addresses">
            <div className="!mb-4 !flex !items-start !gap-3 !rounded-xl !border !border-slate-200 !p-4">
              <span className="!rounded-lg !bg-orange-50 !p-2 !text-orange-600">
                <UserRound className="!h-5 !w-5" />
              </span>
              <div>
                <p className="!font-semibold !text-slate-950">
                  {order.customer?.name ?? "Deleted customer"}
                </p>
                <p className="!mt-1 !text-sm !text-slate-600">
                  {order.customer?.phone ?? "No phone"} ·{" "}
                  {order.customer?.email ?? "No email"}
                </p>
              </div>
            </div>
            <div className="!grid !gap-4 md:!grid-cols-2">
              <AddressBlock
                label="Billing address"
                address={order.billing_address}
              />
              <AddressBlock
                label="Shipping address"
                address={order.shipping_address}
              />
            </div>
          </OrderPanel>

          <div className="!grid !gap-5 lg:!grid-cols-2">
            <OrderPanel title="Payments">
              {order.payments.length === 0 ? (
                <p className="!text-sm !text-slate-500">
                  No payment transactions recorded.
                </p>
              ) : (
                <div className="!space-y-3">
                  {order.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="!rounded-xl !border !border-slate-200 !p-4"
                    >
                      <div className="!flex !items-start !justify-between !gap-3">
                        <div>
                          <p className="!font-semibold !text-slate-950">
                            {payment.method ?? payment.provider}
                          </p>
                          {payment.method ? (
                            <p className="!mt-1 !text-xs !text-slate-500">
                              {payment.provider}
                            </p>
                          ) : null}
                          <p className="!mt-1 !break-all !text-xs !text-slate-500">
                            {payment.provider_transaction_reference}
                          </p>
                        </div>
                        <OrderStatusBadge status={payment.status} />
                      </div>
                      <p className="!mt-3 !text-sm !font-semibold !text-slate-900">
                        {formatMoney(payment.amount, payment.currency)}
                      </p>
                      <p className="!mt-1 !text-xs !text-slate-500">
                        Paid: {formatDate(payment.paid_at)}
                      </p>
                      {canManage && (
                        <select
                          aria-label={`Payment status for ${payment.provider_transaction_reference}`}
                          value={payment.status}
                          disabled={saving}
                          onChange={(event) =>
                            void savePayment(
                              payment.id,
                              event.target.value as PaymentStatus,
                            )
                          }
                          className="!mt-3 !h-10 !w-full !rounded-lg !border !border-slate-300 !bg-white !px-3 !text-sm"
                        >
                          {[
                            payment.status,
                            ...(order.allowed_actions.payment_statuses[
                              payment.id
                            ] ?? []),
                          ].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </OrderPanel>
            <OrderPanel title="Shipments">
              {order.shipments.length === 0 ? (
                <p className="!text-sm !text-slate-500">
                  No shipment records created.
                </p>
              ) : (
                <div className="!space-y-3">
                  {order.shipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="!rounded-xl !border !border-slate-200 !p-4"
                    >
                      <div className="!flex !items-start !justify-between !gap-3">
                        <div>
                          <p className="!font-semibold !text-slate-950">
                            {shipment.carrier}
                          </p>
                          <p className="!mt-1 !text-xs !text-slate-500">
                            {shipment.tracking_reference ??
                              "Tracking not assigned"}
                          </p>
                          <p className="!mt-1 !text-xs !text-slate-500">
                            {shipment.warehouse?.name ??
                              "Warehouse not assigned"}
                          </p>
                        </div>
                        <OrderStatusBadge status={shipment.status} />
                      </div>
                      <p className="!mt-3 !text-xs !text-slate-500">
                        Shipped: {formatDate(shipment.shipped_at)}
                      </p>
                      <p className="!mt-1 !text-xs !text-slate-500">
                        Delivered: {formatDate(shipment.delivered_at)}
                      </p>
                      {canManage && (
                        <select
                          aria-label={`Shipment status for ${shipment.tracking_reference ?? shipment.id}`}
                          value={shipment.status}
                          disabled={saving}
                          onChange={(event) =>
                            void saveShipment(
                              shipment.id,
                              event.target.value as FulfillmentStatus,
                            )
                          }
                          className="!mt-3 !h-10 !w-full !rounded-lg !border !border-slate-300 !bg-white !px-3 !text-sm"
                        >
                          {[
                            shipment.status,
                            ...(order.allowed_actions.shipment_statuses[
                              shipment.id
                            ] ?? []),
                          ].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </OrderPanel>
          </div>
        </div>

        <aside className="!grid !h-fit !gap-5 xl:!sticky xl:!top-20">
          <OrderPanel title="Order status">
            <div className="!mb-4 !grid !grid-cols-2 !gap-2">
              <div>
                <p className="!mb-2 !text-xs !font-semibold !uppercase !text-slate-500">
                  Inventory
                </p>
                <OrderStatusBadge status={order.inventory.status} />
              </div>
              <div>
                <p className="!mb-2 !text-xs !font-semibold !uppercase !tracking-wide !text-slate-500">
                  Order
                </p>
                <OrderStatusBadge status={order.status} />
              </div>
              <div>
                <p className="!mb-2 !text-xs !font-semibold !uppercase !tracking-wide !text-slate-500">
                  Payment
                </p>
                <OrderStatusBadge status={order.payment_status} />
              </div>
              <div>
                <p className="!mb-2 !text-xs !font-semibold !uppercase !tracking-wide !text-slate-500">
                  Shipment
                </p>
                <OrderStatusBadge status={order.fulfillment_status} />
              </div>
            </div>
            {canManage ? (
              <>
                <label className="!block">
                  <span className="!mb-2 !block !text-sm !font-medium !text-slate-700">
                    Change order status
                  </span>
                  <select
                    value={targetStatus}
                    onChange={(event) =>
                      setTargetStatus(event.target.value as OrderStatus)
                    }
                    disabled={saving}
                    className="!h-11 !w-full !rounded-xl !border !border-slate-300 !bg-white !px-3 !text-sm focus:!border-orange-500 focus:!outline-none focus:!ring-2 focus:!ring-orange-100"
                  >
                    {[
                      order.status,
                      ...order.allowed_actions.order_statuses,
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={saving || targetStatus === order.status}
                  onClick={() => void saveStatus()}
                  className="!mt-3 !h-11 !w-full !min-h-0 !rounded-xl !bg-orange-600 !px-4 !text-sm !font-semibold !text-white hover:!bg-orange-700 disabled:!opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="!h-4 !w-4 !animate-spin" />
                  ) : (
                    <PackageCheck className="!h-4 !w-4" />
                  )}
                  {saving ? "Updating…" : "Update status"}
                </button>
                <p className="!mt-3 !text-xs !leading-5 !text-slate-500">
                  The server validates every transition. Unsupported changes
                  return an error without changing the order.
                </p>
              </>
            ) : (
              <p className="!rounded-xl !bg-slate-50 !p-3 !text-sm !text-slate-600">
                You have read-only Orders access.
              </p>
            )}
          </OrderPanel>

          <OrderPanel title="Pricing">
            <dl className="!space-y-3 !text-sm">
              <div className="!flex !justify-between !gap-3">
                <dt className="!text-slate-500">Subtotal</dt>
                <dd className="!font-medium !tabular-nums !text-slate-900">
                  {formatMoney(order.subtotal_amount)}
                </dd>
              </div>
              <div className="!flex !justify-between !gap-3">
                <dt className="!text-slate-500">Discount</dt>
                <dd className="!font-medium !tabular-nums !text-slate-900">
                  − {formatMoney(order.discount_amount)}
                </dd>
              </div>
              <div className="!flex !justify-between !gap-3 !border-t !border-slate-200 !pt-3">
                <dt className="!font-semibold !text-slate-950">Total</dt>
                <dd className="!text-lg !font-bold !tabular-nums !text-slate-950">
                  {formatMoney(order.total_amount)}
                </dd>
              </div>
            </dl>
          </OrderPanel>

          <OrderPanel title="Status timeline">
            <ol className="!relative !ml-2 !border-l !border-slate-200">
              {order.inventory.timeline.map((entry) => (
                <li key={entry.id} className="!relative !pb-5 !pl-5 last:!pb-0">
                  <span className="!absolute !-left-1.5 !top-1 !h-3 !w-3 !rounded-full !border-2 !border-white !bg-orange-500 !ring-1 !ring-orange-200" />
                  <div className="!flex !items-center !gap-2">
                    <span>{entry.label}</span>
                    <OrderStatusBadge status={entry.status} />
                  </div>
                  <p className="!mt-2 !text-xs !text-slate-500">
                    {entry.actor ?? "Source not recorded"} ·{" "}
                    {formatDate(entry.timestamp)}
                  </p>
                </li>
              ))}
            </ol>
          </OrderPanel>

          <OrderPanel>
            <div className="!flex !items-start !gap-3">
              <span className="!rounded-lg !bg-slate-100 !p-2 !text-slate-600">
                <MapPin className="!h-5 !w-5" />
              </span>
              <div>
                <p className="!text-sm !font-semibold !text-slate-950">
                  Warehouse
                </p>
                <p className="!mt-1 !text-sm !text-slate-600">
                  {order.warehouse?.name ?? "Not assigned"}
                </p>
              </div>
            </div>
          </OrderPanel>
        </aside>
      </div>
    </section>
  );
}
