import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { descriptionAsEditorHtml } from "../../../../shared/productDescription";
import { specificationValue, type Product } from "../../api/catalog";
import { specificationIcon } from "./ProductHighlights";

const tabs = [
  { id: "product-details", title: "Product details" },
  { id: "product-specifications", title: "Specifications" },
] as const;
type Tab = typeof tabs[number]["id"];

export function ProductInformation({ product }: { product: Product }) {
  const details = (product.details ?? []).filter((detail) => detail.is_active && detail.content.trim());
  const specifications = product.specifications.filter((specification) => specification.attribute.name.trim() && specification.value.trim());
  const hasDetails = Boolean(product.description?.trim() || product.short_description?.trim() || details.length);
  const hasSpecifications = specifications.length > 0;
  const availableTabs = tabs.filter((tab) => tab.id === "product-details" ? hasDetails : hasSpecifications);
  const [active, setActive] = useState<Tab>(() =>
    window.location.hash === "#product-specifications" && hasSpecifications
      ? "product-specifications"
      : hasDetails ? "product-details" : "product-specifications",
  );
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (availableTabs.length && !availableTabs.some((tab) => tab.id === active)) setActive(availableTabs[0].id);
  }, [active, hasDetails, hasSpecifications]);

  useEffect(() => {
    const syncHash = () => {
      const tab = availableTabs.find((candidate) => `#${candidate.id}` === window.location.hash);
      if (!tab) return;
      setActive(tab.id);
      requestAnimationFrame(() => document.getElementById(tab.id)?.scrollIntoView({ block: "start" }));
    };
    window.addEventListener("hashchange", syncHash);
    syncHash();
    return () => window.removeEventListener("hashchange", syncHash);
  }, [hasDetails, hasSpecifications]);

  function select(index: number, focus = false) {
    const tab = availableTabs[index];
    if (!tab) return;
    setActive(tab.id);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${tab.id}`);
    if (focus) buttons.current[index]?.focus();
  }

  if (!availableTabs.length) return null;

  return (
    <section className="mt-12 min-w-0 scroll-mt-36 border-t border-line pt-8 sm:mt-16 sm:pt-12" aria-labelledby="equipment-details-title">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">Get to know your equipment</p>
      <h2 id="equipment-details-title" className="mb-6 text-2xl font-bold text-navy sm:text-3xl">Know your {product.product_type.name}</h2>
      <div className="max-w-5xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_30px_rgba(7,26,43,0.06)]">
        <div className={`grid gap-1 border-b border-line bg-surface/70 p-1.5 sm:p-2 ${availableTabs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`} role="tablist" aria-label="Product information">
          {availableTabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => { buttons.current[index] = element; }}
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={tab.id}
              tabIndex={active === tab.id ? 0 : -1}
              className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active === tab.id ? "bg-accent text-white shadow-sm" : "text-navy hover:bg-white"}`}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                const target = event.key === "Home" ? 0 : event.key === "End" ? availableTabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % availableTabs.length : event.key === "ArrowLeft" ? (index - 1 + availableTabs.length) % availableTabs.length : null;
                if (target !== null) { event.preventDefault(); select(target, true); }
              }}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {hasDetails && (
          <div id="product-details" role="tabpanel" aria-labelledby="product-details-tab" tabIndex={0} hidden={active !== "product-details"} className="scroll-mt-48 p-5 focus-visible:outline-accent sm:p-8">
            {product.description?.trim() ? (
              <div className="product-description break-words text-sm leading-7 text-navy [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2" dangerouslySetInnerHTML={{ __html: descriptionAsEditorHtml(product.description) }} />
            ) : product.short_description?.trim() ? (
              <p className="text-sm leading-7 text-navy">{product.short_description}</p>
            ) : null}
            {details.map((detail) => (
              <section key={detail.id} className="mt-6 border-t border-line pt-6 first:mt-0 first:border-0 first:pt-0" aria-labelledby={`detail-${detail.id}`}>
                <h3 id={`detail-${detail.id}`} className="mb-3 text-base font-semibold text-navy">{detail.title}</h3>
                <div className="product-description break-words text-sm leading-7 text-navy [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2" dangerouslySetInnerHTML={{ __html: descriptionAsEditorHtml(detail.content) }} />
              </section>
            ))}
          </div>
        )}

        {hasSpecifications && (
          <div id="product-specifications" role="tabpanel" aria-labelledby="product-specifications-tab" tabIndex={0} hidden={active !== "product-specifications"} className="scroll-mt-48 p-4 focus-visible:outline-accent sm:p-7">
            <dl className="grid gap-2 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3" data-testid="product-specifications">
              {specifications.map((specification) => {
                const Icon = specificationIcon(specification.attribute);
                return (
                  <div key={specification.id} className="flex min-w-0 items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface/60">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-orange-200 bg-orange-50 text-accent-deep" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>
                    <div className="min-w-0">
                      <dt className="break-words text-sm font-semibold text-navy">{specification.attribute.name}</dt>
                      <dd className="m-0 mt-0.5 break-words text-xs leading-5 text-muted">{specificationValue(specification)}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductDeclarations({ product }: { product: Product }) {
  const labels = [
    ["generic_name", "Generic name"], ["model_number", "Model number"],
    ["net_quantity", "Net quantity"], ["country_of_origin", "Country of origin"],
    ["manufactured_by", "Manufactured by"], ["marketed_by", "Marketed by"],
    ["consumer_complaints", "Consumer complaints"],
  ] as const;
  const rows = labels.flatMap(([field, label]) => {
    const value = product.additional_details?.[field]?.trim();
    return value ? [{ field, label, value }] : [];
  });
  if (!rows.length) return null;

  return (
    <section id="product-information" className="mt-6 scroll-mt-36" aria-label="Additional details">
      <details open className="group overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_30px_rgba(7,26,43,0.06)]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-bold text-navy marker:hidden [&::-webkit-details-marker]:hidden">
          Additional details
          <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={20} aria-hidden="true" />
        </summary>
        <dl className="border-t border-line" data-testid="product-declarations">
          {rows.map(({ field, label, value }) => (
            <div key={field} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-3 px-5 py-3.5 text-xs leading-5 odd:bg-surface/60 sm:gap-5">
              <dt className="break-words text-muted">{label}</dt>
              <dd className="m-0 min-w-0 break-words whitespace-pre-line font-medium text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
