import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "../../app/navigation";
import type { ProductType } from "../../api/catalog";
import { CategoryCard } from "./CategoryCard";

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function ProductTypeSection({
  productTypes,
  productTypeError,
  retryProductTypes,
}: {
  productTypes?: ProductType[];
  productTypeError?: Error;
  retryProductTypes: () => void;
}) {
  const headingId = useId();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  // A visual carousel should not show an empty navy tile for a type with no artwork.
  // Such types remain available in the catalogue filters until an admin adds an image.
  const displayTypes = productTypes?.filter((type) => Boolean(type.image_url));

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const updateProgress = () => {
      const step = Math.max(1, slider.clientWidth * 0.76);
      const maxScroll = Math.max(0, slider.scrollWidth - slider.clientWidth);
      const count = Math.max(1, Math.ceil(maxScroll / step) + 1);
      setPageCount(count);
      setPage(Math.min(count - 1, Math.ceil(slider.scrollLeft / step)));

      // Promote the first card entering the visible viewport. Measuring its
      // rendered edge (rather than dividing scrollLeft by a fixed card width)
      // remains correct while featured cards have different widths.
      const viewportLeft = slider.getBoundingClientRect().left + slider.clientLeft;
      const leadingCard = Array.from(
        slider.querySelectorAll<HTMLElement>("[data-product-type-index]"),
      ).find((card) => card.getBoundingClientRect().right > viewportLeft + 28);
      const nextActiveIndex = Number(leadingCard?.dataset.productTypeIndex ?? 0);
      setActiveIndex((current) =>
        Number.isFinite(nextActiveIndex) ? nextActiveIndex : current,
      );
    };

    updateProgress();
    slider.addEventListener("scroll", updateProgress, { passive: true });
    const observer = new ResizeObserver(updateProgress);
    observer.observe(slider);
    slider
      .querySelectorAll<HTMLElement>("[data-product-type-index]")
      .forEach((card) => observer.observe(card));
    return () => {
      slider.removeEventListener("scroll", updateProgress);
      observer.disconnect();
    };
  }, [displayTypes?.length]);

  function move(direction: -1 | 1) {
    const slider = sliderRef.current;
    if (!slider) return;
    slider.scrollBy({
      left: direction * Math.max(260, slider.clientWidth * 0.76),
      behavior: preferredScrollBehavior(),
    });
  }

  function goTo(nextPage: number) {
    const slider = sliderRef.current;
    if (!slider) return;
    slider.scrollTo({
      left: nextPage * Math.max(1, slider.clientWidth * 0.76),
      behavior: preferredScrollBehavior(),
    });
  }

  return (
    <section
      className="border-b border-line py-16 lg:py-20"
      id="categories"
      aria-labelledby={headingId}
      data-testid="product-type-section"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4 lg:mb-6">
        <div>
          <h2
            className="m-0 text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.15] font-bold"
            id={headingId}
          >
            Explore equipment
          </h2>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy transition-colors hover:text-accent-deep"
          href="/products"
        >
          All equipment <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      {productTypeError && (
        <p className="mb-5 text-sm text-muted" role="alert">
          Product types are temporarily unavailable.{" "}
          <button
            type="button"
            className="font-semibold text-accent-deep underline underline-offset-4"
            onClick={retryProductTypes}
          >
            Retry
          </button>
        </p>
      )}
      <div className="relative">
        <button
          type="button"
          className="absolute top-1/2 -left-8 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border-2 border-line bg-white text-accent shadow-sm transition-colors hover:border-accent hover:bg-warm disabled:cursor-not-allowed disabled:opacity-30 xl:grid"
          aria-label="Show previous product types"
          onClick={() => move(-1)}
          disabled={page === 0}
        >
          <ArrowLeft size={23} aria-hidden="true" />
        </button>
        <div
          ref={sliderRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 [overflow-anchor:auto] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 lg:gap-5"
          role="region"
          aria-label="Product types"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              move(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              move(1);
            }
            if (event.key === "Home") {
              event.preventDefault();
              goTo(0);
            }
            if (event.key === "End") {
              event.preventDefault();
              goTo(pageCount - 1);
            }
          }}
          data-testid="product-type-slider"
        >
          {!productTypes && !productTypeError && <p className="py-8 text-sm text-muted">Loading product types…</p>}
          {displayTypes?.length === 0 && <p className="py-8 text-sm text-muted">No equipment images are available yet.</p>}
          {displayTypes?.map((productType, index) => {
            return (
              <CategoryCard
                key={productType.id}
                title={productType.name}
                image={productType.image_url ?? undefined}
                index={index + 1}
                cardIndex={index}
                featured={
                  index === (focusedIndex ?? hoveredIndex ?? activeIndex)
                }
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(null)}
                href={`/products?product_type_id=${encodeURIComponent(productType.id)}`}
                filtered
              />
            );
          })}
        </div>
        <button
          type="button"
          className="absolute top-1/2 -right-8 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border-2 border-line bg-white text-accent shadow-sm transition-colors hover:border-accent hover:bg-warm disabled:cursor-not-allowed disabled:opacity-30 xl:grid"
          aria-label="Show next product types"
          onClick={() => move(1)}
          disabled={page >= pageCount - 1}
        >
          <ArrowRight size={23} aria-hidden="true" />
        </button>
      </div>
      {pageCount > 1 && (
        <div
          className="mt-4 flex items-center justify-center gap-2"
          aria-label="Product type slider progress"
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              type="button"
              className={`h-1.5 rounded-full transition-[width,background] duration-200 ${
                index === page
                  ? "w-6 bg-accent"
                  : "w-2 bg-line hover:bg-muted"
              }`}
              key={index}
              onClick={() => goTo(index)}
              aria-label={`Show product types ${index + 1} of ${pageCount}`}
              aria-current={index === page ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
