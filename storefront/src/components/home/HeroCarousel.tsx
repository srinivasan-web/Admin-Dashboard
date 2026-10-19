import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Link } from "../../app/navigation";
import { usePublicBanners } from "../../api/banners";
import { HeroSlide } from "./HeroSlide";
import { CarouselControls } from "./CarouselControls";

export function HeroCarousel({ autoPlay = true }: { autoPlay?: boolean }) {
  const banners = usePublicBanners();
  const slides = banners.data?.data ?? [];
  const [activeId, setActiveId] = useState<string>();
  const activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activeId),
  );
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [direction, setDirection] = useState(1);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduceMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setHidden(document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    setActiveId((current) =>
      slides.some((slide) => slide.id === current) ? current : slides[0]?.id,
    );
  }, [banners.data]);

  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(activeIndex + 1) % slides.length];
    const image = new window.Image();
    image.decoding = "async";
    image.src = window.matchMedia("(max-width: 640px)").matches
      ? next.mobile_image_url || next.desktop_image_url
      : next.desktop_image_url;
  }, [banners.data, activeIndex]);

  const paused =
    userPaused ||
    hoverPaused ||
    focusPaused ||
    hidden ||
    reduceMotion ||
    !autoPlay;
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      setDirection(1);
      setActiveId(slides[(activeIndex + 1) % slides.length].id);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [paused, banners.data, activeIndex]);

  function select(index: number, movement = index >= activeIndex ? 1 : -1) {
    setDirection(movement);
    setActiveId(slides[index]?.id);
  }

  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function pointerUp(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || slides.length < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    swiped.current = true;
    window.setTimeout(() => {
      swiped.current = false;
    }, 300);
    select(
      (activeIndex + (dx < 0 ? 1 : slides.length - 1)) % slides.length,
      dx < 0 ? 1 : -1,
    );
  }

  if (banners.error && !banners.data) {
    return (
      <section
        className="hero-carousel hero-carousel-state"
        aria-label="Homepage campaigns"
      >
        <div className="hero-state-content" role="alert">
          <span className="hero-slide-overline">DURAFIT91</span>
          <h1>Make movement part of home.</h1>
          <p>Campaigns could not be loaded right now.</p>
          <button
            type="button"
            className="hero-slide-cta"
            onClick={banners.retry}
          >
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      </section>
    );
  }
  if (!banners.data) {
    return (
      <section
        className="hero-carousel hero-carousel-state"
        aria-label="Loading homepage campaigns"
        role="status"
      >
        <div className="hero-state-content hero-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="sr-only">Loading homepage campaigns…</span>
      </section>
    );
  }
  if (!slides.length) {
    return (
      <section
        className="hero-carousel hero-carousel-state"
        aria-label="Homepage campaigns"
      >
        <div className="hero-state-content">
          <span className="hero-slide-overline">DURAFIT91 · MOVE YOUR WAY</span>
          <h1>Make movement part of home.</h1>
          <p>Explore equipment built for your everyday routine.</p>
          <Link className="hero-slide-cta" href="/products">
            Explore equipment <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  const index = Math.min(activeIndex, slides.length - 1);
  return (
    <section
      className="hero-carousel"
      aria-label="Homepage campaigns"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("a,button,input,select,textarea")
        )
          return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          select((index + 1) % slides.length, 1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          select((index + slides.length - 1) % slides.length, -1);
        }
      }}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocusPaused(false);
      }}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onClickCapture={(event) => {
        if (swiped.current) {
          event.preventDefault();
          event.stopPropagation();
          swiped.current = false;
        }
      }}
    >
      <div
        className="hero-carousel-track"
        aria-live={paused ? "polite" : "off"}
      >
        <AnimatePresence
          initial={false}
          custom={{ direction, reduceMotion }}
          mode="sync"
        >
          <HeroSlide
            key={slides[index].id}
            banner={slides[index]}
            index={index}
            count={slides.length}
            direction={direction}
            reduceMotion={reduceMotion}
          />
        </AnimatePresence>
      </div>
      {banners.error && (
        <button
          className="hero-refresh-notice"
          type="button"
          onClick={banners.retry}
        >
          Campaign update failed. Retry
        </button>
      )}
      <CarouselControls
        banners={slides}
        activeIndex={index}
        userPaused={userPaused}
        autoplayAvailable={autoPlay && !reduceMotion && slides.length > 1}
        onPrevious={() =>
          select((index + slides.length - 1) % slides.length, -1)
        }
        onNext={() => select((index + 1) % slides.length, 1)}
        onSelect={select}
        onTogglePause={() => setUserPaused((value) => !value)}
      />
    </section>
  );
}
