import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, errorMessage } from "../../api/client";
import type { Product } from "./types";

type Listing = {
  id: string;
  category_id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    primary_category_id: string;
    primary_category_name: string | null;
  };
  sort_order: number;
  is_featured: boolean;
  is_active: boolean;
};

function ListingRow({ categoryId, listing, onSaved }: {
  categoryId: string;
  listing: Listing;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/categories/${categoryId}/listings/${listing.id}`, "PUT", {
        sort_order: Number(fields.get("sort_order")),
        is_featured: fields.get("is_featured") === "on",
        is_active: fields.get("is_active") === "on",
      });
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 border-b border-slate-100 py-4 md:grid-cols-[minmax(0,1fr)_100px_auto_auto_auto] md:items-center" onSubmit={save}>
      <div className="min-w-0">
        <strong className="block truncate text-sm text-slate-900">{listing.product.name}</strong>
        <span className="text-xs text-slate-500">{listing.product.sku} · Primary: {listing.product.primary_category_name ?? "Unavailable"}</span>
      </div>
      <label className="text-xs text-slate-600">Order
        <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2" type="number" name="sort_order" min="0" max="4294967295" defaultValue={listing.sort_order} required />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" name="is_featured" defaultChecked={listing.is_featured} /> Featured</label>
      <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" name="is_active" defaultChecked={listing.is_active} /> Active</label>
      <button className="secondary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      {error && <p className="text-xs text-red-700 md:col-span-full" role="alert">{error}</p>}
    </form>
  );
}

export function CategoryListingsPanel({ categoryId }: { categoryId: string }) {
  const [listings, setListings] = useState<Listing[]>();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [error, setError] = useState<string>();
  const [searchError, setSearchError] = useState<string>();
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setListings(undefined);
    setError(undefined);
    void apiRequest<{ data: Listing[]; meta: { last_page: number } }>(`/categories/${categoryId}/listings?page=${page}`, "GET", undefined, { signal: controller.signal })
      .then((response) => {
        setListings(response.data);
        setLastPage(response.meta.last_page);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [categoryId, page, revision]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    if (!query) return;
    setSearching(true);
    setSearched(true);
    setSearchError(undefined);
    try {
      const response = await apiRequest<{ data: Product[] }>(`/products?search=${encodeURIComponent(query)}`);
      setProducts(response.data);
      setSelectedProduct("");
    } catch (reason) {
      setSearchError(errorMessage(reason));
    } finally {
      setSearching(false);
    }
  }

  async function add() {
    if (!selectedProduct) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/categories/${categoryId}/listings`, "POST", { product_id: selectedProduct });
      setSelectedProduct("");
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const assigned = new Set(listings?.map((item) => item.product.id) ?? []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="category-listings-title">
      <h2 id="category-listings-title" className="m-0 text-lg font-semibold text-slate-900">Additional category placements</h2>
      <p className="mt-1 text-sm text-slate-500">A product keeps its primary category. Add it here only when it should also appear in this category.</p>
      <form className="mt-5 flex flex-wrap gap-2" onSubmit={search} role="search">
        <input name="search" maxLength={100} aria-label="Search products by name or SKU" placeholder="Search product name or SKU" className="min-h-11 min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3" />
        <button className="secondary" type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button>
      </form>
      {searchError && <p className="mt-2 text-sm text-red-700" role="alert">{searchError}</p>}
      {searched && !searching && !searchError && products.length === 0 && <p className="mt-2 text-sm text-slate-500">No products match that search.</p>}
      {products.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <select aria-label="Choose a product for this category" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} className="min-h-11 min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3">
            <option value="">Choose a product</option>
            {products.map((product) => <option key={product.id} value={product.id} disabled={assigned.has(product.id)}>{product.name} · {product.sku}{assigned.has(product.id) ? " (already added)" : ""}</option>)}
          </select>
          <button className="add-new-btn" type="button" onClick={() => void add()} disabled={!selectedProduct || busy}>{busy ? "Adding…" : "Add placement"}</button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-5 border-t border-slate-200">
        {!listings && !error && <p className="py-4 text-sm text-slate-500">Loading placements…</p>}
        {listings?.length === 0 && <p className="py-4 text-sm text-slate-500">No additional placements. Primary-category products still appear automatically.</p>}
        {listings?.map((listing) => <ListingRow key={`${listing.id}:${revision}`} categoryId={categoryId} listing={listing} onSaved={() => setRevision((value) => value + 1)} />)}
      </div>
      {lastPage > 1 && <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
        <button className="secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span>Page {page} of {lastPage}</span>
        <button className="secondary" type="button" disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>}
    </section>
  );
}
