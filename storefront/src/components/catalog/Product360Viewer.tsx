import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { Product } from "../../api/catalog";

export function Product360Viewer({
  name,
  frames,
  onUnavailable,
}: {
  name: string;
  frames: Product["images"];
  onUnavailable: () => void;
}) {
  const [index, setIndex] = useState(0);
  const lastX = useRef<number | null>(null);

  useEffect(() => {
    // Warm only adjacent angles; fetching every frame would be costly on mobile.
    for (const offset of [-1, 1]) {
      const preload = new Image();
      preload.src = frames[(index + offset + frames.length) % frames.length].url;
    }
  }, [frames, index]);

  function step(amount: number) {
    setIndex((current) => (current + amount + frames.length) % frames.length);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (lastX.current === null) return;
    const distance = event.clientX - lastX.current;
    const steps = Math.trunc(distance / 12);
    if (steps) {
      step(-steps);
      lastX.current += steps * 12;
    }
  }

  return (
    <div className="flex flex-col gap-4" id="product-360">
      <div
        role="region"
        aria-label={`${name} 360 degree product view`}
        aria-describedby="product-360-help"
        tabIndex={0}
        className="relative grid aspect-square cursor-grab touch-pan-y select-none place-items-center overflow-hidden rounded-2xl border border-line bg-surface p-5 outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing sm:p-8"
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button === 0) {
            lastX.current = event.clientX;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={move}
        onPointerUp={() => { lastX.current = null; }}
        onPointerCancel={() => { lastX.current = null; }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            step(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <img
          src={frames[index].url}
          alt={`${name}, angle ${index + 1} of ${frames.length}`}
          draggable={false}
          loading="eager"
          decoding="async"
          width="640"
          height="640"
          className="pointer-events-none h-full w-full object-contain"
          onError={onUnavailable}
        />
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy shadow-sm">
          <RotateCw size={15} aria-hidden="true" /> 360° real-product view
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="product-360-help" className="text-xs text-muted">Drag to rotate or use the arrow keys. Actual product photographs.</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label="Rotate product left" className="grid size-10 place-items-center rounded-full border border-line bg-white hover:border-accent"><ArrowLeft size={17} aria-hidden="true" /></button>
          <span className="min-w-12 text-center text-xs tabular-nums text-muted" aria-live="polite">{index + 1} / {frames.length}</span>
          <button type="button" onClick={() => step(1)} aria-label="Rotate product right" className="grid size-10 place-items-center rounded-full border border-line bg-white hover:border-accent"><ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  );
}
