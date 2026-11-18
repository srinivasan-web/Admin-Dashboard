import { ArrowRight, ListChecks } from "lucide-react";
import { Link } from "../../app/navigation";
import type { Product } from "../../api/catalog";
import { EmiCalculator } from "./EmiCalculator";
import type { PurchaseResource } from "../../api/purchase";
import { ProductHighlights } from "./ProductHighlights";
import { ProductOffers } from "./ProductOffers";
import { ShareProductButton } from "./ShareProductButton";

export function ProductSummary({ product, purchaseOptions }: { product: Product; purchaseOptions: PurchaseResource }) {
  const model = product.additional_details?.model_number?.trim();
  const typeHref = `/equipment/${encodeURIComponent(product.product_type.slug)}`;
  const hasDetails = Boolean(product.description?.trim() || product.short_description?.trim() || product.details?.some((detail) => detail.is_active && detail.content.trim()));
  const hasSpecifications = product.specifications.some((specification) => specification.attribute.name.trim() && specification.value.trim());

  return (
    <div className="product-intro min-w-0 !p-0">
      <div className="mb-5 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <Link className="rounded-full bg-surface px-3 py-1.5 text-muted hover:text-accent-deep" href={typeHref}>{product.product_type.name}</Link>
        </div>
        <ShareProductButton key={product.id} name={product.name} />
      </div>
      <ProductHighlights product={product} />
      <ProductOffers key={product.id} productId={product.id} />
      <EmiCalculator key={product.id} productId={product.id} options={purchaseOptions} />
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {product.brand?.name && <span>By <strong className="font-medium text-navy">{product.brand.name}</strong></span>}
        {model && <span>Model <span className="font-medium text-navy">{model}</span></span>}
        <span className="sku !mb-0">SKU <span className="font-medium text-navy">{product.sku}</span></span>
      </div>

      {(hasDetails || hasSpecifications) && <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
        {hasDetails && <a className="button primary flex-1" href="#product-details">Explore the details <ArrowRight size={17} aria-hidden="true" /></a>}
        {hasSpecifications && <a className="button secondary flex-1" href="#product-specifications"><ListChecks size={17} aria-hidden="true" /> Specifications</a>}
      </div>}
      <Link className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-accent-deep" href={typeHref}>Explore more {product.product_type.name} <ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  );
}
