import { useEffect, useState } from "react";
import { Check, Flame } from "lucide-react";
import type { Product } from "../../api/catalog";
import { formatMoney, type PurchaseResource } from "../../api/purchase";

function SaleCountdown({ endsAt, serverTime, onEnd }: { endsAt: string; serverTime: string; onEnd: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Date.parse(endsAt) - Date.parse(serverTime)));
  useEffect(() => {
    const start = performance.now();
    const duration = Date.parse(endsAt) - Date.parse(serverTime);
    const timer = window.setInterval(() => {
      const next = Math.max(0, duration - (performance.now() - start));
      setRemaining(next);
      if (next === 0) { window.clearInterval(timer); onEnd(); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, serverTime, onEnd]);
  if (remaining <= 0) return null;
  const seconds = Math.floor(remaining / 1000);
  const duration = `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
  return <span className="rounded-md bg-orange-100 px-2 py-1 font-mono font-bold tabular-nums text-orange-700" role="timer" aria-label={`Sale ends in ${duration}`}>{duration}</span>;
}

export function ProductPurchasePanel({ product, options }: { product: Product; options: PurchaseResource }) {
  const data = options.data?.data;
  const price = data?.price;
  const starting = data?.plans.reduce<(typeof data.plans)[number] | undefined>((best, plan) => !best || Number(plan.monthly_emi) < Number(best.monthly_emi) ? plan : best, undefined);
  return <section className="mt-6 overflow-hidden rounded-xl border border-line bg-white shadow-sm" aria-label="Price and availability">
    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        {options.error ? <div role="alert" className="text-sm text-red-700">Price could not be refreshed. <button type="button" className="underline" onClick={options.retry}>Try again</button></div>
          : !price ? <p role="status" className="animate-pulse text-sm text-muted">Loading current price…</p>
          : <>
            <div className="product-price flex flex-wrap items-baseline gap-2">
              <strong className="text-2xl font-bold text-navy">{formatMoney(price.selling_price)}</strong>
              {Number(price.mrp) > Number(price.selling_price) && <del className="text-xs text-muted" aria-label="MRP">{formatMoney(price.mrp)}</del>}
              {price.discount_percent > 0 && <span className="product-discount text-xs font-bold text-green-700">{price.discount_percent}% off</span>}
            </div>
            <p className="availability !mb-0 !mt-2 flex items-center gap-1.5 text-xs text-green-700"><Check size={14} aria-hidden="true" />{product.available_stock > 0 ? `In stock · ${product.available_stock} available` : "Currently unavailable"}</p>
          </>}
      </div>
      <div className="sm:w-1/2">
        <button type="button" disabled className="min-h-14 w-full rounded-lg bg-yellow-400 px-5 py-4 text-base font-bold text-navy disabled:cursor-not-allowed disabled:opacity-60" aria-describedby="checkout-status">BUY NOW</button>
        <p id="checkout-status" className="mt-2 text-xs text-muted">Online checkout is not available yet.</p>
      </div>
    </div>
    {!options.error && (starting || price?.flash_sale) && <div className="grid divide-y divide-orange-200 border-t border-dashed border-orange-200 bg-orange-50/60 text-xs sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      {starting && <a href="#emi-calculator" className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-orange-100/60">
        <span><strong className="text-green-700">From {formatMoney(starting.monthly_emi)}/month</strong><span className="mt-1 block text-muted">{starting.provider.name} · {starting.tenure_months} months</span></span>
        <span className="rounded-md bg-accent px-3 py-2 font-semibold text-white">View plans</span>
      </a>}
      {price?.flash_sale && <div className="flex flex-wrap items-center gap-2 p-4">
        <Flame size={17} className="text-orange-600" aria-hidden="true" /><strong>{price.flash_sale.name}</strong>
        <SaleCountdown key={`${price.flash_sale.id}-${price.server_time}`} endsAt={price.flash_sale.ends_at} serverTime={price.server_time} onEnd={options.retry} />
        <span className="w-full text-muted">Ends {new Date(price.flash_sale.ends_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>}
    </div>}
  </section>;
}
