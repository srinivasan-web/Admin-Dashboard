import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "../app/navigation";
import {
  useCatalogResource,
  type Collection,
  type Product,
  type ProductType,
} from "../api/catalog";
import { HeroCarousel } from "../components/home/HeroCarousel";
import { LandingVideoSection } from "../components/home/LandingVideoSection";
import { ProductCollectionCarousel } from "../components/home/ProductCollectionCarousel";
import { ProductTypeSection } from "../components/home/ProductTypeSection";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";

export default function HomePage({
  productTypes,
  productTypeError,
  retryProductTypes,
}: {
  productTypes?: ProductType[];
  productTypeError?: Error;
  retryProductTypes: () => void;
}) {
  const featured = useCatalogResource<Collection<Product>>(
    "/merchandising/featured",
  );
  const bestsellers = useCatalogResource<Collection<Product>>(
    "/merchandising/bestsellers",
  );
  useEffect(() => {
    if (window.location.hash)
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);

  return (
    <>
      <HeroCarousel autoPlay />

      <div className="home-content">
        <ProductTypeSection
          productTypes={productTypes}
          productTypeError={productTypeError}
          retryProductTypes={retryProductTypes}
        />

        <section className="home-section" id="featured">
          <div className="section-heading">
            <div>
              <h2>Choose Your Fitness Products</h2>
            </div>
      
          </div>
          <CollectionContent
            resource={featured}
            label="Featured products"
            emptyTitle="New picks are on the way"
          />
        </section>


        <LandingVideoSection />

        <section className="home-section" id="bestsellers">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EXPLORE THE COLLECTION</p>
              <h2>Meet the bestsellers.</h2>
            </div>
            <Link className="text-link" href="/products">
              Keep exploring <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <CollectionContent
            resource={bestsellers}
            label="Bestsellers"
            emptyTitle="More equipment to discover"
          />
        </section>
      </div>
    </>
  );
}

function CollectionContent({
  resource,
  label,
  emptyTitle,
}: {
  resource: ReturnType<typeof useCatalogResource<Collection<Product>>>;
  label: string;
  emptyTitle: string;
}) {
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  if (!resource.data) return <LoadingState />;
  if (!resource.data.data.length)
    return (
      <EmptyState
        title={emptyTitle}
        description="Browse the catalog to see currently available equipment."
      />
    );
  return <ProductCollectionCarousel products={resource.data.data} label={label} />;
}
