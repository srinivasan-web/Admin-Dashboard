import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "../../app/navigation";

export type CategoryCardProps = {
  title: string;
  image?: string;
  href: string;
  index: number;
  cardIndex: number;
  featured?: boolean;
  filtered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function CategoryCard({
  title,
  image,
  href,
  index,
  cardIndex,
  featured = false,
  filtered = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: CategoryCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link
      href={href}
      aria-label={
        filtered ? `Explore ${title}` : `${title}: explore all equipment`
      }
      className={`group relative isolate flex h-[310px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl bg-navy text-white shadow-[0_4px_16px_rgba(7,26,43,0.08)] transition-[width,transform,box-shadow] duration-500 ease-out focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent-deep motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_12px_26px_rgba(7,26,43,0.15)] motion-reduce:transition-none lg:h-[360px] ${
        featured
          ? "w-[min(74vw,460px)] sm:w-[min(58vw,460px)]"
          : "w-[min(43vw,200px)] sm:w-[190px]"
      }`}
      data-testid="product-type-card"
      data-product-type-index={cardIndex}
      data-active={featured ? "true" : "false"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {image && !imageFailed && (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04] motion-reduce:transition-none"
          onError={() => setImageFailed(true)}
        />
      )}
      <span
        className="absolute inset-0 z-10 bg-linear-to-t from-navy/95 via-navy/28 to-navy/5"
        aria-hidden="true"
      />
      <span className="relative z-20 flex items-center gap-2 px-4 pb-2 font-tech text-xs font-bold tracking-[0.08em] text-accent sm:px-5">
        {String(index).padStart(2, "0")}
        <span className="h-px w-6 bg-accent" aria-hidden="true" />
      </span>
      <span className="relative z-20 flex items-end justify-between gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
        <span
          className={`font-display font-bold leading-[0.96] tracking-[-0.05em] ${
            featured ? "text-[clamp(1.7rem,3vw,2.2rem)]" : "text-xl"
          }`}
        >
          {title}
        </span>
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-accent text-accent transition-[background,color,transform] duration-200 group-hover:bg-accent group-hover:text-navy motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        >
          <ArrowRight size={20} strokeWidth={2.2} />
        </span>
      </span>
    </Link>
  );
}
