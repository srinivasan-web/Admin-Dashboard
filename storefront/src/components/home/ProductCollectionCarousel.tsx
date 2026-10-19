import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Product } from "../../api/catalog";
import { ProductCard } from "../catalog/ProductCard";

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function ProductCollectionCarousel({
  products,
  label,
}: {
  products: Product[];
  label: string;
}) {
  const carouselId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateProgress = () => {
      const step = Math.max(1, track.clientWidth * 0.82);
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const count = Math.max(1, Math.ceil(maxScroll / step) + 1);
      setPageCount((current) => (current === count ? current : count));
      const nextPage = Math.min(count - 1, Math.round(track.scrollLeft / step));
      setPage((current) => (current === nextPage ? current : nextPage));
    };

    updateProgress();
    track.addEventListener("scroll", updateProgress, { passive: true });
    const observer = new ResizeObserver(updateProgress);
    observer.observe(track);
    track
      .querySelectorAll<HTMLElement>(".product-collection-slide")
      .forEach((slide) => observer.observe(slide));

    return () => {
      track.removeEventListener("scroll", updateProgress);
      observer.disconnect();
    };
  }, [products]);

  function goToPage(nextPage: number) {
    const track = trackRef.current;
    if (!track) return;
    const step = Math.max(1, track.clientWidth * 0.82);
    track.scrollTo({
      left: Math.min(nextPage * step, track.scrollWidth - track.clientWidth),
      behavior: scrollBehavior(),
    });
  }

  function move(direction: -1 | 1) {
    goToPage(Math.max(0, Math.min(pageCount - 1, page + direction)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToPage(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToPage(pageCount - 1);
    }
  }

  return (
    <div
      className="product-collection-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-testid="product-collection-carousel"
    >
      {pageCount > 1 && (
        <div className="product-collection-tools">
          <span className="product-collection-position" aria-live="polite">
            {String(page + 1).padStart(2, "0")} / {String(pageCount).padStart(2, "0")}
          </span>
          <button
            className="product-collection-arrow"
            type="button"
            aria-label={`Show previous ${label.toLowerCase()}`}
            aria-controls={carouselId}
            onClick={() => move(-1)}
            disabled={page === 0}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <button
            className="product-collection-arrow"
            type="button"
            aria-label={`Show next ${label.toLowerCase()}`}
            aria-controls={carouselId}
            onClick={() => move(1)}
            disabled={page >= pageCount - 1}
          >
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="product-collection-viewport">
        <div
          ref={trackRef}
          id={carouselId}
          className="product-collection-track"
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label={`${label} slides`}
          data-testid="product-collection-track"
        >
          {products.map((product, index) => (
            <div
              className="product-collection-slide"
              key={product.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${products.length}: ${product.name}`}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
      {pageCount > 1 && (
        <div className="product-collection-pagination" aria-label={`${label} pages`}>
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              className={`product-collection-dot${index === page ? " is-active" : ""}`}
              key={index}
              type="button"
              onClick={() => goToPage(index)}
              aria-label={`Show ${label.toLowerCase()} page ${index + 1} of ${pageCount}`}
              aria-current={index === page ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
