import { useMemo } from "react";
import { useCatalogResource } from "./catalog";
import { CatalogError } from "./catalogClient";
import { readProductDetail } from "./productDetail";

export function useProductDetail(identifier: string) {
  const resource = useCatalogResource<unknown>(
    `/products/${encodeURIComponent(identifier)}`,
    { refreshOnFocus: true },
  );
  const result = useMemo(() => {
    if (resource.data === undefined) return {};
    try {
      return { data: readProductDetail(resource.data) };
    } catch {
      return { error: new CatalogError(502, "We couldn't read the product information. Please try again.") };
    }
  }, [resource.data]);
  return { data: result.data, error: resource.error ?? result.error, refreshing: resource.refreshing, retry: resource.retry };
}
