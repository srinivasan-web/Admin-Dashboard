import { useEffect } from "react";
import { useCatalogResource } from "./catalog";
import { CatalogError } from "./catalogClient";

export type EmiQuote = {
  plan_id: string;
  provider: { id: string; name: string; code: string };
  currency: string;
  tenure_months: number;
  annual_interest_rate: string;
  method: "no_cost" | "zero_interest" | "reducing_balance";
  principal: string;
  monthly_emi: string;
  final_instalment: string;
  interest_payable: string;
  processing_fee: string;
  total_payable: string;
  ends_at: string | null;
};
export type PurchaseOptions = {
  data: {
    product_id: string;
    price: {
      currency: string; mrp: string; base_price: string; selling_price: string;
      discount_percent: number; server_time: string; checkout_available: boolean;
      flash_sale: { id: string; name: string; starts_at: string; ends_at: string } | null;
    };
    plans: EmiQuote[];
  };
};

export function usePurchaseOptions(productId: string) {
  const resource = useCatalogResource<PurchaseOptions>(`/products/${encodeURIComponent(productId)}/purchase-options`, { refreshOnFocus: true });
  useEffect(() => {
    if (!resource.data) return;
    const { price, plans } = resource.data.data;
    const ends = [price.flash_sale?.ends_at, ...plans.map((plan) => plan.ends_at)]
      .filter((value): value is string => Boolean(value)).map(Date.parse);
    const remaining = Math.min(...ends) - Date.parse(price.server_time);
    // Also discover newly-started schedules while this page stays open.
    const timer = window.setTimeout(resource.retry, Math.max(1000, Math.min(60_000, remaining + 100)));
    return () => window.clearTimeout(timer);
  }, [resource.data, resource.retry]);
  return resource;
}
export type PurchaseResource = ReturnType<typeof usePurchaseOptions>;

export const formatMoney = (value: string) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(Number(value));

export async function submitFinance<T>(productId: string, action: "calculate" | "enquiries", body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/products/${encodeURIComponent(productId)}/emi/${action}`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    const details = payload.error?.details as Record<string, string[]> | undefined;
    throw new CatalogError(response.status, details ? Object.values(details).flat().join(" ")
      : response.status === 429 ? "Too many requests. Please wait a minute and try again." : "We couldn't process this request. Please try again.");
  }
  return payload as T;
}
