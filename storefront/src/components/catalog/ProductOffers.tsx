import { useState } from "react";
import { Check, Copy, TicketPercent } from "lucide-react";
import { useCatalogResource, type Collection, type ProductOffer } from "../../api/catalog";

const money = (value: string) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(Number(value));

function discountLabel(offer: ProductOffer): string | null {
  if (!offer.discount_type || !offer.discount_value) return null;
  return offer.discount_type === "percent"
    ? `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(offer.discount_value))}% off`
    : `${money(offer.discount_value)} off`;
}

function OfferCard({ offer }: { offer: ProductOffer }) {
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  const discount = discountLabel(offer);

  async function copyCode() {
    if (!offer.coupon_code) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(offer.coupon_code);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }

  return (
    <li className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-[0_6px_22px_rgba(7,26,43,0.05)] sm:p-6" data-testid="product-offer">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#ff6b1a]" />
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0e7] text-[#d84e00]" aria-hidden="true"><TicketPercent size={21} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 break-words text-base font-bold text-navy">{offer.title}</h3>
            {discount && <span className="rounded-full bg-[#fff0e7] px-2.5 py-1 text-[11px] font-bold text-[#a83d00]">{discount}</span>}
          </div>
          {offer.description && <p className="mt-1.5 text-sm leading-6 text-muted">{offer.description}</p>}
        </div>
      </div>

      {offer.coupon_code && (
        <div className="mt-4 flex min-w-0 flex-col overflow-hidden rounded-xl border border-dashed border-[#ff6b1a] bg-[#fffaf7] sm:flex-row sm:items-stretch">
          <code className="min-w-0 flex-1 select-all break-all px-4 py-3 text-center text-sm font-bold tracking-wider text-navy sm:text-left" data-testid="offer-code">{offer.coupon_code}</code>
          <button type="button" onClick={() => void copyCode()} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#ff6b1a] px-5 text-sm font-bold text-white transition-colors hover:bg-[#dc5100] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b1a]" aria-label={`Copy coupon code ${offer.coupon_code}`}>
            {feedback === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {feedback === "copied" ? "Copied" : "Copy code"}
          </button>
        </div>
      )}
      {feedback === "copied" && <p role="status" className="mt-2 text-xs font-medium text-emerald-700">Coupon code copied.</p>}
      {feedback === "failed" && <p role="alert" className="mt-2 text-xs font-medium text-red-700">Copy unavailable. Select the code above to copy it manually.</p>}
      {(offer.minimum_order_amount || offer.maximum_discount || offer.ends_at) && (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-muted">
          {offer.minimum_order_amount && <span>Minimum order {money(offer.minimum_order_amount)}</span>}
          {offer.maximum_discount && <span>Maximum discount {money(offer.maximum_discount)}</span>}
          {offer.ends_at && <span>Ends {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(offer.ends_at))}</span>}
        </p>
      )}
    </li>
  );
}

export function ProductOffers({ productId }: { productId: string }) {
  const offers = useCatalogResource<Collection<ProductOffer>>(`/products/${encodeURIComponent(productId)}/offers`, { refreshOnFocus: true });

  if (offers.error) return (
    <section className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" aria-label="Product offers" role="alert">
      Offers could not be loaded. <button type="button" onClick={offers.retry} className="ml-2 min-h-9 font-semibold underline">Try again</button>
    </section>
  );
  if (!offers.data) return <div className="mt-4 w-full animate-pulse rounded-2xl border border-line bg-surface/60 p-5" role="status">Loading offers…</div>;
  if (!offers.data.data.length) return null;

  return (
    <section className="mt-4 w-full" aria-labelledby="product-offers-title" data-testid="product-offers">
      <h2 id="product-offers-title" className="mb-3 text-base font-bold text-navy">Exciting offers</h2>
      <ul className="m-0 grid list-none gap-3 p-0">
        {offers.data.data.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
      </ul>
    </section>
  );
}
