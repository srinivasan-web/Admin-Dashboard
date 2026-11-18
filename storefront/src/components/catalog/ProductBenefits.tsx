import type { Product } from "../../api/catalog";

export function ProductBenefits({ product }: { product: Product }) {
  const benefits = (product.benefits ?? []).filter((benefit) => benefit.is_active);
  if (!benefits.length) return null;
  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface/60 p-5 sm:mt-12 sm:p-7" aria-labelledby="product-benefits-title">
      <h2 id="product-benefits-title" className="mb-5 text-lg font-semibold">Additional benefits</h2>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="product-benefits">
        {benefits.map((benefit) => (
          <li key={benefit.id} className="flex min-w-0 items-start gap-3">
            {benefit.icon_url && <img src={benefit.icon_url} alt="" width={36} height={36} loading="lazy" className="size-9 shrink-0 object-contain" />}
            <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-navy">{benefit.title}</h3>{benefit.description && <p className="mt-1.5 text-xs leading-6 text-muted">{benefit.description}</p>}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
