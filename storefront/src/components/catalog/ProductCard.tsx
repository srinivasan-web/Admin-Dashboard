import { useState } from "react";
import {
  ArrowRight,
  CircleDot,
  Dumbbell,
  Gauge,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "../../app/navigation";
import { specificationValue, type Product } from "../../api/catalog";

function validAmount(value: string | null | undefined): number | null {
  if (value == null || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function ProductImage({
  product,
  url,
  eager = false,
}: {
  product: Product;
  url?: string;
  eager?: boolean;
}) {
  const source =
    url ??
    product.images.find((image) => image.is_primary)?.url ??
    product.images[0]?.url;
  const [failedSource, setFailedSource] = useState<string>();
  return source && source !== failedSource ? (
    <img
      src={source}
      alt={product.name}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      width="640"
      height="640"
      onError={() => setFailedSource(source)}
    />
  ) : (
    <span className="image-fallback">
      <Dumbbell size={42} strokeWidth={1.25} aria-hidden="true" />
      <span>Image coming soon</span>
    </span>
  );
}
export function ProductPrice({
  product,
  showDiscount = false,
}: {
  product: Product;
  showDiscount?: boolean;
}) {
  const format = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: product.price.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  const mrp = validAmount(product.price.mrp);
  const sale = validAmount(product.price.sale);
  const current = sale !== null && (mrp === null || sale <= mrp) ? sale : mrp;
  const originalPrice = mrp !== null && sale !== null && sale < mrp ? mrp : null;
  const discountPercent =
    originalPrice !== null && sale !== null
      ? Math.round(((originalPrice - sale) / originalPrice) * 100)
      : 0;

  if (current === null) {
    return <p className="product-price-unavailable">Price unavailable</p>;
  }

  return (
    <div className="product-price">
      <strong>{format(current)}</strong>
      {originalPrice !== null && (
        <del aria-label={`MRP ${format(originalPrice)}`}>
          {format(originalPrice)}
        </del>
      )}
      {showDiscount && discountPercent > 0 && (
        <span className="product-discount">{discountPercent}% off</span>
      )}
    </div>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const primaryImage =
    product.images.find((image) => image.is_primary) ?? product.images[0];
  const highlights = product.highlights
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
  const href = `/products/${encodeURIComponent(product.id)}`;
  const tag = product.tag?.trim();

  return (
    <article className="product-card">
      <div className="product-media">
        <Link
          className="product-image"
          href={href}
          aria-label={`View ${product.name}`}
        >
          <ProductImage product={product} url={primaryImage?.url} />
          {tag && <span className="product-tag">{tag}</span>}
        </Link>
      </div>
      <div className="product-card-body">
        <p className="product-meta">
          {product.product_type?.name ?? product.category.name}
        </p>
        <h3>
          <Link href={href}>{product.name}</Link>
        </h3>
        <div className="product-card-divider" aria-hidden="true" />
        {highlights.length > 0 && (
          <dl className="card-highlights">
            {highlights.map((item) => (
              <div key={item.id}>
                <dt>
                  <SpecificationIcon name={item.specification.attribute.name} />
                  <span>{item.specification.attribute.name}</span>
                </dt>
                <dd>{specificationValue(item.specification)}</dd>
              </div>
            ))}
          </dl>
        )}
        <ProductPrice product={product} showDiscount />
        <Link className="product-card-cta" href={href}>
          View product <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function SpecificationIcon({ name }: { name: string }) {
  const label = name.toLocaleLowerCase();
  const Icon: LucideIcon = /speed|range|velocity/.test(label)
    ? Gauge
    : /weight|capacity|load/.test(label)
      ? Weight
      : /motor|power|horsepower|\bhp\b/.test(label)
        ? Zap
        : CircleDot;

  return <Icon size={14} strokeWidth={2} aria-hidden="true" />;
}
