import { apiRequest } from "../../../../api/client";
import type { CatalogMasters, Product } from "../../types";

export async function loadProducts() {
  return apiRequest<{ data: Product[] }>("/products");
}

export async function loadCatalogMasters() {
  return apiRequest<{ data: CatalogMasters }>("/catalog/masters");
}
