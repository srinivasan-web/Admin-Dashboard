import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";
import type { Product } from "../../api/catalog";
import { ProductImage } from "./ProductCard";
import { Product360Viewer } from "./Product360Viewer";
import { productViews } from "./productViews";

export function ProductGallery({ product }: { product: Product }) {
  const { photos, frames, has360 } = productViews(product.images);
  const images = photos.length ? photos : product.images;
  const [selectedId, setSelectedId] = useState<string>();
  const [view360, setView360] = useState(() => new URLSearchParams(window.location.search).get("view") === "360");
  const [rotationUnavailable, setRotationUnavailable] = useState(false);
  const canRotate = has360 && !rotationUnavailable;
  const [expanded, setExpanded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected =
    images.find((image) => image.id === selectedId) ??
    images.find((image) => image.is_primary) ??
    images[0];
  const index = selected ? images.indexOf(selected) : 0;

  function move(direction: -1 | 1) {
    if (images.length > 1) {
      setZoomed(false);
      setSelectedId(
        images[(index + direction + images.length) % images.length].id,
      );
    }
  }

  useEffect(() => {
    if (!expanded) return;
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  const navigation = images.length > 1 && (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full border border-line bg-white text-navy transition-colors hover:border-accent hover:text-accent-deep"
        aria-label="Previous product image"
        onClick={() => move(-1)}
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <span
        className="min-w-12 text-center text-xs tabular-nums text-muted"
        aria-live="polite"
      >
        {index + 1} / {images.length}
      </span>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full border border-line bg-white text-navy transition-colors hover:border-accent hover:text-accent-deep"
        aria-label="Next product image"
        onClick={() => move(1)}
      >
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <section
      aria-label="Product images and product views"
      data-testid="product-gallery"
      onKeyDown={(event) => {
        if (!(view360 && canRotate) && !zoomed && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      {canRotate && (
        <div className="mb-3 flex gap-2" role="group" aria-label="Choose product view">
          <button type="button" aria-pressed={!view360} onClick={() => setView360(false)} className={`min-h-10 rounded-full border px-4 text-xs font-semibold ${!view360 ? "border-accent bg-orange-50 text-accent-deep" : "border-line bg-white"}`}>Photos</button>
          <button type="button" aria-pressed={view360} onClick={() => setView360(true)} className={`min-h-10 rounded-full border px-4 text-xs font-semibold ${view360 ? "border-accent bg-orange-50 text-accent-deep" : "border-line bg-white"}`}>Explore 360°</button>
        </div>
      )}
      {view360 && canRotate ? <Product360Viewer name={product.name} frames={frames} onUnavailable={() => { setRotationUnavailable(true); setView360(false); }} /> : <>
      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-8 [&>img]:h-full [&>img]:w-full [&>img]:object-contain">
        <ProductImage key={selected?.id} product={product} url={selected?.url} eager />
        {selected && (
          <button
            type="button"
            className="absolute right-4 bottom-4 flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-xs font-semibold transition-colors hover:border-accent hover:text-accent-deep"
            aria-label="Expand product image"
            onClick={() => { setZoomed(false); setExpanded(true); }}
          >
            <Expand size={16} aria-hidden="true" /> View larger
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div
          className="mt-4 flex gap-3 overflow-x-auto pb-2"
          aria-label="Choose product image"
        >
          {images.map((image, imageIndex) => (
            <button
              type="button"
              key={image.id}
              className={`grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white p-1.5 transition-colors ${selected?.id === image.id ? "border-accent ring-1 ring-accent" : "border-line hover:border-accent"}`}
              aria-label={`Show product image ${imageIndex + 1}`}
              aria-pressed={selected?.id === image.id}
              onClick={() => setSelectedId(image.id)}
            >
              <img
                src={image.url}
                alt=""
                loading="lazy"
                decoding="async"
                width="80"
                height="80"
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
      {navigation && (
        <div className="mt-3 flex justify-center">{navigation}</div>
      )}
      </>}
      <dialog
        ref={dialog}
        className="fixed inset-0 m-auto h-[min(900px,94dvh)] max-h-[94dvh] w-[min(1100px,94vw)] max-w-[94vw] rounded-2xl border border-line bg-white p-4 text-navy shadow-xl backdrop:bg-navy/75 sm:p-6"
        aria-label={`${product.name} image viewer`}
        onCancel={() => { setExpanded(false); setZoomed(false); }}
        onClose={() => { setExpanded(false); setZoomed(false); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              setExpanded(false);
          }
        }}
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <p className="m-0 truncate text-sm font-semibold">{product.name}</p>
            <button
              type="button"
              autoFocus
              className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white hover:text-accent-deep"
              aria-label="Close image viewer"
              onClick={() => setExpanded(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div id="product-image-viewport" role="region" aria-label="Product image zoom area" tabIndex={0} className="min-h-0 flex-1 overflow-auto rounded-xl focus-visible:outline-accent">
            <div className={zoomed ? "w-[180%] min-w-[180%] [&>img]:h-auto [&>img]:w-full [&>img]:max-w-none" : "grid h-full w-full place-items-center [&>img]:max-h-full [&>img]:min-h-0 [&>img]:w-full [&>img]:object-contain"}>
              <ProductImage product={product} url={selected?.url} eager />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {navigation}
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-xs font-semibold hover:border-accent hover:text-accent-deep" aria-label={zoomed ? "Zoom out product image" : "Zoom in product image"} aria-pressed={zoomed} aria-controls="product-image-viewport" onClick={() => setZoomed((value) => !value)}>
              {zoomed ? <ZoomOut size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />} {zoomed ? "Zoom out" : "Zoom in"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
