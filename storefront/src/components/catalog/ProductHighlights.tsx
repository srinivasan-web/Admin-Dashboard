import {
  CircleDot,
  Droplets,
  Dumbbell,
  Gauge,
  HeartPulse,
  LayoutGrid,
  Maximize2,
  Monitor,
  Radio,
  ShieldCheck,
  FoldVertical,
  TrendingUp,
  Volume2,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { descriptionAsEditorHtml } from "../../../../shared/productDescription";
import { specificationValue, type Product, type Specification } from "../../api/catalog";

function summaryText(product: Product): { text: string; isFullDescription: boolean } | null {
  const summary = product.short_description?.trim();
  if (summary) return { text: summary, isFullDescription: false };

  const description = product.description?.trim();
  if (!description) return null;

  // The full description can contain editor HTML. Reuse its sanitizer and
  // present plain text here; the complete formatted copy remains below.
  const content = document.createElement("div");
  content.innerHTML = descriptionAsEditorHtml(description);
  const text = content.textContent?.replace(/\s+/g, " ").trim();
  return text ? { text, isFullDescription: true } : null;
}

export function specificationIcon(attribute: Specification["attribute"]): LucideIcon {
  // Attribute.icon is a stored name, never executable markup. Recognize its
  // common names first, then infer a suitable glyph from the attribute label.
  const words = `${attribute.icon ?? ""} ${attribute.slug ?? ""} ${attribute.name}`
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  const has = (...values: string[]) => values.some((value) => words.includes(value));
  if (has("motor", "power", "watt", "watts", "hp", "zap", "bolt")) return Zap;
  if (has("speed", "velocity", "rpm", "pace", "gauge")) return Gauge;
  if (has("incline", "slope", "elevation")) return TrendingUp;
  if (has("weight", "capacity", "load", "flywheel", "scale")) return Weight;
  if (has("display", "screen", "console", "lcd", "monitor")) return Monitor;
  if (has("program", "mode", "preset", "grid")) return LayoutGrid;
  if (has("warranty", "guarantee", "shield")) return ShieldCheck;
  if (has("heart", "pulse", "cardio")) return HeartPulse;
  if (has("bluetooth", "wifi", "wireless", "radio")) return Radio;
  if (has("dimension", "dimensions", "size", "surface", "length", "width", "belt")) return Maximize2;
  if (has("audio", "speaker", "sound", "music", "volume")) return Volume2;
  if (has("fold", "folding", "foldable")) return FoldVertical;
  if (has("lubrication", "lubricant", "oil")) return Droplets;
  if (has("strength", "resistance", "dumbbell")) return Dumbbell;
  return CircleDot;
}

export function ProductHighlights({ product }: { product: Product }) {
  const selected = product.highlights
    .filter((highlight) => highlight.is_active)
    .map((highlight) => highlight.specification);
  const specifications = (selected.length ? selected : product.specifications).slice(0, 4);
  const description = summaryText(product);

  return (
    <section
      className="w-full rounded-2xl border border-line bg-white p-5 shadow-[0_8px_28px_rgba(7,26,43,0.06)] sm:p-6"
      aria-labelledby="product-highlight-title"
      data-testid="product-highlight-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h1 id="product-highlight-title" className="!mb-0 min-w-0 break-words text-navy">{product.name}</h1>
        {product.tag?.trim() && (
          <span className="max-w-28 shrink-0 rounded-full bg-[#fff0e7] px-3 py-1.5 text-center text-[11px] font-bold leading-4 text-[#a83d00] sm:max-w-36">
            {product.tag}
          </span>
        )}
      </div>

      {specifications.length > 0 && (
        <dl className="mt-5 flex w-full flex-wrap gap-2.5" data-testid="product-highlights">
          {specifications.map((specification) => (
            <SpecificationChip key={specification.id} specification={specification} />
          ))}
        </dl>
      )}

      {description && (
        <div className="mt-5 w-full border-t border-line pt-5 sm:mt-6 sm:pt-6">
          <p className="m-0 line-clamp-4 text-sm leading-7 whitespace-pre-line text-muted" data-testid="product-highlight-description">
            {description.text}
          </p>
          {description.isFullDescription && description.text.length > 180 && (
            <a href="#product-details" className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[#a83d00] hover:underline">Read full description</a>
          )}
        </div>
      )}
    </section>
  );
}

function SpecificationChip({ specification }: { specification: Specification }) {
  const Icon = specificationIcon(specification.attribute);
  const value = specificationValue(specification);

  return (
    <div
      className="flex max-w-full items-center gap-2 rounded-full border border-line bg-surface/60 py-1.5 pr-3 pl-1.5 text-xs leading-5"
      title={`${specification.attribute.name}: ${value}`}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff0e7] text-[#d84e00]" aria-hidden="true">
        <Icon size={15} strokeWidth={2} />
      </span>
      <dt className="min-w-0 truncate text-muted">{specification.attribute.name}</dt>
      <dd className="m-0 min-w-0 truncate font-semibold text-navy">{value}</dd>
    </div>
  );
}
