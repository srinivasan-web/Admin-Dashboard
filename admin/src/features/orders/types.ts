export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "picked"
  | "packed"
  | "invoiced"
  | "ready_to_ship"
  | "hold"
  | "completed"
  | "cancelled"
  | "abandoned";

export type PaymentStatus =
  "pending" | "authorized" | "paid" | "failed" | "refunded";

export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type OrderListItem = {
  id: string;
  order_number: string;
  customer: OrderCustomer | null;
  warehouse: { id: string; name: string } | null;
  status: OrderStatus;
  payment_status: PaymentStatus | null;
  fulfillment_status: FulfillmentStatus | null;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  placed_at: string | null;
};

export type OrderAddress = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
  state: string | null;
  city: string | null;
  postal_code: string | null;
};

export type OrderDetail = OrderListItem & {
  allocation_warehouses: Array<{ id: string; name: string }>;
  inventory: {
    status: string;
    can_allocate: boolean;
    can_reserve: boolean;
    items: Array<{
      order_item_id: string;
      product_id: string | null;
      product: string;
      sku: string;
      ordered_quantity: number;
      physical: number | null;
      reserved: number | null;
      available: number | null;
      reservation_status: string;
      expires_at: string | null;
      commit_status: string;
    }>;
    timeline: Array<{
      id: string;
      label: string;
      status: string;
      timestamp: string | null;
      actor: string | null;
    }>;
  };
  allowed_actions: {
    order_statuses: OrderStatus[];
    payment_statuses: Record<string, PaymentStatus[]>;
    shipment_statuses: Record<string, FulfillmentStatus[]>;
  };
  billing_address: OrderAddress | null;
  shipping_address: OrderAddress | null;
  items: Array<{
    id: string;
    product_id: string | null;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: string;
    discount_amount: string | null;
    tax_amount: string | null;
    line_total: string;
  }>;
  payments: Array<{
    id: string;
    method: string | null;
    provider: string;
    provider_transaction_reference: string;
    amount: string;
    currency: string;
    status: PaymentStatus;
    paid_at: string | null;
    created_at: string | null;
  }>;
  shipments: Array<{
    id: string;
    warehouse_id: string | null;
    warehouse: { id: string; name: string } | null;
    carrier: string;
    tracking_reference: string | null;
    status: FulfillmentStatus;
    shipped_at: string | null;
    delivered_at: string | null;
  }>;
  stock_reservations: Array<{
    id: string;
    order_item_id: string;
    warehouse_id: string;
    product_id: string;
    quantity: number;
    status: "ACTIVE" | "RELEASED" | "COMMITTED" | "EXPIRED" | "RESTORED";
    reserved_at: string | null;
    expires_at: string | null;
    released_at: string | null;
    committed_at: string | null;
  }>;
  status_history: Array<{
    id: string;
    from_status: OrderStatus | null;
    to_status: OrderStatus;
    changed_by: string | null;
    created_at: string | null;
  }>;
};

export type LaravelPaginationMeta = {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
};

export type OrderFilters = {
  search: string;
  status: "all" | OrderStatus;
  paymentStatus: "all" | PaymentStatus;
  dateFrom: string;
  dateTo: string;
  sort: "placed_at" | "order_number" | "total_amount" | "status";
  direction: "asc" | "desc";
  page: number;
  perPage: number;
};
