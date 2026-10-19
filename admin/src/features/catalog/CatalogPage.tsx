import { useEffect, useState, type ReactNode } from "react";
import { ProductTypesWorkspace } from "./ProductTypesWorkspace";
import { CategoriesWorkspace } from "./CategoriesWorkspace";
import { HsnCodesWorkspace } from "./HsnCodesWorkspace";
import { ProductWorkspace } from "./ProductWorkspace";
import { InventoryPage } from "./InventoryPage";
import { ComboWorkspace } from "./ComboWorkspace";
import { FeaturedProductsWorkspace } from "./FeaturedProductsWorkspace";
import { ErrorState, LoadingState } from "../../components/ui";
import {
  emptyMasters,
  useCatalogResource,
  useCatalogQuery,
} from "./useCatalogData";
import { cachedApiRequest } from "../../api/client";
import type { Combo, HsnCode, Master, Product } from "./types";
import type {
  CatalogRouteMode,
  CatalogRouteState,
  CatalogRouteView,
  ProductRouteMode,
} from "../../app/routes";

const emptyProducts: Product[] = [];

export type ProductListPage = {
  data: Product[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
};
function loadProductList(path: string, signal: AbortSignal, force: boolean) {
  return cachedApiRequest<ProductListPage>(path, { signal, force });
}

function ProductsCatalogPage({
  route,
  onRouteChange,
  canManageInventory,
}: {
  route?: { mode: ProductRouteMode; productId?: string };
  onRouteChange?: (mode: ProductRouteMode, productId?: string) => void;
  canManageInventory: boolean;
}) {
  const [queryParams, setQueryParams] = useState(() =>
    window.location.search.slice(1),
  );
  useEffect(() => {
    const sync = () => setQueryParams(window.location.search.slice(1));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const isList = (route?.mode ?? "list") === "list";
  const listing = useCatalogQuery<ProductListPage>(
    isList ? `/products${queryParams ? `?${queryParams}` : ""}` : null,
    loadProductList,
  );
  const types = useCatalogResource<Master[]>(isList ? "/product-types" : null);
  const categories = useCatalogResource<Master[]>(
    isList ? "/categories" : null,
  );
  const hsn = useCatalogResource<HsnCode[]>(isList ? "/hsn-codes" : null);
  const [notice, setNotice] = useState<string>();
  if ((route?.mode ?? "list") === "list" && listing.data === undefined) {
    return listing.error ? (
      <ErrorState message={listing.error} onRetry={listing.refresh} />
    ) : (
      <LoadingState label="Loading products…" />
    );
  }
  return (
    <>
      {listing.error && (
        <ErrorState message={listing.error} onRetry={listing.refresh} />
      )}
      <ProductWorkspace
        canManageInventory={canManageInventory}
        products={listing.data?.data ?? emptyProducts}
        pagination={listing.data?.meta}
        queryParams={queryParams}
        onQueryChange={(query) => {
          const value = query.toString();
          setQueryParams(value);
          window.history.pushState(
            {},
            "",
            `/products${value ? `?${value}` : ""}`,
          );
        }}
        listMasters={{
          productTypes: types.data ?? [],
          categories: categories.data ?? [],
          hsnCodes: hsn.data ?? [],
        }}
        filterError={types.error ?? categories.error ?? hsn.error}
        onRetryFilters={() => {
          types.refresh();
          categories.refresh();
          hsn.refresh();
        }}
        onSaved={() => {
          setNotice("Saved successfully.");
          listing.refresh();
        }}
        onRefresh={listing.refresh}
        notice={notice}
        route={route}
        onRouteChange={(mode, id) => {
          onRouteChange?.(mode, id);
          if (queryParams)
            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}?${queryParams}`,
            );
        }}
      />
    </>
  );
}

function CatalogResource<T>({
  path,
  children,
}: {
  path: string;
  children: (
    data: T,
    saved: () => void,
    refresh: () => void,
    notice?: string,
  ) => ReactNode;
}) {
  const { data, error, refresh } = useCatalogResource<T>(path);
  const [notice, setNotice] = useState<string>();
  return (
    <>
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data === undefined
        ? !error && <LoadingState label="Loading catalogue…" />
        : children(
            data,
            () => {
              setNotice("Saved successfully.");
              refresh();
            },
            refresh,
            notice,
          )}
    </>
  );
}

function FeaturedCatalogPage({
  placement,
}: {
  placement: "featured" | "bestsellers";
}) {
  const types = useCatalogResource<Master[]>("/product-types");
  const categories = useCatalogResource<Master[]>("/categories");
  const error = types.error ?? categories.error;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          types.refresh();
          categories.refresh();
        }}
      />
    );
  if (!types.data || !categories.data)
    return <LoadingState label="Loading filters…" />;
  return (
    <FeaturedProductsWorkspace
      placement={placement}
      masters={{
        ...emptyMasters,
        productTypes: types.data,
        categories: categories.data,
      }}
    />
  );
}

type CatalogPageProps = {
  canManageInventory?: boolean;
  view?:
    | "product-types"
    | "categories"
    | "hsn"
    | "products"
    | "stock"
    | "combos"
    | "featured-choose"
    | "featured-bestsellers";
  productRoute?: { mode: ProductRouteMode; productId?: string };
  onProductRoute?: (mode: ProductRouteMode, productId?: string) => void;
  catalogRoute?: CatalogRouteState;
  onCatalogRoute?: (
    view: CatalogRouteView,
    mode: CatalogRouteMode,
    recordId?: string,
  ) => void;
};

export function CatalogPage({
  view = "products",
  canManageInventory = false,
  productRoute,
  onProductRoute,
  catalogRoute = { mode: "list" },
  onCatalogRoute,
}: CatalogPageProps) {
  switch (view) {
    case "product-types":
      return (
        <CatalogResource<Master[]> path="/product-types">
          {(data, saved, _refresh, notice) => (
            <ProductTypesWorkspace
              productTypes={data}
              onSaved={saved}
              notice={notice}
              route={catalogRoute}
              onRouteChange={(mode, id) =>
                onCatalogRoute?.("product-types", mode, id)
              }
            />
          )}
        </CatalogResource>
      );
    case "categories":
      return (
        <CatalogResource<Master[]> path="/categories">
          {(data, saved, _refresh, notice) => (
            <CategoriesWorkspace
              categories={data}
              onSaved={saved}
              notice={notice}
              route={catalogRoute}
              onRouteChange={(mode, id) =>
                onCatalogRoute?.("categories", mode, id)
              }
            />
          )}
        </CatalogResource>
      );
    case "hsn":
      return (
        <CatalogResource<HsnCode[]> path="/hsn-codes">
          {(data, saved, _refresh, notice) => (
            <HsnCodesWorkspace
              hsnCodes={data}
              onSaved={saved}
              notice={notice}
              route={catalogRoute}
              onRouteChange={(mode, id) => onCatalogRoute?.("hsn", mode, id)}
            />
          )}
        </CatalogResource>
      );
    case "products":
      return (
        <ProductsCatalogPage
          canManageInventory={canManageInventory}
          route={productRoute}
          onRouteChange={onProductRoute}
        />
      );
    case "combos":
      return (
        <CatalogResource<Combo[]> path="/combos">
          {(data, saved, _refresh, notice) => (
            <ComboWorkspace
              combos={data}
              onSaved={saved}
              notice={notice}
              route={catalogRoute}
              onRouteChange={(mode, id) => onCatalogRoute?.("combos", mode, id)}
            />
          )}
        </CatalogResource>
      );
    case "stock":
      return <InventoryPage />;
    default:
      return (
        <FeaturedCatalogPage
          placement={view === "featured-choose" ? "featured" : "bestsellers"}
        />
      );
  }
}
