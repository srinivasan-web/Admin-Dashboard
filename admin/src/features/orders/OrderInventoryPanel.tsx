import { useState } from "react";
import type { OrderDetail } from "./types";
import { formatDate, OrderPanel, OrderStatusBadge } from "./OrderUi";

export function OrderInventoryPanel({
  order,
  canManage,
  saving,
  onAllocate,
  onReserve,
}: {
  order: OrderDetail;
  canManage: boolean;
  saving: boolean;
  onAllocate: (warehouseId: string) => void;
  onReserve: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  return (
    <OrderPanel title="Inventory allocation">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <strong>{order.warehouse?.name ?? "Warehouse not allocated"}</strong>
        <OrderStatusBadge status={order.inventory.status} />
        {canManage && order.inventory.can_allocate && (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => onAllocate("")}
            >
              Allocate nearest & reserve
            </button>
            <select
              aria-label="Manually choose warehouse"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              disabled={saving}
            >
              <option value="">Choose warehouse</option>
              {order.allocation_warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving || !warehouseId}
              onClick={() => onAllocate(warehouseId)}
            >
              Allocate & reserve
            </button>
          </>
        )}
        {canManage && order.inventory.can_reserve && (
          <button type="button" disabled={saving} onClick={onReserve}>
            Reserve stock
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              {[
                "Product",
                "SKU",
                "Ordered",
                "Physical",
                "Reserved",
                "Available",
                "Reservation",
                "Expires at",
                "Commit",
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.inventory.items.map((item) => (
              <tr key={item.order_item_id}>
                <td>{item.product}</td>
                <td>{item.sku}</td>
                <td>{item.ordered_quantity}</td>
                <td>{item.physical ?? "—"}</td>
                <td>{item.reserved ?? "—"}</td>
                <td>{item.available ?? "—"}</td>
                <td>
                  <OrderStatusBadge status={item.reservation_status} />
                </td>
                <td>
                  {item.reservation_status === "ACTIVE"
                    ? formatDate(item.expires_at)
                    : "—"}
                </td>
                <td>{item.commit_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OrderPanel>
  );
}
