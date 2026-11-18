import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import type { PublicBanner } from "../../api/catalog";

export function ListingBanner({ banner }: { banner: PublicBanner }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section
      className="catalog-campaign relative mb-8 overflow-hidden rounded-2xl bg-navy text-white shadow-md border border-slate-800/40"
      aria-label={banner.title}
    >
      {!imageFailed && (
        <picture className="catalog-campaign-image absolute inset-0 h-full w-full">
          {banner.mobile_image_url && (
            <source media="(max-width: 640px)" srcSet={banner.mobile_image_url} />
          )}
          <img
            src={banner.desktop_image_url}
            alt=""
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover object-center"
            onError={() => setImageFailed(true)}
          />
        </picture>
      )}

      {/* Dynamic gradient shade for text legibility */}
      <div
        className="catalog-campaign-shade absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/70 to-transparent"
        aria-hidden="true"
      />

      <div className="catalog-campaign-content relative z-10 max-w-[680px] px-6 py-8 sm:px-10 sm:py-12">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-xs px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-200 border border-white/15 mb-3">
          <Sparkles size={12} className="text-accent" />
          <span>Special Highlight</span>
        </div>

        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
          {banner.title}
        </h2>

        {banner.description && (
          <p className="text-sm sm:text-base text-white/90 leading-relaxed mb-4 max-w-[540px]">
            {banner.description}
          </p>
        )}

        {banner.cta_text && banner.cta_url && (
          <a
            href={banner.cta_url}
            className="catalog-campaign-cta inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs sm:text-sm font-bold text-navy hover:bg-[#ff803c] transition-all duration-150 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <span>{banner.cta_text}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
