import { useCallback, useEffect, useState } from "react";
import { acquireCatalogRequest, CatalogError } from "./catalogClient";
export { catalogRequest, CatalogError } from "./catalogClient";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url?: string | null;
  sort_order?: number;
};
export type ProductType = Category;
export type PublicBanner = {
  id: string;
  category_id: string | null;
  product_type_id: string | null;
  title: string;
  description: string | null;
  desktop_image_url: string;
  mobile_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  display_order: number;
  status: "active";
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Specification = {
  id: string;
  attribute: { id: string; name: string; slug?: string; icon?: string | null; unit: string | null };
  value: string;
  sort_order: number;
};
export type Product = {
  id: string;
  name: string;
  sku: string;
  slug?: string | null;
  description: string | null;
  short_description?: string | null;
  details?: Array<{
    id: string;
    title: string;
    content: string;
    sort_order: number;
    is_active: boolean;
  }>;
  additional_details?: {
    generic_name: string | null;
    model_number: string | null;
    net_quantity: string | null;
    country_of_origin: string | null;
    manufactured_by: string | null;
    marketed_by: string | null;
    consumer_complaints: string | null;
  } | null;
  benefits?: Array<{
    id: string;
    title: string;
    description: string | null;
    benefit_type: string;
    sort_order: number;
    is_active: boolean;
    icon_url: string | null;
  }>;
  tag: string | null;
  available_stock: number;
  price: { currency: string; mrp: string; sale: string | null };
  category: Category;
  product_type: Category;
  brand?: Category | null;
  images: Array<{
    id: string;
    url: string;
    type?: string;
    is_primary: boolean;
    alt_text?: string | null;
    sort_order?: number;
  }>;
  has_360_view?: boolean;
  specifications: Specification[];
  highlights: Array<{
    id: string;
    is_active: boolean;
    sort_order: number;
    specification: Specification;
  }>;
};
export type Collection<T> = { data: T[] };
export type ProductComparison = {
  data: {
    attributes: Array<{ id: string; name: string; unit: string | null }>;
    products: Array<Pick<Product, "id" | "name" | "price" | "images" | "specifications">>;
  };
};
export type ProductPage = Collection<Product> & {
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
};
export type CatalogFilter = {
  id: string;
  name: string;
  unit: string | null;
  values: string[];
};
export type CategoryFaq = {
  id: string;
  category_id: string | null;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};
export type ShopBenefit = {
  id: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
};
export type ProductOffer = {
  id: string;
  scope_type: "product" | "category" | "product_type";
  title: string;
  description: string | null;
  offer_type: "coupon" | "promotion";
  coupon_code: string | null;
  discount_type: "percent" | "fixed" | null;
  discount_value: string | null;
  maximum_discount: string | null;
  minimum_order_amount: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

// Each section owns its request: a failed collection cannot hide the whole page.
export function useCatalogResource<T>(path: string | null, { refreshOnFocus = false } = {}) {
  const [state, setState] = useState<{
    path: string | null;
    data?: T;
    error?: Error;
    refreshing?: boolean;
  }>({ path: null });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const request = acquireCatalogRequest<T>(path);
    setState((current) => refreshOnFocus && current.path === path && current.data !== undefined
      ? { path, data: current.data, refreshing: true }
      : { path, refreshing: true });
    void request.promise
      .then((data) => {
        if (active) setState({ path, data });
      })
      .catch((reason: unknown) => {
        if (active)
          setState({
            path,
            error:
              reason instanceof CatalogError
                ? reason
                : new Error(
                    "We couldn't connect. Please check your connection and try again.",
                  ),
          });
      });
    return () => {
      active = false;
      request.release();
    };
  }, [path, revision, refreshOnFocus]);
  useEffect(() => {
    if (!refreshOnFocus || !path) return;
    let lastRefresh = 0;
    const refresh = () => {
      const now = Date.now();
      if (!document.hidden && now - lastRefresh >= 1000) {
        lastRefresh = now;
        retry();
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [path, refreshOnFocus, retry]);
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : undefined,
    refreshing: state.path === path && Boolean(state.refreshing),
    retry,
  };
}

export function productHref(product: Pick<Product, "id" | "slug">) {
  return `/products/${encodeURIComponent(product.slug?.trim() || product.id)}`;
}

export function specificationValue(specification: Specification) {
  const unit = specification.attribute.unit?.trim();
  // Some legacy values already contain the unit.
  return unit &&
    !specification.value.trim().toLowerCase().endsWith(unit.toLowerCase())
    ? `${specification.value} ${unit}`
    : specification.value;
}
