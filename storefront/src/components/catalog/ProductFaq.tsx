import { useCatalogResource, type CategoryFaq, type Collection } from "../../api/catalog";
import { ErrorState, LoadingState } from "../Feedback";

export function ProductFaq({ categoryId }: { categoryId: string }) {
  const faqs = useCatalogResource<Collection<CategoryFaq>>(
    `/category-faqs?category_id=${encodeURIComponent(categoryId)}`,
    { refreshOnFocus: true },
  );

  if (faqs.error) return <section className="mt-12" aria-label="Frequently asked questions"><ErrorState error={faqs.error} retry={faqs.retry} /></section>;
  if (!faqs.data) return <LoadingState label="Loading product questions…" />;
  if (!faqs.data.data.length) return null;

  return (
    <section id="product-faqs" className="mt-12 scroll-mt-44 border-t border-line pt-8 sm:mt-16 sm:pt-12" aria-labelledby="product-faq-title">
      <p className="mb-2 text-xs font-semibold tracking-widest text-accent-deep">HELPFUL ANSWERS</p>
      <h2 id="product-faq-title" className="text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line" data-testid="product-faqs">
        {faqs.data.data.map((faq) => (
          <details key={faq.id} className="group bg-white px-5 py-1 open:bg-surface/40 sm:px-7">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-navy marker:hidden focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
              <span>{faq.question}</span><span aria-hidden="true" className="shrink-0 text-xl text-accent-deep group-open:rotate-45">+</span>
            </summary>
            <p className="max-w-prose whitespace-pre-line pb-5 text-sm leading-7 text-muted">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
