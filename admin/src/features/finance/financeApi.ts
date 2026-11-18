import { apiRequest } from "../../api/client";

export const financeKinds = ["emi-providers", "emi-plans", "product-emi-plans", "flash-sales", "flash-sale-products"] as const;
export type FinanceKind = typeof financeKinds[number];
export type FinanceRecord = {
  id: string; name?: string; code?: string; is_active: boolean; tenure_months?: number;
  annual_interest_rate?: string; processing_fee?: string; minimum_amount?: string; maximum_amount?: string | null;
  provider?: { name: string }; product?: { name: string }; plan?: { tenure_months: number; provider?: { name: string } };
  sale?: { name: string }; starts_at?: string | null; ends_at?: string | null;
  discount_type?: string; discount_value?: string; variant_id?: string | null;
  [field: string]: unknown;
};
export type Page<T> = { data: T[]; current_page?: number; last_page?: number; total?: number; meta?: { current_page: number; last_page: number; total: number } };
export const financeList = (kind: FinanceKind, page: number, search: string, signal: AbortSignal) => apiRequest<Page<FinanceRecord>>(`/finance/${kind}?page=${page}&search=${encodeURIComponent(search)}`, "GET", undefined, { signal });
export function recordLabel(row: FinanceRecord): string {
  if (row.name) return row.name;
  if (row.product) return `${row.product.name} · ${row.plan ? `${row.plan.tenure_months} months (${row.plan.provider?.name ?? "Provider"})` : row.sale?.name ?? "Sale"}`;
  return `${row.provider?.name ?? row.id} · ${row.tenure_months} months`;
}
export type Enquiry = { id: string; product_name: string | null; mobile_masked: string; mobile_number?: string; notification_status: string; notification_error: string | null; notification_attempts: number; consented_at: string | null; notified_at: string | null; created_at: string };
