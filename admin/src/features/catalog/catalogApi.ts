import {
  apiDownload,
  apiFormRequest,
  apiRequest,
  cachedApiRequest,
  type ApiResponse,
} from "../../api/client";
import type {
  CatalogAttribute,
  Combo,
  Product,
  ProductHighlight,
  ProductSpecification,
  WarehouseStockSnapshot,
  WarehouseLocation,
} from "./types";

export type MerchandisingPlacement = "featured" | "bestsellers";
export type MerchandisingItem = {
  product: Product;
  sort_order: number;
  is_active: boolean;
};

export function loadMerchandising(
  placement: MerchandisingPlacement,
  options: { signal?: AbortSignal; force?: boolean } = {},
) {
  return cachedApiRequest<
    ApiResponse<{
      section: { id: string; name: string; is_active: boolean } | null;
      items: MerchandisingItem[];
    }>
  >(`/merchandising/${placement}`, options);
}

export function loadEligibleMerchandisingProducts(
  placement: MerchandisingPlacement,
  filters: {
    search?: string;
    product_type_id?: string;
    category_id?: string;
    page?: number;
  },
  options: { signal?: AbortSignal; force?: boolean } = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") query.set(key, String(value));
  }
  return cachedApiRequest<{
    data: Product[];
    meta: { current_page: number; last_page: number; total: number };
  }>(`/merchandising/${placement}/eligible-products?${query}`, options);
}

export function addMerchandisingProduct(
  placement: MerchandisingPlacement,
  productId: string,
) {
  return apiRequest(`/merchandising/${placement}/products`, "POST", {
    product_id: productId,
  });
}

export function updateMerchandisingProduct(
  placement: MerchandisingPlacement,
  productId: string,
  data: { sort_order: number; is_active: boolean },
) {
  return apiRequest(
    `/merchandising/${placement}/products/${productId}`,
    "PUT",
    data,
  );
}

export function removeMerchandisingProduct(
  placement: MerchandisingPlacement,
  productId: string,
) {
  return apiRequest(
    `/merchandising/${placement}/products/${productId}`,
    "DELETE",
  );
}

export function saveWarehouse(
  data: {
    name: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: string | null;
    longitude: string | null;
  },
  id?: string,
) {
  return apiRequest<ApiResponse<WarehouseLocation>>(
    `/warehouses${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    data,
  );
}

export function deleteWarehouse(id: string) {
  return apiRequest(`/warehouses/${id}`, "DELETE");
}

export function saveHsnCode(data: Record<string, unknown>, id?: string) {
  return apiRequest(
    `/hsn-codes${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    data,
  );
}

export function saveMaster(
  path: "brands" | "categories" | "product-types",
  data: Record<string, unknown>,
  id?: string,
) {
  return apiRequest(`/${path}${id ? `/${id}` : ""}`, id ? "PUT" : "POST", data);
}

export function saveProduct(data: Record<string, unknown>, id?: string) {
  return apiRequest<ApiResponse<Product>>(
    `/products${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    data,
  );
}

export function loadProduct(id: string) {
  return apiRequest<ApiResponse<Product>>(`/products/${id}`);
}

export function deleteProduct(id: string) {
  return apiRequest<ApiResponse<Product>>(`/products/${id}`, "DELETE");
}

export function exportProducts(filters: Record<string, string>) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value && value !== "all"),
  );
  return apiDownload(`/products/export?${query.toString()}`);
}

export function loadCombos() {
  return apiRequest<ApiResponse<Combo[]>>("/combos");
}

export function saveCombo(data: Record<string, unknown>, id?: string) {
  return apiRequest<ApiResponse<Combo>>(
    `/combos${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    data,
  );
}
export function loadAttributes() {
  return apiRequest<ApiResponse<CatalogAttribute[]>>("/attributes");
}
export function saveAttribute(data: Record<string, unknown>, id?: string) {
  return apiRequest<ApiResponse<CatalogAttribute>>(
    `/attributes${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    data,
  );
}
export function loadSpecifications(productId: string) {
  return apiRequest<ApiResponse<ProductSpecification[]>>(
    `/products/${productId}/attributes`,
  );
}
export function saveSpecification(
  productId: string,
  data: Record<string, unknown>,
  id?: string,
) {
  return apiRequest<ApiResponse<ProductSpecification>>(
    `/products/${productId}/attributes${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    data,
  );
}
export function deleteSpecification(productId: string, id: string) {
  return apiRequest<void>(`/products/${productId}/attributes/${id}`, "DELETE");
}
export function loadHighlights(productId: string) {
  return apiRequest<ApiResponse<ProductHighlight[]>>(
    `/products/${productId}/highlights`,
  );
}
export function saveHighlights(
  productId: string,
  highlights: Record<string, unknown>[],
) {
  return apiRequest<ApiResponse<ProductHighlight[]>>(
    `/products/${productId}/highlights`,
    "PUT",
    { highlights },
  );
}

export function uploadProductImage(
  productId: string,
  image: File,
  isPrimary: boolean,
  type = "gallery",
  sortOrder = 0,
) {
  const body = new FormData();
  body.set("image", image);
  body.set("type", type);
  body.set("sort_order", String(sortOrder));
  body.set("is_primary", isPrimary ? "1" : "0");
  return apiFormRequest<ApiResponse<Product>>(
    `/products/${productId}/images`,
    body,
  );
}

export function updateProductImage(
  productId: string,
  imageId: string,
  data: { sort_order: number; is_primary: boolean },
) {
  return apiRequest<ApiResponse<Product>>(
    `/products/${productId}/images/${imageId}`,
    "PUT",
    data,
  );
}

export function replaceProductImage(
  productId: string,
  imageId: string,
  image: File,
) {
  const body = new FormData();
  body.set("image", image);
  return apiFormRequest<ApiResponse<Product>>(
    `/products/${productId}/images/${imageId}/replace`,
    body,
  );
}

export function deleteProductImage(productId: string, imageId: string) {
  return apiRequest<ApiResponse<Product>>(
    `/products/${productId}/images/${imageId}`,
    "DELETE",
  );
}

export function setWarehouseStock(
  warehouseId: string,
  productId: string,
  quantity: number,
  operation: "adjustment" | "stock_in" | "stock_out" = "adjustment",
  idempotencyKey?: string,
) {
  return apiRequest<ApiResponse<WarehouseStockSnapshot>>(
    `/warehouses/${warehouseId}/products/${productId}/stock`,
    "PUT",
    {
      quantity,
      include_history: false,
      operation,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
  );
}

export function loadWarehouseStock(warehouseId: string, productId: string) {
  return apiRequest<ApiResponse<WarehouseStockSnapshot>>(
    `/warehouses/${warehouseId}/products/${productId}/stock?include_history=0`,
  );
}
