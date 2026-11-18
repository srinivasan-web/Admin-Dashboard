import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
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
import { ProductCard, ProductCardSkeleton } from "../components/catalog/ProductCard";
import { productViews } from "../components/catalog/productViews";
import { EmptyState, ErrorState } from "../components/Feedback";

export default function CatalogPage({
  query,
  categorySlug,
  categories,
  productTypes,
  categoryError,
  retryCategories,
}: {
  query: string;
  categorySlug?: string;
  categories?: Category[];
  productTypes?: ProductType[];
  categoryError?: Error;
  retryCategories: () => void;
}) {
  const params = new URLSearchParams(query);
  const slugCategory = categories?.find((category) => category.slug === categorySlug);
  const categoryId = categorySlug
    ? slugCategory?.id ?? ""
    : params.get("category_id") ?? "";
  const listingPath = categorySlug
    ? `/equipment/${encodeURIComponent(categorySlug)}`
    : "/products";
  const typeId = categorySlug
    ? slugCategory
      ? ""
      : productTypes?.find((type) => type.slug === categorySlug)?.id ?? ""
    : params.get("product_type_id") ?? "";
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

  const bannerTarget = typeId
    ? `&product_type_id=${encodeURIComponent(typeId)}`
    : categoryId
      ? `&category_id=${encodeURIComponent(categoryId)}`
      : "";
  const banners = useCatalogResource<Collection<PublicBanner>>(
    `/banners/active?page=listing${bannerTarget}`,
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const selectedCategory = categories?.find((category) => category.id === categoryId);
  const selectedType = productTypes?.find((type) => type.id === typeId);
  const title = selectedCategory?.name ?? selectedType?.name ?? "Explore equipment";
  const description =
    selectedCategory?.description ??
    selectedType?.description ??
    "Engineered for daily progress, reliable training, and real living spaces. Discover our precision-crafted equipment.";

  useEffect(() => {
    document.title = `${title} | Durafit91`;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = description;
  }, [title, description]);

  const visible = products.data?.data ?? [];
  const has360Products = visible.some((product) => product.has_360_view ?? productViews(product.images).has360);
  const localFilters = filters.data?.data ?? [];
  const activeCount =
    Object.values(selectedValues).reduce((total, values) => total + values.length, 0) +
    Number(Boolean(minPrice || maxPrice));

  function listingHref(next: URLSearchParams) {
    if (categorySlug) {
      next.delete("category_id");
      next.delete("product_type_id");
    }
    return `${listingPath}?${next}`;
  }

  function updateQuery(values: Record<string, string>) {
    const next = new URLSearchParams(apiQuery);
    if ("category_id" in values || "product_type_id" in values) {
      for (const key of [...next.keys()]) {
        if (key.startsWith("attributes[")) next.delete(key);
      }
      next.delete("min_price");
      next.delete("max_price");
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    navigate(listingHref(next));
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
    navigate(listingHref(next));
  }

  function resetSpecifications() {
    const next = new URLSearchParams(apiQuery);
    for (const key of [...next.keys()]) {
      if (key.startsWith("attributes[")) next.delete(key);
    }
    next.delete("min_price");
    next.delete("max_price");
    next.set("page", "1");
    navigate(listingHref(next));
  }

  function pageHref(number: number) {
    const next = new URLSearchParams(apiQuery);
    next.set("page", String(number));
    return listingHref(next);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery({
      q: String(new FormData(event.currentTarget).get("q") ?? "").trim(),
      page: "1",
    });
    document.querySelector(".catalog-heading")?.scrollIntoView({ behavior: "instant" });
  }

  const activeBanner = banners.data?.data?.[0];

  return (
    <div className="catalog-page min-h-[60vh] pt-4 sm:pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1360px] mx-auto">
      {/* 1. Breadcrumb */}
      <nav className="breadcrumb flex items-center gap-1.5 text-xs text-slate-400 mb-5 overflow-x-auto whitespace-nowrap py-1" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-navy transition-colors">Home</Link>
        <ChevronRight size={13} className="text-slate-300 shrink-0" />
        <Link href="/products" className="hover:text-navy transition-colors">Equipment</Link>
        {selectedCategory && (
          <>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <span className="text-slate-800 font-semibold" aria-current="page">{title}</span>
          </>
        )}
        {!selectedCategory && selectedType && (
          <>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <span className="text-slate-800 font-semibold" aria-current="page">{title}</span>
          </>
        )}
      </nav>

      {/* 2. Admin Banner / Special Campaign */}
      {banners.error ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <span>Campaign banner couldn’t load. Products are still available.</span>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={banners.retry}>Retry</button>
        </div>
      ) : activeBanner ? <ListingBanner key={activeBanner.id} banner={activeBanner} /> : null}

      {/* 3. Category Heading & Quick Filter Pills */}
      <div className="catalog-heading mb-6 sm:mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="eyebrow inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-deep mb-2">
              <Sparkles size={13} />
              <span>{selectedCategory || selectedType ? "EQUIPMENT CATEGORY" : "COMPLETE CATALOGUE"}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-navy tracking-tight leading-tight">
              {title}
            </h1>
            {selectedType && selectedCategory && (
              <p className="catalog-context text-xs font-semibold text-accent-deep mt-1">
                In {selectedType.name}
              </p>
            )}
            <p className="text-sm sm:text-base text-slate-500 max-w-2xl mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Quick Categories Bar */}
          {categories && categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              <Link
                href="/products"
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  !categoryId
                    ? "bg-navy text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </Link>
              {categories.map((cat) => {
                const isActive = cat.id === categoryId;
                return (
                  <Link
                    key={cat.id}
                    href={`/equipment/${encodeURIComponent(cat.slug)}`}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-navy text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Filter Toolbar & Search */}
      <div className="catalog-toolbar flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 mb-5 shadow-2xs">
        {/* Search Input */}
        <form className="catalog-search relative flex-1 flex items-center min-w-0" onSubmit={search} role="search">
          <label className="sr-only" htmlFor="catalog-search">
            Search by name or SKU
          </label>
          <div className="relative w-full flex items-center">
            <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              id="catalog-search"
              name="q"
              maxLength={100}
              defaultValue={q}
              placeholder="Search equipment by name or SKU…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-20 text-[13px] text-navy placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 h-7 px-3 rounded-lg bg-navy hover:bg-navy-soft active:scale-95 text-white text-[11px] font-bold transition-all"
            >
              Search
            </button>
          </div>
        </form>

        {/* Filters Controls Group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Filter Toggle */}
          <button
            className="catalog-mobile-filter-toggle lg:hidden inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-navy hover:border-slate-300 transition-colors shadow-2xs"
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-accent-deep text-white px-1.5 py-0.2 text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </button>

          {/* Category Dropdown (if on generic /products) */}
          {!categorySlug && categories && categories.length > 0 && (
            <label className="category-select relative block min-w-[130px]">
              <span className="sr-only">Category</span>
              <select
                value={categoryId}
                onChange={(event) =>
                  navigate(
                    event.target.value
                      ? `/equipment/${encodeURIComponent(
                          categories.find((c) => c.id === event.target.value)?.slug ?? "",
                        )}`
                      : "/products",
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-7 text-[12px] font-medium text-navy focus:border-accent outline-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Sort Dropdown */}
          <label className="category-select relative block min-w-[150px]">
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={(event) => updateQuery({ sort: event.target.value, page: "1" })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-7 text-[12px] font-medium text-navy focus:border-accent outline-none cursor-pointer"
            >
              <option value="name">Sort: Recommended</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </label>
        </div>
      </div>

      {categoryError && (
        <div className="filter-error flex items-center gap-3 text-xs text-red-600 mb-4 p-3 bg-red-50 rounded-xl">
          <span>Categories couldn't be loaded.</span>
          <button className="font-bold underline hover:text-red-800" onClick={retryCategories}>
            Retry categories
          </button>
        </div>
      )}

      {/* 5. Applied Filter Chips */}
      {(q || categoryId || typeId || activeCount > 0) && (
        <div className="applied-filters flex flex-wrap items-center gap-2 mb-6 p-3 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Active:
          </span>

          {q && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-orange-100 transition-colors"
              aria-label={`Remove search ${q}`}
              onClick={() => updateQuery({ q: "", page: "1" })}
            >
              <span>Search: "{q}"</span>
              <X size={13} className="text-accent-deep" />
            </button>
          )}

          {categoryId && !categorySlug && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-orange-100 transition-colors"
              aria-label="Remove category filter"
              onClick={() => navigate("/products")}
            >
              <span>{selectedCategory?.name ?? "Category"}</span>
              <X size={13} className="text-accent-deep" />
            </button>
          )}

          {typeId && !categorySlug && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-orange-100 transition-colors"
              aria-label="Remove product type filter"
              onClick={() => navigate("/products")}
            >
              <span>{selectedType?.name ?? "Type"}</span>
              <X size={13} className="text-accent-deep" />
            </button>
          )}

          {minPrice && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-orange-100 transition-colors"
              aria-label="Remove minimum price"
              onClick={() => updateQuery({ min_price: "", page: "1" })}
            >
              <span>From ₹{Number(minPrice).toLocaleString("en-IN")}</span>
              <X size={13} className="text-accent-deep" />
            </button>
          )}

          {maxPrice && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-orange-100 transition-colors"
              aria-label="Remove maximum price"
              onClick={() => updateQuery({ max_price: "", page: "1" })}
            >
              <span>Up to ₹{Number(maxPrice).toLocaleString("en-IN")}</span>
              <X size={13} className="text-accent-deep" />
            </button>
          )}

          {Object.entries(selectedValues).flatMap(([id, values]) =>
            values.map((value) => {
              const filterDef = localFilters.find((f) => f.id === id);
              return (
                <button
                  type="button"
                  key={`${id}:${value}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-orange-100 transition-colors"
                  aria-label={`Remove ${value} filter`}
                  onClick={() => changeFilter(id, value)}
                >
                  <span>
                    {filterDef?.name ?? "Spec"}: {value}
                  </span>
                  <X size={13} className="text-accent-deep" />
                </button>
              );
            }),
          )}

          <button
            type="button"
            onClick={resetSpecifications}
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-accent-deep hover:text-[#a83d00] transition-colors"
          >
            <RotateCcw size={12} />
            <span>Clear all</span>
          </button>
        </div>
      )}

      {/* 6. Main Content Layout (Sidebar + Results) */}
      <div className="catalog-layout grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] items-start gap-8">
        {/* Filter Sidebar */}
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

        {/* Results Area */}
        <div className="catalog-results min-w-0">
          {products.error ? (
            <ErrorState error={products.error} retry={products.retry} />
          ) : !products.data ? (
            <div>
              <div className="catalog-count mb-4 flex items-center justify-between text-xs text-slate-400">
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <ProductCardSkeleton key={idx} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Product Count Header */}
              <div className="catalog-count mb-4 flex flex-wrap items-center justify-between gap-3 text-xs" role="status">
                <strong className="text-sm font-bold text-navy">
                  {`${products.data.meta.total} ${
                    products.data.meta.total === 1 ? "product" : "products"
                  }`}
                </strong>
                <span className="text-slate-500 font-medium">
                  {products.data.meta.from && products.data.meta.to
                    ? `Showing ${products.data.meta.from}–${products.data.meta.to} of ${products.data.meta.total}`
                    : "Available equipment"}
                </span>
              </div>

              {has360Products && (
                <p className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs leading-5 text-navy">
                  Explore 360° on products with a real photo sequence. Rotate the product on its detail page to check every angle before you choose.
                </p>
              )}

              {/* Product Grid */}
              {visible.length ? (
                <div className="product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visible.map((product, idx) => (
                    <ProductCard key={product.id} product={product} eager={idx < 3} />
                  ))}
                </div>
              ) : (
                <div className="py-12 px-6 rounded-2xl border border-slate-200/80 bg-white text-center shadow-xs">
                  <EmptyState
                    title="No equipment matched your filters"
                    description="Try adjusting your price range or removing specifications to see more options."
                  />
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={resetSpecifications}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-soft active:scale-95 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <RotateCcw size={14} />
                      <span>Reset all filters</span>
                    </button>
                  )}
                </div>
              )}

              {/* 7. Pagination */}
              {products.data.meta.last_page > 1 && (
                <nav className="pagination mt-10 flex items-center justify-between gap-3.5 border-t border-slate-200/80 pt-6 text-xs" aria-label="Catalog pages">
                  {page > 1 ? (
                    <Link
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-navy hover:bg-slate-50 transition-colors shadow-2xs"
                      href={pageHref(page - 1)}
                      onClick={() =>
                        document.querySelector(".catalog-heading")?.scrollIntoView({ behavior: "instant" })
                      }
                    >
                      <ArrowLeft size={15} />
                      <span>Previous</span>
                    </Link>
                  ) : (
                    <span />
                  )}

                  <span className="font-semibold text-slate-600">
                    Page <strong className="text-navy">{page}</strong> of{" "}
                    <strong>{products.data.meta.last_page}</strong>
                  </span>

                  {page < products.data.meta.last_page ? (
                    <Link
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-navy hover:bg-slate-50 transition-colors shadow-2xs"
                      href={pageHref(page + 1)}
                      onClick={() =>
                        document.querySelector(".catalog-heading")?.scrollIntoView({ behavior: "instant" })
                      }
                    >
                      <span>Next</span>
                      <ArrowRight size={15} />
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
