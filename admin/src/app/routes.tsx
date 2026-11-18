import type { AdminView } from "./AdminSidebar";

export type ProductRouteMode = "list" | "create" | "edit" | "detail";
export type CatalogRouteView = "product-types" | "categories" | "hsn" | "combos";
export type CatalogRouteMode = "list" | "create" | "edit";
export type CatalogRouteState = {
  mode: CatalogRouteMode;
  recordId?: string;
};

export type AdminRouteState = {
  view: AdminView;
  orderId?: string;
  bannerMode?: "list" | "create" | "edit";
  bannerId?: string;
  productMode?: ProductRouteMode;
  productId?: string;
  catalogRoute?: CatalogRouteState;
};

/**
 * Canonical browser URLs for every sidebar destination.
 *
 * These are client-side workspace routes. They deliberately do not imply that
 * a Laravel write contract exists: unsupported modules still render the
 * explicit Backend contract required state.
 */
export const adminViewPaths: Record<AdminView, string> = {
  dashboard: "/dashboard",
  "product-types": "/product-types",
  categories: "/categories",
  hsn: "/hsn-codes",
  products: "/products",
  combos: "/buy-it-with-combos",
  stock: "/warehouse-stock",
  "featured-choose": "/featured-products/choose",
  "featured-bestsellers": "/featured-products/explore",
  orders: "/sales/orders",
  "abandoned-orders": "/sales/orders/abandoned",
  warranty: "/warranty-registrations",
  contacts: "/contact-details",
  "crm-dashboard": "/crm/dashboard",
  "crm-leads": "/crm/leads",
  "crm-offline-camp": "/crm/offline-campaigns",
  coupons: "/coupons",
  "testimonials-dashboard": "/testimonials/dashboard",
  "testimonials-all": "/testimonials",
  faqs: "/faqs",
  "shop-benefits": "/shop-benefits",
  "legal-pages": "/legal-pages",
  banners: "/banners",
};

const legacyAliases: Record<string, AdminView> = {
  "/": "dashboard",
  "/category": "categories",
  "/hsn": "hsn",
  "/combos": "combos",
  "/stock-movements": "stock",
  "/featured-products/bestsellers": "featured-bestsellers",
};

const canonicalViews = new Map(
  Object.entries(adminViewPaths).map(([view, path]) => [path, view as AdminView]),
);

export function adminViewFromPath(pathname: string): AdminView | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return canonicalViews.get(normalized) ?? legacyAliases[normalized];
}

export function pathForAdminView(view: AdminView): string {
  return adminViewPaths[view];
}

export function pathForProductRoute(
  mode: ProductRouteMode,
  productId?: string,
): string {
  if (mode === "create") return "/products/create";
  if (mode === "edit" && productId)
    return `/products/${encodeURIComponent(productId)}/edit`;
  if (mode === "detail" && productId)
    return `/products/${encodeURIComponent(productId)}`;
  return adminViewPaths.products;
}

export function pathForCatalogRoute(
  view: CatalogRouteView,
  mode: CatalogRouteMode,
  recordId?: string,
): string {
  const base = adminViewPaths[view];
  if (mode === "create") return `${base}/create`;
  if (mode === "edit" && recordId)
    return `${base}/${encodeURIComponent(recordId)}/edit`;
  return base;
}

export function resolveAdminRoute(pathname: string): AdminRouteState {
  const path = pathname.replace(/\/+$/, "") || "/";

  for (const view of ["product-types", "categories", "hsn", "combos"] as const) {
    const base = adminViewPaths[view];
    if (path === `${base}/create`)
      return { view, catalogRoute: { mode: "create" } };
    const edit = path.match(new RegExp(`^${base}/([^/]+)/edit$`));
    if (edit)
      return {
        view,
        catalogRoute: {
          mode: "edit",
          recordId: decodeURIComponent(edit[1]),
        },
      };
  }

  if (path === "/products/create")
    return { view: "products", productMode: "create" };
  const productEdit = path.match(/^\/products\/([^/]+)\/edit$/);
  if (productEdit)
    return {
      view: "products",
      productMode: "edit",
      productId: decodeURIComponent(productEdit[1]),
    };
  const productDetail = path.match(/^\/products\/([^/]+)$/);
  if (productDetail)
    return {
      view: "products",
      productMode: "detail",
      productId: decodeURIComponent(productDetail[1]),
    };

  if (path === "/banners/create")
    return { view: "banners", bannerMode: "create" };
  const bannerEdit = path.match(/^\/banners\/([^/]+)\/edit$/);
  if (bannerEdit)
    return {
      view: "banners",
      bannerMode: "edit",
      bannerId: decodeURIComponent(bannerEdit[1]),
    };

  if (path === "/sales/orders/abandoned")
    return { view: "abandoned-orders" };
  const orderDetail = path.match(/^\/sales\/orders\/([^/]+)$/);
  if (orderDetail)
    return {
      view: "orders",
      orderId: decodeURIComponent(orderDetail[1]),
    };

  const view = adminViewFromPath(path);
  if (view)
    return {
      view,
      ...(["product-types", "categories", "hsn", "combos"].includes(view)
        ? { catalogRoute: { mode: "list" as const } }
        : {}),
      ...(view === "products" ? { productMode: "list" as const } : {}),
      ...(view === "banners" ? { bannerMode: "list" as const } : {}),
    };
  return { view: "dashboard" };
}
