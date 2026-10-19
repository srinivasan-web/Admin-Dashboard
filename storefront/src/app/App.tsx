import { Component, Suspense, lazy, useEffect, type ReactNode } from "react";
import {
  useCatalogResource,
  type Category,
  type Collection,
  type ProductType,
} from "../api/catalog";
import { StorefrontShell } from "../components/layout/StorefrontShell";
import { EmptyState, LoadingState } from "../components/Feedback";
import { useLocation } from "./navigation";

const HomePage = lazy(() => import("../pages/HomePage"));
const CatalogPage = lazy(() => import("../pages/CatalogPage"));
const ProductPage = lazy(() => import("../pages/ProductPage"));

class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="feedback" role="alert">
        <h1>Something didn't load.</h1>
        <p>Please reload the page to try again.</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  const location = useLocation();
  const [pathname, query = ""] = location.split("?");
  const path = pathname.replace(/\/$/, "") || "/";
  const productId = /^\/products\/([^/]+)$/.exec(path)?.[1];
  const categories = useCatalogResource<Collection<Category>>("/categories");
  const productTypes = useCatalogResource<Collection<ProductType>>("/product-types");
  useEffect(() => {
    document.title =
      path === "/"
        ? "Durafit91 — Make movement part of home"
        : "Explore equipment | Durafit91";
    if (window.location.hash) {
      requestAnimationFrame(() =>
        document
          .getElementById(window.location.hash.slice(1))
          ?.scrollIntoView(),
      );
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [path]);
  return (
    <StorefrontShell
      fullBleed={path === "/"}
      categories={categories.data?.data}
      categoryError={categories.error}
      retryCategories={categories.retry}
    >
      <PageBoundary key={path}>
        <Suspense fallback={<LoadingState label="Loading your next move…" />}>
          {path === "/" ? (
            <HomePage
              productTypes={productTypes.data?.data}
              productTypeError={productTypes.error}
              retryProductTypes={productTypes.retry}
            />
          ) : path === "/products" ? (
            <CatalogPage
              key={query}
              query={query}
              categories={categories.data?.data}
              productTypes={productTypes.data?.data}
              categoryError={categories.error}
              retryCategories={categories.retry}
            />
          ) : productId ? (
            <ProductPage key={productId} id={productId} />
          ) : (
            <EmptyState
              title="This page has moved."
              description="Let's get you back to exploring equipment."
            />
          )}
        </Suspense>
      </PageBoundary>
    </StorefrontShell>
  );
}
