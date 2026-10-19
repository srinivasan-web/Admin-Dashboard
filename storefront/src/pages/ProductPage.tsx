import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ListChecks,
} from "lucide-react";
import { descriptionAsEditorHtml } from "../../../shared/productDescription";
import { Link } from "../app/navigation";
import {
  specificationValue,
  useCatalogResource,
  type Product,
  type Collection,
} from "../api/catalog";
import { ProductPrice } from "../components/catalog/ProductCard";
import { ProductGallery } from "../components/catalog/ProductGallery";
import { ProductCollectionCarousel } from "../components/home/ProductCollectionCarousel";
import { ErrorState, LoadingState } from "../components/Feedback";

export default function ProductPage({ id }: { id: string }) {
  const product = useCatalogResource<{ data: Product }>(
    `/products/${encodeURIComponent(id)}`,
  );
  const related = useCatalogResource<Collection<Product>>(
    product.data ? `/products/${encodeURIComponent(id)}/buy-it-with` : null,
  );

  useEffect(() => {
    if (product.data) document.title = `${product.data.data.name} | Durafit91`;
  }, [product.data]);

  if (product.error)
    return (
      <div className="product-page">
        <Link className="text-link" href="/products">
          <ArrowLeft size={16} aria-hidden="true" /> Back to equipment
        </Link>
        <ErrorState error={product.error} retry={product.retry} />
      </div>
    );
  if (!product.data) return <LoadingState label="Loading product details…" />;

  const item = product.data.data;
  const highlights = item.highlights.filter((highlight) => highlight.is_active);
  const productDetails = (item.details ?? []).filter((detail) => detail.is_active);
  const additionalDetails = item.additional_details;
  const regulatoryFields = [
    ["generic_name", "Generic name"],
    ["model_number", "Model number"],
    ["net_quantity", "Net quantity"],
    ["country_of_origin", "Country of origin"],
    ["manufactured_by", "Manufactured by"],
    ["marketed_by", "Marketed by"],
    ["consumer_complaints", "Consumer complaints contact"],
  ] as const;
  const typeHref = `/products?product_type_id=${encodeURIComponent(item.product_type.id)}`;
  const categoryHref = `/products?category_id=${encodeURIComponent(item.category.id)}`;

  return (
    <article className="product-page" data-testid="product-detail">
      <nav
        className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted sm:mb-8"
        aria-label="Breadcrumb"
      >
        <Link className="hover:text-accent-deep" href="/">
          Home
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link className="hover:text-accent-deep" href={typeHref}>
          {item.product_type.name}
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-navy" aria-current="page">
          {item.name}
        </span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div className="min-w-0 lg:sticky lg:top-44">
          <ProductGallery key={item.id} product={item} />
        </div>
        <div className="product-intro min-w-0 !p-0">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <Link
              className="rounded-full bg-surface px-3 py-1.5 text-muted hover:text-accent-deep"
              href={typeHref}
            >
              {item.product_type.name}
            </Link>
            {item.tag?.trim() && (
              <span className="rounded-full bg-warm px-3 py-1.5 text-accent-deep">
                {item.tag}
              </span>
            )}
          </div>
          <h1>{item.name}</h1>
          {item.short_description && (
            <p className="mt-3 max-w-prose text-sm leading-6 text-muted">{item.short_description}</p>
          )}
          <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            {item.brand?.name && (
              <span>
                By{" "}
                <strong className="font-medium text-navy">
                  {item.brand.name}
                </strong>
              </span>
            )}
            <span className="sku !mb-0">
              SKU <span className="font-medium text-navy">{item.sku}</span>
            </span>
          </div>
          <div className="w-full border-y border-line py-5 [&_.product-price]:flex-wrap [&_.product-price]:gap-3 [&_.product-price]:!mt-0 [&_.product-price_strong]:!text-3xl">
            <ProductPrice product={item} showDiscount />
            <p
              className="availability mt-3 mb-0 flex items-center gap-2 text-xs font-medium text-[#16683d]"
              role="status"
            >
              <Check size={16} aria-hidden="true" /> In stock ·{" "}
              {item.available_stock} available
            </p>
          </div>

          {highlights.length > 0 && (
            <section className="w-full py-6" aria-labelledby="highlights-title">
              <h2
                id="highlights-title"
                className="mb-4 text-base font-semibold tracking-normal"
              >
                At a glance
              </h2>
              <dl
                className="grid grid-cols-2 gap-3"
                data-testid="product-highlights"
              >
                {highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="rounded-xl border border-line bg-surface/60 p-4"
                  >
                    <dt className="text-xs text-muted">
                      {highlight.specification.attribute.name}
                    </dt>
                    <dd className="mt-1.5 ml-0 break-words text-sm font-semibold">
                      {specificationValue(highlight.specification)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
            <a className="button primary flex-1" href="#product-details">
              Explore the details <ArrowRight size={17} aria-hidden="true" />
            </a>
            {item.specifications.length > 0 && (
              <a
                className="button secondary flex-1"
                href="#product-specifications"
              >
                <ListChecks size={17} aria-hidden="true" /> Specifications
              </a>
            )}
          </div>
          <Link
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-accent-deep"
            href={typeHref}
          >
            Explore more {item.product_type.name}{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <nav
        className="mt-10 flex gap-6 overflow-x-auto border-b border-line text-sm font-semibold sm:mt-16"
        aria-label="Product information"
      >
        <a
          href="#product-details"
          className="inline-flex min-h-14 shrink-0 items-center border-b-2 border-accent text-accent-deep"
        >
          Overview
        </a>
        <a
          href="#product-specifications"
          className="inline-flex min-h-14 shrink-0 items-center hover:text-accent-deep"
        >
          Specifications
        </a>
        <a
          href="#product-information"
          className="inline-flex min-h-14 shrink-0 items-center hover:text-accent-deep"
        >
          Product information
        </a>
      </nav>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0 space-y-10">
          <section
            id="product-details"
            className="scroll-mt-48"
            aria-labelledby="overview-title"
          >
            <p className="mb-2 text-xs font-semibold tracking-widest text-accent-deep">
              GET TO KNOW YOUR EQUIPMENT
            </p>
            <h2
              id="overview-title"
              className="mb-5 text-2xl font-bold sm:text-3xl"
            >
              About {item.name}
            </h2>
            {item.description ? (
              <div
                className="product-description break-words"
                dangerouslySetInnerHTML={{
                  __html: descriptionAsEditorHtml(item.description),
                }}
              />
            ) : (
              <p className="text-sm text-muted">
                A detailed description has not been provided yet.
              </p>
            )}
          </section>

          {productDetails.map((detail) => (
            <section key={detail.id} className="border-t border-line pt-8" aria-labelledby={`product-detail-${detail.id}`}>
              <h2 id={`product-detail-${detail.id}`} className="mb-4 text-2xl font-bold">{detail.title}</h2>
              <div className="product-description break-words" dangerouslySetInnerHTML={{ __html: descriptionAsEditorHtml(detail.content) }} />
            </section>
          ))}

          <section
            id="product-specifications"
            className="scroll-mt-48 border-t border-line pt-8"
            aria-labelledby="specifications-title"
          >
            <h2 id="specifications-title" className="mb-5 text-2xl font-bold">
              Specifications
            </h2>
            {item.specifications.length ? (
              <dl
                className="overflow-hidden rounded-xl border border-line"
                data-testid="product-specifications"
              >
                {item.specifications.map((spec) => (
                  <div
                    key={spec.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line px-4 py-4 text-sm last:border-b-0 odd:bg-surface/60 sm:px-5"
                  >
                    <dt className="break-words text-muted">
                      {spec.attribute.name}
                    </dt>
                    <dd className="m-0 break-words font-medium">
                      {specificationValue(spec)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">
                Specifications have not been provided yet.
              </p>
            )}
          </section>
        </div>

        <aside
          id="product-information"
          className="scroll-mt-48 rounded-2xl border border-line bg-surface/60 p-5 sm:p-6"
          aria-labelledby="information-title"
        >
          <h2
            id="information-title"
            className="mb-4 text-base font-semibold tracking-normal"
          >
            Product information
          </h2>
          <dl className="space-y-4 text-sm">
            {item.brand?.name && (
              <div>
                <dt className="text-xs text-muted">Brand</dt>
                <dd className="mt-1 ml-0 font-medium">{item.brand.name}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted">Product type</dt>
              <dd className="mt-1 ml-0">
                <Link
                  className="font-medium hover:text-accent-deep"
                  href={typeHref}
                >
                  {item.product_type.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Category</dt>
              <dd className="mt-1 ml-0">
                <Link
                  className="font-medium hover:text-accent-deep"
                  href={categoryHref}
                >
                  {item.category.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">SKU</dt>
              <dd className="mt-1 ml-0 break-all font-medium">{item.sku}</dd>
            </div>
            {additionalDetails && regulatoryFields.map(([field, label]) => {
              const value = additionalDetails[field]?.trim();
              return value ? (
                <div key={field}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 ml-0 break-words font-medium">{value}</dd>
                </div>
              ) : null;
            })}
          </dl>
        </aside>
      </div>

      <section
        className="mt-12 border-t border-line pt-8 sm:mt-16 sm:pt-12"
        aria-label="Related equipment"
      >
        {related.error ? (
          <ErrorState error={related.error} retry={related.retry} />
        ) : !related.data ? (
          <LoadingState label="Loading related equipment…" />
        ) : related.data.data.length > 0 ? (
          <>
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold tracking-widest text-accent-deep">
                BUILD YOUR HOME SETUP
              </p>
              <h2 className="text-2xl font-bold sm:text-3xl">
                Pairs with your pick.
              </h2>
            </div>
            <ProductCollectionCarousel
              products={related.data.data}
              label="Related equipment"
            />
          </>
        ) : (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-accent-deep"
            href={typeHref}
          >
            Discover more {item.product_type.name}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </section>
    </article>
  );
}
