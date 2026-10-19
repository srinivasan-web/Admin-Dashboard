import { useEffect, useState } from "react";

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
  attribute: { id: string; name: string; unit: string | null };
  value: string;
  sort_order: number;
};
export type Product = {
  id: string;
  name: string;
  sku: string;
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
  tag: string | null;
  available_stock: number;
  price: { currency: string; mrp: string; sale: string | null };
  category: Category;
  product_type: Category;
  brand?: Category;
  images: Array<{ id: string; url: string; is_primary: boolean }>;
  specifications: Specification[];
  highlights: Array<{
    id: string;
    is_active: boolean;
    sort_order: number;
    specification: Specification;
  }>;
};
export type Collection<T> = { data: T[] };
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

export class CatalogError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function catalogRequest<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new CatalogError(
      response.status,
      response.status === 404
        ? "This product is no longer available. Explore the catalog to find an alternative."
        : "We couldn't load this information. Please try again.",
    );
  }
  return response.json() as Promise<T>;
}

// Each section owns its request: a failed collection cannot hide the whole page.
export function useCatalogResource<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    data?: T;
    error?: Error;
  }>({ path: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ path });
    void catalogRequest<T>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ path, data });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
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
    return () => controller.abort();
  }, [path, revision]);
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : undefined,
    retry: () => setRevision((value) => value + 1),
  };
}

export function specificationValue(specification: Specification) {
  const unit = specification.attribute.unit?.trim();
  // Some legacy values already contain the unit.
  return unit &&
    !specification.value.trim().toLowerCase().endsWith(unit.toLowerCase())
    ? `${specification.value} ${unit}`
    : specification.value;
}
