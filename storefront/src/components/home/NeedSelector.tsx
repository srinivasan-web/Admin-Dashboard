import { useId, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Headset,
  House,
  RefreshCw,
  Ruler,
  Users,
  Wallet,
  Waves,
} from "lucide-react";
import { Link } from "../../app/navigation";
import { productHref, specificationValue, type Product } from "../../api/catalog";
import { ProductImage, ProductPrice } from "../catalog/ProductCard";
import {
  needJourney,
  needScenarios,
  previewProduct,
  previewSpecification,
  type NeedId,
} from "./needScenarios";

const needIcons = {
  space: Ruler,
  routine: Waves,
  budget: Wallet,
  household: Users,
  practicalities: House,
  support: Headset,
};

const needVisualColors: Record<NeedId, string> = {
  space: "bg-[#f4f1eb]",
  routine: "bg-[#edf2f1]",
  budget: "bg-[#f6efe9]",
  household: "bg-[#eef0f5]",
  practicalities: "bg-[#f0f1eb]",
  support: "bg-[#edf1f4]",
};

export function NeedSelector({
  products,
  loading,
  error,
  onRetry,
}: {
  products: Product[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}) {
  const [selected, setSelected] = useState<NeedId>("space");
  const id = useId();
  const need =
    needScenarios.find((item) => item.id === selected) ?? needScenarios[0];
  const product = previewProduct(products, need);
  const specification = product
    ? previewSpecification(product, need)
    : undefined;
  const Icon = needIcons[need.id];
  const href = needJourney(need, product);
  const cta =
    need.destination === "specifications" && !product
      ? "Explore equipment"
      : need.cta;

  return (
    <section
      className="border-b border-line py-16 lg:py-14"
      id="find-your-fit"
      data-testid="need-selector"
      aria-labelledby={`${id}-heading`}
    >
      <div className="mb-3 grid gap-4 lg:mb-10 lg:grid-cols-[1fr_340px] lg:gap-x-12">
        <h2
            className="m-0 text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.15] font-bold"
           id={`${id}-heading`}
          >
          Your starting point
        </h2> 
      </div>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <fieldset className="m-0 grid min-w-0 grid-cols-2 content-start gap-2 border-0 p-0 lg:grid-cols-1 lg:gap-0">
          <legend className="sr-only">Choose what matters to you</legend>
          {needScenarios.map((item, index) => {
            const OptionIcon = needIcons[item.id];
            return (
              <button
                key={item.id}
                type="button"
                className={`flex min-h-16 min-w-0 items-center gap-3 border-b px-3 py-4 text-left text-[13px] font-medium transition-colors duration-200 hover:bg-surface hover:text-navy lg:min-h-20 lg:px-2 [&>svg]:shrink-0 ${
                  selected === item.id
                    ? "border-accent bg-warm text-navy [&>svg]:text-accent-deep"
                    : "border-line bg-white text-muted"
                }`}
                aria-pressed={selected === item.id}
                aria-controls={`${id}-panel`}
                data-testid="need-option"
                onClick={() => setSelected(item.id)}
              >
                <span
                  className="hidden font-tech text-[10px] text-muted lg:inline"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <OptionIcon size={21} strokeWidth={1.5} aria-hidden="true" />
                <span className="min-w-0 flex-1">{item.label}</span>
                <ArrowUpRight
                  className={`hidden lg:block ${selected === item.id ? "opacity-100" : "opacity-0"}`}
                  size={18}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </fieldset>

        <div
          className="grid min-w-0 overflow-hidden border border-line bg-white xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-title`}
          data-need={selected}
          data-testid="need-panel"
        >
          <div
            className={`${needVisualColors[need.id]} relative flex min-h-[360px] min-w-0 flex-col overflow-hidden p-6`}
          >
            <div className="relative z-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
              <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
              <span>{need.shortLabel}</span>
            </div>
            <span
              className="pointer-events-none absolute top-18 right-8 bottom-30 left-8 border-b border-l border-navy/10"
              aria-hidden="true"
            />
            <div
              className="relative flex min-h-56 flex-1 items-center justify-center py-5 [&>img]:max-h-[280px] [&>img]:w-full [&>img]:object-contain [&>img]:mix-blend-multiply"
              data-testid="need-product-visual"
            >
              {product ? (
                <ProductImage key={product.id} product={product} />
              ) : (
                <div
                  className="flex min-h-56 flex-col items-center justify-center gap-5 text-center text-xs text-muted"
                  role={loading ? "status" : undefined}
                >
                  <Icon size={72} strokeWidth={0.8} aria-hidden="true" />
                  <span>
                    {loading
                      ? "Loading the collection…"
                      : "Start with what matters to you."}
                  </span>
                </div>
              )}
            </div>
            <p className="relative flex max-w-64 items-center gap-2 text-xs text-muted">
              <span
                className="size-1.5 shrink-0 rounded-full bg-accent-deep"
                aria-hidden="true"
              />
              {need.visualNote}
            </p>
            {product && (
              <div
                className="relative mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-navy/15 pt-4 [&_.product-price]:m-0 [&_.product-price]:gap-2 [&_.product-price]:text-sm [&_.product-price>strong]:text-base"
                data-testid="need-product-caption"
              >
                <div>
                  <span className="mb-2 block text-[9px] font-semibold tracking-wider text-muted">
                    FROM THE CURRENT COLLECTION
                  </span>
                  <Link
                    className="inline-flex items-center gap-2 text-sm font-semibold"
                    href={productHref(product)}
                  >
                    {product.name}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                <ProductPrice product={product} />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col p-6 sm:p-8">
            <div aria-live="polite" aria-atomic="true">
              <p className="mb-4 flex items-center gap-2 font-tech text-[9px] leading-relaxed font-bold tracking-[0.13em] text-[#a43c05]">
                {need.eyebrow}
              </p>
              <h3
                className="mb-4 text-[clamp(1.5rem,2.2vw,2rem)] leading-tight"
                id={`${id}-title`}
              >
                {need.title}
              </h3>
              <p className="mb-3 text-sm font-medium">{need.problem}</p>
              <p className="text-[13px] text-muted">{need.approach}</p>
            </div>
            <div className="my-6 border-t border-line pt-5">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider">
                Before you choose
              </h4>
              <ul className="m-0 grid list-none gap-2.5 p-0">
                {need.checks.map((check) => (
                  <li
                    className="flex items-start gap-2 text-xs text-muted"
                    key={check}
                  >
                    <Check
                      className="mt-0.5 shrink-0 text-accent-deep"
                      size={15}
                      aria-hidden="true"
                    />
                    {check}
                  </li>
                ))}
              </ul>
            </div>
            {specification && product && (
              <p
                className="mb-6 grid gap-1 border-l-2 border-accent pl-3 text-xs"
                data-testid="need-specification"
              >
                <span className="text-muted">
                  {product.name} · {specification.attribute.name}
                </span>
                <strong className="font-semibold">
                  {specificationValue(specification)}
                </strong>
              </p>
            )}
            {error && !product && (
              <div
                className="mb-5 text-xs text-muted"
                data-testid="need-data-message"
                role="status"
              >
                <p>
                  The collection couldn’t be loaded. You can still explore the
                  buying guidance.
                </p>
                <button
                  className="mt-2 inline-flex min-h-10 items-center gap-2 font-semibold text-navy underline underline-offset-4"
                  type="button"
                  onClick={onRetry}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Retry collection
                </button>
              </div>
            )}
            {!loading && !error && !product && (
              <p
                className="mb-5 text-xs text-muted"
                data-testid="need-data-message"
              >
                New collection picks will appear here when available. You can
                still browse the catalog.
              </p>
            )}
            <div
              className="mt-auto grid justify-items-start gap-4"
              data-testid="need-actions"
            >
              <Link
                className="inline-flex min-h-12 max-w-full items-center justify-center gap-3 rounded-md border border-transparent bg-accent px-4 py-3 text-left text-xs leading-[1.3] font-semibold text-navy transition-[background,transform] duration-200 hover:-translate-y-px hover:bg-[#ff803c]"
                href={href}
              >
                {cta}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              {need.id === "support" && (
                <a
                  className="inline-flex min-h-10 items-center justify-start gap-2 border-0 bg-transparent py-2 text-xs font-semibold hover:text-[#a83d00]"
                  href="https://www.durafit91.com/warranty-details"
                >
                  Read warranty terms
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
