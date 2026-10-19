import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import type { PublicBanner } from "../../api/catalog";

export function CarouselControls({
  banners,
  activeIndex,
  userPaused,
  autoplayAvailable,
  onPrevious,
  onNext,
  onSelect,
  onTogglePause,
}: {
  banners: PublicBanner[];
  activeIndex: number;
  userPaused: boolean;
  autoplayAvailable: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onTogglePause: () => void;
}) {
  if (banners.length < 2) return null;

  return (
    <div className="hero-controls" aria-label="Carousel controls">
      <div className="hero-dots" aria-label="Choose a banner">
        {banners.map((banner, index) => (
          <button
            type="button"
            key={banner.id}
            className={
              index === activeIndex ? "hero-dot is-active" : "hero-dot"
            }
            aria-label={`Show banner ${index + 1}: ${banner.title}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => onSelect(index)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="hero-control-actions">
        {autoplayAvailable && (
          <button
            type="button"
            className="hero-control-button"
            aria-label={userPaused ? "Play carousel" : "Pause carousel"}
            title={userPaused ? "Play carousel" : "Pause carousel"}
            onClick={onTogglePause}
          >
            {userPaused ? (
              <Play size={18} aria-hidden="true" />
            ) : (
              <Pause size={18} aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="button"
          className="hero-control-button"
          aria-label="Previous banner"
          onClick={onPrevious}
        >
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hero-control-button"
          aria-label="Next banner"
          onClick={onNext}
        >
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
