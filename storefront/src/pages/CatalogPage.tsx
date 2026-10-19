import { useCallback, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link, navigate } from "../app/navigation";
import {
  useCatalogResource,
  type CatalogFilter,
  type Category,
  type Collection,
  type ProductPage,
  type ProductType,
  type PublicBanner,
} from "../api/catalog";
import { CatalogFilters } from "../components/catalog/CatalogFilters";
import { ListingBanner } from "../components/catalog/ListingBanner";
import { ProductCard } from "../components/catalog/ProductCard";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";

export default function CatalogPage({
  query,
  categories,
  productTypes,
  categoryError,
  retryCategories,
}: {
  query: string;
  categories?: Category[];
  productTypes?: ProductType[];
  categoryError?: Error;
  retryCategories: () => void;
}) {
  const params = new URLSearchParams(query);
  const categoryId = params.get("category_id") ?? "";
  const typeId = params.get("product_type_id") ?? "";
  const q = (params.get("q") ?? "").slice(0, 100);
  const minPrice = params.get("min_price") ?? "";
  const maxPrice = params.get("max_price") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const apiQuery = new URLSearchParams({ page: String(page) });
  if (categoryId) apiQuery.set("category_id", categoryId);
  if (typeId) apiQuery.set("product_type_id", typeId);
  if (q) apiQuery.set("q", q);
  if (minPrice) apiQuery.set("min_price", minPrice);
  if (maxPrice) apiQuery.set("max_price", maxPrice);
  const selectedValues: Record<string, string[]> = Object.create(null);
  for (const [key, value] of params) {
    const match = /^attributes\[([^\]]+)\]\[\]$/.exec(key);
    if (!match) continue;
    (selectedValues[match[1]] ??= []).push(value);
    apiQuery.append(key, value);
  }
  const requestedSort = params.get("sort") ?? "name";
  const sort = ["name", "price_asc", "price_desc"].includes(requestedSort)
    ? requestedSort
    : "name";
  if (sort !== "name") apiQuery.set("sort", sort);
  const products = useCatalogResource<ProductPage>(`/products?${apiQuery}`);
  const filterQuery = new URLSearchParams();
  if (categoryId) filterQuery.set("category_id", categoryId);
  if (typeId) filterQuery.set("product_type_id", typeId);
  const filters = useCatalogResource<Collection<CatalogFilter>>(
    `/filters${filterQuery.size ? `?${filterQuery}` : ""}`,
  );
  const banners = useCatalogResource<Collection<PublicBanner>>(
    categoryId || typeId ? null : "/banners/active?page=listing",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const selectedCategory = categories?.find((category) => category.id === categoryId);
  const selectedType = productTypes?.find((type) => type.id === typeId);
  const title = selectedCategory?.name ?? selectedType?.name ?? "Explore equipment";
  const description = selectedCategory?.description ?? selectedType?.description ?? "Browse available equipment and find what fits your routine.";
  const visible = products.data?.data ?? [];
  const localFilters = filters.data?.data ?? [];
  const activeCount = Object.values(selectedValues).reduce((total, values) => total + values.length, 0)
    + Number(Boolean(minPrice || maxPrice));
  function updateQuery(values: Record<string, string>) {
    const next = new URLSearchParams(apiQuery);
    if ("category_id" in values || "product_type_id" in values) {
      for (const key of [...next.keys()])
        if (key.startsWith("attributes[")) next.delete(key);
      next.delete("min_price");
      next.delete("max_price");
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    navigate(`/products?${next}`);
  }
  function changeFilter(id: string, value: string) {
    const key = `attributes[${id}][]`;
    const next = new URLSearchParams(apiQuery);
    const selected = selectedValues[id] ?? [];
    const values = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    next.delete(key);
    for (const item of values) next.append(key, item);
    next.set("page", "1");
    navigate(`/products?${next}`);
  }
  function resetSpecifications() {
    const next = new URLSearchParams(apiQuery);
    for (const key of [...next.keys()])
      if (key.startsWith("attributes[")) next.delete(key);
    next.delete("min_price");
    next.delete("max_price");
    next.set("page", "1");
    navigate(`/products?${next}`);
  }
  function pageHref(number: number) {
    const next = new URLSearchParams(apiQuery);
    next.set("page", String(number));
    return `/products?${next}`;
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery({
      q: String(new FormData(event.currentTarget).get("q") ?? "").trim(),
      page: "1",
    });
    document.querySelector(".catalog-heading")?.scrollIntoView({ behavior: "instant" });
  }
  return (
    <div className="catalog-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span aria-current="page">{title}</span>
      </nav>
      {banners.data?.data[0] && <ListingBanner key={banners.data.data[0].id} banner={banners.data.data[0]} />}
      <div className="catalog-heading">
        <p className="eyebrow">{selectedCategory || selectedType ? "EXPLORE EQUIPMENT" : "MAKE YOUR NEXT MOVE"}</p>
        <h1>{title}</h1>
        {selectedType && selectedCategory && <p className="catalog-context">In {selectedType.name}</p>}
        <p>{description}</p>
      </div>
      <div className="catalog-toolbar">
        <form className="catalog-search" onSubmit={search} role="search">
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="catalog-search">
            Search by name or SKU
          </label>
          <input
            id="catalog-search"
            name="q"
            maxLength={100}
            defaultValue={q}
            placeholder="Search equipment…"
          />
          <button type="submit">Search</button>
        </form>
        <label className="category-select">
          <span className="sr-only">Category</span>
          <select
            value={categoryId}
            onChange={(event) =>
              updateQuery({ category_id: event.target.value, page: "1" })
            }
          >
            <option value="">All categories</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="category-select">
          <span className="sr-only">Product type</span>
          <select
            value={typeId}
            onChange={(event) =>
              updateQuery({ product_type_id: event.target.value, page: "1" })
            }
          >
            <option value="">All product types</option>
            {productTypes?.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </label>
        <label className="category-select">
          <span className="sr-only">Sort products</span>
          <select value={sort} onChange={(event) => updateQuery({ sort: event.target.value, page: "1" })}>
            <option value="name">Recommended</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>
      {categoryError && (
        <div className="filter-error">
          <span>Categories couldn't be loaded.</span>
          <button className="text-link" onClick={retryCategories}>
            Retry categories
          </button>
        </div>
      )}
      {(q || categoryId || typeId || activeCount > 0) && (
        <div className="applied-filters">
          {q && (
            <button type="button" aria-label={`Remove search ${q}`} onClick={() => updateQuery({ q: "", page: "1" })}>
              Search: {q}
              <X size={14} aria-hidden="true" />
            </button>
          )}
          {categoryId && (
            <button type="button" aria-label="Remove category filter" onClick={() => updateQuery({ category_id: "", page: "1" })}>
              {selectedCategory?.name ?? "Category"}
              <X size={14} aria-hidden="true" />
            </button>
          )}
          {typeId && (
            <button type="button" aria-label="Remove product type filter" onClick={() => updateQuery({ product_type_id: "", page: "1" })}>
              {selectedType?.name ?? "Product type"}
              <X size={14} aria-hidden="true" />
            </button>
          )}
          {minPrice && (
            <button type="button" aria-label="Remove minimum price" onClick={() => updateQuery({ min_price: "", page: "1" })}>
              From ₹{minPrice} <X size={14} aria-hidden="true" />
            </button>
          )}
          {maxPrice && (
            <button type="button" aria-label="Remove maximum price" onClick={() => updateQuery({ max_price: "", page: "1" })}>
              Up to ₹{maxPrice} <X size={14} aria-hidden="true" />
            </button>
          )}
          {Object.entries(selectedValues).flatMap(([id, values]) =>
            values.map((value) => (
              <button type="button" key={`${id}:${value}`} aria-label={`Remove ${value} filter`} onClick={() => changeFilter(id, value)}>
                {localFilters.find((filter) => filter.id === id)?.name ?? "Specification"}: {value}
                <X size={14} aria-hidden="true" />
              </button>
            )),
          )}
          <Link href="/products" className="text-link">
            Clear all
          </Link>
        </div>
      )}
      <button className="catalog-mobile-filter-toggle" type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal size={18} aria-hidden="true" /> Filters
        {activeCount > 0 && <span>{activeCount}</span>}
      </button>
      <div className="catalog-layout">
        <CatalogFilters
          filters={filters.data?.data}
          selectedValues={selectedValues}
          minPrice={minPrice}
          maxPrice={maxPrice}
          activeCount={activeCount}
          open={filtersOpen}
          error={filters.error}
          onClose={closeFilters}
          onRetry={filters.retry}
          onValueToggle={changeFilter}
          onPriceApply={(min, max) => updateQuery({ min_price: min, max_price: max, page: "1" })}
          onClear={resetSpecifications}
        />
        <div className="catalog-results">
      {products.error ? (
        <ErrorState error={products.error} retry={products.retry} />
      ) : !products.data ? (
        <LoadingState />
      ) : (
        <>
          <div className="catalog-count" role="status">
            <strong>{`${products.data.meta.total} ${products.data.meta.total === 1 ? "product" : "products"}`}</strong>
            <span>{products.data.meta.from && products.data.meta.to ? `Showing ${products.data.meta.from}–${products.data.meta.to}` : "Available equipment"}</span>
          </div>
          {visible.length ? (
            <div className="product-grid">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Let's try a different direction."
              description="No equipment matches this selection. Clear your filters or browse another category."
            />
          )}
          {products.data.meta.last_page > 1 && (
            <nav className="pagination" aria-label="Catalog pages">
              {page > 1 ? (
                <Link className="button secondary" href={pageHref(page - 1)} onClick={() => document.querySelector(".catalog-heading")?.scrollIntoView({ behavior: "instant" })}>
                  <ArrowLeft size={16} />
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span>
                Page {page} of {products.data.meta.last_page}
              </span>
              {page < products.data.meta.last_page ? (
                <Link className="button secondary" href={pageHref(page + 1)} onClick={() => document.querySelector(".catalog-heading")?.scrollIntoView({ behavior: "instant" })}>
                  Next
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}
