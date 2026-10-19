import { useEffect, useState } from "react";
import { motion, useIsPresent } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "../../app/navigation";
import type { PublicBanner } from "../../api/catalog";

export function HeroSlide({
  banner,
  index,
  count,
  direction,
  reduceMotion,
}: {
  banner: PublicBanner;
  index: number;
  count: number;
  direction: number;
  reduceMotion: boolean;
}) {
  const present = useIsPresent();
  const [mobileFailed, setMobileFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setMobileFailed(false);
    setImageFailed(false);
  }, [banner.desktop_image_url, banner.mobile_image_url]);

  function handleImageError() {
    if (
      !mobileFailed &&
      banner.mobile_image_url &&
      window.matchMedia("(max-width: 640px)").matches
    ) {
      setMobileFailed(true);
    } else {
      setImageFailed(true);
    }
  }

  return (
    <motion.div
      className="hero-slide"
      custom={{ direction, reduceMotion }}
      variants={{
        enter: ({
          direction,
          reduceMotion,
        }: {
          direction: number;
          reduceMotion: boolean;
        }) => ({
          opacity: reduceMotion ? 1 : 0,
          x: reduceMotion ? 0 : `${direction * 4}%`,
        }),
        active: { opacity: 1, x: 0 },
        exit: ({
          direction,
          reduceMotion,
        }: {
          direction: number;
          reduceMotion: boolean;
        }) => ({ opacity: 0, x: reduceMotion ? 0 : `${direction * -4}%` }),
      }}
      initial="enter"
      animate="active"
      exit="exit"
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      aria-hidden={!present}
      inert={!present}
      style={{
        pointerEvents: present ? "auto" : "none",
        zIndex: present ? 1 : 0,
      }}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}: ${banner.title}`}
    >
      {!imageFailed && (
        <picture
          key={mobileFailed ? "desktop-fallback" : "responsive"}
          className="hero-slide-picture"
        >
          {banner.mobile_image_url && !mobileFailed && (
            <source
              media="(max-width: 640px)"
              srcSet={banner.mobile_image_url}
            />
          )}
          <img
            src={banner.desktop_image_url}
            alt=""
            onError={handleImageError}
            fetchPriority={index === 0 ? "high" : "auto"}
          />
        </picture>
      )}
      <div className="hero-slide-shade" aria-hidden="true" />
      <div className="hero-slide-copy">
        <h1>{banner.title}</h1>
        {banner.description && <p>{banner.description}</p>}
        {banner.cta_url && (
          <Link className="hero-slide-cta" href={banner.cta_url}>
            {banner.cta_text || "Explore more"}
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        )}
      </div>
  
    </motion.div>
  );
}
