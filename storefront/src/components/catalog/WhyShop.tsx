import { useCatalogResource, type Collection, type ShopBenefit } from "../../api/catalog";
import { ErrorState, LoadingState } from "../Feedback";

export function WhyShop() {
  const benefits = useCatalogResource<Collection<ShopBenefit>>("/shop-benefits", { refreshOnFocus: true });
  if (benefits.error) return <section className="mt-12" aria-label="Why shop with Durafit91"><ErrorState error={benefits.error} retry={benefits.retry} /></section>;
  if (!benefits.data) return <LoadingState label="Loading shopping information…" />;
  if (!benefits.data.data.length) return null;

  return (
    <section id="why-shop" className="mt-12 scroll-mt-44 border-t border-line pt-8 sm:mt-16 sm:pt-12" aria-labelledby="why-shop-title">
      <p className="mb-2 text-xs font-semibold tracking-widest text-accent-deep">THE DURAFIT EXPERIENCE</p>
      <h2 id="why-shop-title" className="text-2xl font-bold sm:text-3xl">Why shop with Durafit91</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="shop-benefits">
        {benefits.data.data.map((benefit) => (
          <li key={benefit.id} className="min-w-0 rounded-2xl border border-line bg-surface/50 p-5">
            {benefit.icon_url && <img src={benefit.icon_url} alt="" width={42} height={42} loading="lazy" className="mb-4 size-10 object-contain" />}
            <h3 className="text-base font-semibold text-navy">{benefit.title}</h3>
            {benefit.description && <p className="mt-2 text-sm leading-6 text-muted">{benefit.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
