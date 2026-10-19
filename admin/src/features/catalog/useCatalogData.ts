import { useEffect, useRef, useState } from "react";
import {
  cachedApiRequest,
  errorMessage,
  type ApiResponse,
} from "../../api/client";
import type {
  CatalogAttribute,
  CatalogMasters,
  HsnCode,
  Master,
  WarehouseLocation,
} from "./types";

export function useCatalogQuery<T>(
  key: string | null,
  loader: (key: string, signal: AbortSignal, force: boolean) => Promise<T>,
) {
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: string;
  }>({ key: null });
  const [revision, setRevision] = useState(0);
  const forceNext = useRef(false);
  useEffect(() => {
    if (!key) {
      setState({ key: null });
      return;
    }
    const controller = new AbortController();
    const force = forceNext.current;
    forceNext.current = false;
    void loader(key, controller.signal, force)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            key,
            data: previous.key === key ? previous.data : undefined,
            error: errorMessage(reason),
          }));
      });
    return () => controller.abort();
  }, [key, loader, revision]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    refresh: () => {
      forceNext.current = true;
      setRevision((value) => value + 1);
    },
  };
}

function loadResource<T>(path: string, signal: AbortSignal, force: boolean) {
  return cachedApiRequest<ApiResponse<T>>(path, { signal, force }).then(
    (response) => response.data,
  );
}
export function useCatalogResource<T>(path: string | null) {
  return useCatalogQuery<T>(path, loadResource);
}
export const emptyMasters: CatalogMasters = {
  brands: [],
  categories: [],
  productTypes: [],
  warehouses: [],
  hsnCodes: [],
};
async function loadEditor(key: string, signal: AbortSignal, force: boolean) {
  const core = Promise.all([
    loadResource<Master[]>("/brands", signal, force),
    loadResource<Master[]>("/categories", signal, force),
    loadResource<Master[]>("/product-types", signal, force),
    loadResource<HsnCode[]>("/hsn-codes", signal, force),
  ]);
  const related: Promise<[WarehouseLocation[], CatalogAttribute[]]> =
    key === "product-editor-full"
      ? Promise.all([
          loadResource<WarehouseLocation[]>("/warehouses", signal, force),
          loadResource<CatalogAttribute[]>("/attributes", signal, force),
        ])
      : Promise.resolve([[] as WarehouseLocation[], [] as CatalogAttribute[]]);
  const [
    [brands, categories, productTypes, hsnCodes],
    [warehouses, attributes],
  ] = await Promise.all([core, related]);
  return {
    masters: { brands, categories, productTypes, warehouses, hsnCodes },
    attributes,
  };
}
export function useProductEditorData(enabled: boolean, includeRelated = true) {
  return useCatalogQuery(
    enabled
      ? includeRelated
        ? "product-editor-full"
        : "product-editor-core"
      : null,
    loadEditor,
  );
}
