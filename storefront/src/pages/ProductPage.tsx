import { useEffect } from "react";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "../app/navigation";
import { CatalogError, useCatalogResource, type Product, type Collection } from "../api/catalog";
import { useProductDetail } from "../api/useProductDetail";
import { ProductGallery } from "../components/catalog/ProductGallery";
import { ProductSummary } from "../components/catalog/ProductSummary";
import { ProductBenefits } from "../components/catalog/ProductBenefits";
import { ProductInformation, ProductDeclarations } from "../components/catalog/ProductInformation";
import { ProductComparison } from "../components/catalog/ProductComparison";
import { ProductFaq } from "../components/catalog/ProductFaq";
import { WhyShop } from "../components/catalog/WhyShop";
import { ProductPurchasePanel } from "../components/catalog/ProductPurchasePanel";
import { usePurchaseOptions } from "../api/purchase";
import { ProductCollectionCarousel } from "../components/home/ProductCollectionCarousel";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";

export default function ProductPage({ id }: { id: string }) {
  const product = useProductDetail(id);
  const purchaseOptions = usePurchaseOptions(id);
  const item = product.data?.data;
  const related = useCatalogResource<Collection<Product>>(
    item ? `/products/${encodeURIComponent(item.id)}/buy-it-with` : null,
    { refreshOnFocus: true },
  );
  const bestsellers = useCatalogResource<Collection<Product>>(
    item ? "/merchandising/bestsellers?limit=9" : null,
    { refreshOnFocus: true },
  );

  useEffect(() => {
    if (item) document.title = `${item.name} | Durafit91`;
  }, [item]);

  if (product.error) return (
    <div className="product-page">
      <Link className="text-link" href="/products"><ArrowLeft size={16} aria-hidden="true" /> Back to equipment</Link>
      {product.error instanceof CatalogError && product.error.status === 404 && <h1 className="mt-6 text-2xl font-bold">Product unavailable</h1>}
      <ErrorState error={product.error} retry={product.retry} />
    </div>
  );
  if (!product.data) return <LoadingState label="Loading product details…" />;
  if (!item) return <EmptyState title="Product unavailable" description="Explore the catalogue to find your next piece of equipment." />;

  const typeHref = `/products?product_type_id=${encodeURIComponent(item.product_type.id)}`;
  const topSellingProducts = bestsellers.data?.data.filter((candidate) => candidate.id !== item.id).slice(0, 8) ?? [];

  return (
    <article className="product-page" data-testid="product-detail">
      {product.refreshing && <p role="status" className="mb-3 text-xs text-muted">Updating product information…</p>}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted sm:mb-8" aria-label="Breadcrumb">
        <Link className="hover:text-accent-deep" href="/">Home</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link className="hover:text-accent-deep" href={typeHref}>{item.product_type.name}</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-navy" aria-current="page">{item.name}</span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 xl:gap-16">
        <div className="min-w-0"><ProductGallery key={item.id} product={item} /><ProductPurchasePanel product={item} options={purchaseOptions} /></div>
        <div className="min-w-0">
          <ProductSummary product={item} purchaseOptions={purchaseOptions} />
          <ProductDeclarations product={item} />
        </div>
      </div>

      <ProductBenefits product={item} />
      <ProductInformation key={`information-${item.id}`} product={item} />
      <ProductComparison key={`comparison-${item.id}`} productId={item.id} typeName={item.product_type.name} />

      <section className="mt-12 border-t border-line pt-8 sm:mt-16 sm:pt-12" aria-label="Related equipment">
        {related.error ? <ErrorState error={related.error} retry={related.retry} />
          : !related.data ? <LoadingState label="Loading related equipment…" />
          : related.data.data.length > 0 ? <>
            <div className="mb-6"><p className="mb-2 text-xs font-semibold tracking-widest text-accent-deep">COMPLETE YOUR SETUP</p><h2 className="text-2xl font-bold sm:text-3xl">Buy it with</h2></div>
            <ProductCollectionCarousel products={related.data.data} label="Related equipment" />
          </> : <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-accent-deep" href={typeHref}>Discover more {item.product_type.name} <ArrowRight size={16} aria-hidden="true" /></Link>}
      </section>

      {(topSellingProducts.length > 0 || bestsellers.error) && <section className="mt-12 border-t border-line pt-8 sm:mt-16 sm:pt-12" aria-label="Bestsellers">
        <div className="mb-6"><p className="mb-2 text-xs font-semibold tracking-widest text-accent-deep">CURATED EQUIPMENT</p><h2 className="text-2xl font-bold sm:text-3xl">Explore bestsellers</h2></div>
        {bestsellers.error ? <ErrorState error={bestsellers.error} retry={bestsellers.retry} /> : <ProductCollectionCarousel products={topSellingProducts} label="Bestsellers" />}
      </section>}
      <ProductFaq categoryId={item.category.id} />
      <WhyShop />
    </article>
  );
}
