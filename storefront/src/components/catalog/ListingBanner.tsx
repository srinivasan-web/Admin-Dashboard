import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { PublicBanner } from "../../api/catalog";

export function ListingBanner({ banner }: { banner: PublicBanner }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) return null;

  return (
    <section className="catalog-campaign" aria-label={banner.title}>
      <picture className="catalog-campaign-image">
        {banner.mobile_image_url && (
          <source media="(max-width: 640px)" srcSet={banner.mobile_image_url} />
        )}
        <img
          src={banner.desktop_image_url}
          alt=""
          loading="eager"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      </picture>
      <div className="catalog-campaign-shade" aria-hidden="true" />
      <div className="catalog-campaign-content">
        <h2>{banner.title}</h2>
        {banner.description && <p>{banner.description}</p>}
        {banner.cta_text && banner.cta_url && (
          <a href={banner.cta_url} className="catalog-campaign-cta">
            {banner.cta_text} <ArrowRight size={17} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
