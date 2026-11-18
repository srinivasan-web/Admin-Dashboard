import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CircleDot,
  CreditCard,
  Dumbbell,
  Gauge,
  Layers,
  TrendingUp,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "../../app/navigation";
import { productHref, specificationValue, type Product } from "../../api/catalog";
import { productViews } from "./productViews";

export function validAmount(value: string | null | undefined): number | null {
  if (value == null || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProductImage({
  product,
  url,
  eager = false,
  className = "",
}: {
  product: Pick<Product, "name" | "images">;
  url?: string;
  eager?: boolean;
  className?: string;
}) {
  const photos = productViews(product.images ?? []).photos;
  const allImages = photos.length ? photos : product.images ?? [];
  const primary = allImages.find((img) => img.is_primary)?.url;
  const defaultUrl = url ?? primary ?? allImages[0]?.url;

  const [currentIdx, setCurrentIdx] = useState<number>(() => {
    if (!defaultUrl) return -1;
    const found = allImages.findIndex((img) => img.url === defaultUrl);
    return found >= 0 ? found : 0;
  });
  const [failedAll, setFailedAll] = useState(false);

  function handleError() {
    // Try the next available image in the list before falling back
    if (currentIdx + 1 < allImages.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setFailedAll(true);
    }
  }

  const currentSource = !failedAll && currentIdx >= 0 && currentIdx < allImages.length
    ? allImages[currentIdx]?.url
    : defaultUrl;

  const altText =
    (currentIdx >= 0 && allImages[currentIdx]?.alt_text?.trim()) ||
    product.name;

  return currentSource && !failedAll ? (
    <img
      src={currentSource}
      alt={altText}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      width="640"
      height="640"
      className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 ${className}`.trim()}
      onError={handleError}
    />
  ) : (
    <div className="image-fallback flex flex-col items-center justify-center gap-2 text-center text-slate-400 p-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <Dumbbell size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <span className="text-[11px] font-medium text-slate-400">Durafit91 Equipment</span>
    </div>
  );
}

export function ProductPrice({
  product,
  showDiscount = false,
  className = "",
}: {
  product: Pick<Product, "price">;
  showDiscount?: boolean;
  className?: string;
}) {
  const mrp = validAmount(product.price.mrp);
  const sale = validAmount(product.price.sale);
  const current = sale !== null && (mrp === null || sale <= mrp) ? sale : mrp;
  const originalPrice = mrp !== null && sale !== null && sale < mrp ? mrp : null;
  const discountPercent =
    originalPrice !== null && sale !== null
      ? Math.round(((originalPrice - sale) / originalPrice) * 100)
      : 0;

  if (current === null) {
    return <p className={`product-price-unavailable text-xs font-medium text-slate-400 ${className}`.trim()}>Price unavailable</p>;
  }

  return (
    <div className={`product-price flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`.trim()}>
      <strong className="text-[18px] sm:text-[19px] font-bold text-navy tracking-tight font-tech">
        {formatIndianCurrency(current)}
      </strong>
      {originalPrice !== null && (
        <del className="text-xs text-slate-400 font-normal line-through" aria-label={`MRP ${formatIndianCurrency(originalPrice)}`}>
          {formatIndianCurrency(originalPrice)}
        </del>
      )}
      {showDiscount && discountPercent > 0 && (
        <span className="product-discount inline-flex items-center rounded-full bg-orange-50 border border-orange-200/60 px-2 py-0.5 text-[10px] font-bold text-accent-deep tracking-tight">
          {discountPercent}% OFF
        </span>
      )}
    </div>
  );
}

export function SpecificationIcon({ name }: { name: string }) {
  const label = name.toLocaleLowerCase();
  const Icon: LucideIcon = /speed|range|velocity/.test(label)
    ? Gauge
    : /weight|capacity|load|user weight/.test(label)
      ? Weight
      : /motor|power|horsepower|\bhp\b/.test(label)
        ? Zap
        : /incline|elevation/.test(label)
          ? TrendingUp
          : /display|screen|console|bluetooth/.test(label)
            ? Activity
            : /dimension|surface|running|belt/.test(label)
              ? Layers
              : CircleDot;

  return <Icon size={13} strokeWidth={2} aria-hidden="true" className="text-accent shrink-0" />;
}

export function ProductCard({
  product,
  eager = false,
}: {
  product: Product;
  eager?: boolean;
}) {
  const { photos, has360: hasFrames } = productViews(product.images);
  const has360 = product.has_360_view ?? hasFrames;
  const primaryImage =
    photos.find((image) => image.is_primary) ?? photos[0] ?? product.images[0];
  const highlights = (product.highlights ?? [])
    .filter(
      (item) =>
        item.is_active &&
        Boolean(item.specification?.attribute?.name?.trim()) &&
        Boolean(item.specification?.value?.trim()),
    )
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, 3);

  const href = productHref(product);
  const tag = product.tag?.trim();
  const sale = validAmount(product.price.sale);
  const mrp = validAmount(product.price.mrp);
  const currentPrice = sale !== null && (mrp === null || sale <= mrp) ? sale : mrp;

  // Calculate starting monthly EMI (e.g. 12-month standard/no-cost estimate)
  const monthlyEmi = currentPrice && currentPrice >= 3000 ? Math.round(currentPrice / 12) : null;

  return (
    <article className="product-card group relative flex flex-col h-full rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300">
      {/* Media / Image Container */}
      <div className="product-media relative w-full mb-3">
        <Link
          className="product-image relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50/80 p-3 sm:p-4 transition-colors group-hover:bg-slate-100/60"
          href={href}
          aria-label={`View ${product.name}`}
        >
          <ProductImage product={product} url={primaryImage?.url} eager={eager} />

          {/* Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10 max-w-[80%]">
            {tag && (
              <span className="product-tag inline-block truncate rounded-md bg-[#ff6b1a] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                {tag}
              </span>
            )}
            {!tag && mrp && sale && Math.round(((mrp - sale) / mrp) * 100) >= 40 && (
              <span className="product-tag inline-block truncate rounded-md bg-accent-deep px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                Top Deal
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Body Information */}
      <div className="product-card-body flex flex-col flex-1 min-w-0">
        {/* Category & Brand Metadata */}
        <p className="product-meta mb-1 block w-full truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {product.product_type?.name ?? product.category?.name ?? "Equipment"}
          {product.brand?.name ? ` • ${product.brand.name}` : ""}
        </p>

        {/* Product Name */}
        <h3 className="product-title mb-2 min-h-[2.6rem] text-[15px] sm:text-[16px] font-bold leading-snug tracking-tight text-navy line-clamp-2">
          <Link href={href} className="hover:text-accent-deep transition-colors">
            {product.name}
          </Link>
        </h3>

        {/* Specification Highlights Micro-Grid */}
        {highlights.length > 0 && (
          <div className="card-highlights mb-3 grid grid-cols-3 gap-1.5 rounded-lg bg-slate-50/90 p-2 border border-slate-100/90">
            {highlights.map((item) => (
              <div key={item.id} className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 truncate mb-0.5">
                  <SpecificationIcon name={item.specification.attribute.name} />
                  <span className="truncate">{item.specification.attribute.name}</span>
                </div>
                <span className="text-[11px] font-bold text-navy font-tech truncate" title={specificationValue(item.specification)}>
                  {specificationValue(item.specification)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pricing Container */}
        <div className="mt-auto pt-2">
          <ProductPrice product={product} showDiscount />

          {/* EMI snippet */}
          {monthlyEmi && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <CreditCard size={13} className="text-accent-deep shrink-0" aria-hidden="true" />
              <span>No Cost EMI from <strong className="font-semibold text-navy">{formatIndianCurrency(monthlyEmi)}/mo</strong></span>
            </div>
          )}

          {/* CTA Action Button */}
          <Link
            className="product-card-cta mt-3.5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b1a] px-4 text-[12px] sm:text-[13px] font-bold text-white transition-all duration-200 hover:bg-[#e94f00] active:scale-[0.98] shadow-xs hover:shadow-md"
            href={href}
          >
            <span>View Details</span>
            <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          {has360 && (
            <Link href={`${href}?view=360`} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-navy hover:border-accent hover:text-accent-deep">
              Explore the real product in 360° <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs animate-pulse">
      <div className="aspect-square w-full rounded-xl bg-slate-100 mb-3" />
      <div className="h-3 w-1/3 bg-slate-100 rounded mb-2" />
      <div className="h-5 w-4/5 bg-slate-100 rounded mb-1.5" />
      <div className="h-5 w-2/3 bg-slate-100 rounded mb-4" />
      <div className="h-12 w-full bg-slate-50 rounded-lg mb-3" />
      <div className="mt-auto">
        <div className="h-6 w-1/2 bg-slate-100 rounded mb-2" />
        <div className="h-3.5 w-2/3 bg-slate-100 rounded mb-4" />
        <div className="h-10 w-full bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}
