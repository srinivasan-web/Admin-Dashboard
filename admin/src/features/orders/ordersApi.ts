import { apiRequest, type ApiResponse } from "../../api/client";
import type {
  LaravelPaginationMeta,
  OrderDetail,
  OrderFilters,
  OrderListItem,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from "./types";

export type OrdersResponse = {
  data: OrderListItem[];
  meta: LaravelPaginationMeta;
};

function ordersQuery(filters: OrderFilters): string {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status !== "all") query.set("status", filters.status);
  if (filters.paymentStatus !== "all")
    query.set("payment_status", filters.paymentStatus);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  query.set("sort", filters.sort);
  query.set("direction", filters.direction);
  query.set("page", String(filters.page));
  query.set("per_page", String(filters.perPage));
  return query.toString();
}

export function updatePaymentStatus(
  orderId: string,
  paymentId: string,
  status: PaymentStatus,
) {
  return apiRequest<ApiResponse<OrderDetail>>(
    `/orders/${orderId}/payments/${paymentId}/status`,
    "POST",
    { status },
  );
}

export function updateShipmentStatus(
  orderId: string,
  shipmentId: string,
  status: FulfillmentStatus,
) {
  return apiRequest<ApiResponse<OrderDetail>>(
    `/orders/${orderId}/shipments/${shipmentId}/status`,
    "POST",
    { status },
  );
}

export function loadOrders(filters: OrderFilters, abandoned = false) {
  return apiRequest<OrdersResponse>(
    `/orders${abandoned ? "/abandoned" : ""}?${ordersQuery(filters)}`,
  );
}

export function loadOrder(id: string) {
  return apiRequest<ApiResponse<OrderDetail>>(`/orders/${id}`);
}

export function allocateOrderWarehouse(id: string, warehouseId?: string) {
  return apiRequest<ApiResponse<OrderDetail>>(
    `/orders/${id}/warehouse`,
    "PUT",
    warehouseId ? { warehouse_id: warehouseId } : {},
  );
}

export function reserveOrderStock(id: string) {
  return apiRequest<ApiResponse<OrderDetail>>(
    `/orders/${id}/reserve`,
    "POST",
    {},
  );
}

export function updateOrderStatus(
  id: string,
  currentStatus: OrderStatus,
  status: OrderStatus,
) {
  return apiRequest<ApiResponse<OrderDetail>>(`/orders/${id}/status`, "POST", {
    current_status: currentStatus,
    status,
  });
}
