import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "../../app/navigation";
import type { Category } from "../../api/catalog";

export function EquipmentMegaMenu({
  categories,
  categoryError,
  retryCategories,
}: {
  categories: Category[];
  categoryError?: Error;
  retryCategories: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected =
    categories.find((category) => category.id === selectedId) ?? categories[0];

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      className="equipment-nav"
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="equipment-trigger"
        aria-expanded={open}
        aria-controls="equipment-mega-menu"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() =>
              rootRef.current
                ?.querySelector<HTMLAnchorElement>("#equipment-mega-menu a")
                ?.focus(),
            );
          }
        }}
      >
        Shop by equipment{" "}
        <ChevronDown
          size={16}
          className={open ? "rotate-180" : ""}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="equipment-mega" id="equipment-mega-menu">
          <div className="equipment-mega-list">
            <span className="nav-overline">EXPLORE EQUIPMENT</span>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/equipment/${encodeURIComponent(category.slug)}`}
                className={selected?.id === category.id ? "is-selected" : ""}
                onMouseEnter={() => setSelectedId(category.id)}
                onFocus={() => setSelectedId(category.id)}
                onClick={() => setOpen(false)}
              >
                {category.name}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
            {!categories.length && (
              <p>
                {categoryError
                  ? "Categories couldn't be loaded."
                  : "Loading categories…"}
              </p>
            )}
            {categoryError && (
              <button
                type="button"
                className="equipment-retry"
                onClick={retryCategories}
              >
                Retry categories
              </button>
            )}
          </div>
          <div className="equipment-mega-feature">
            <span className="nav-overline">FIND YOUR NEXT MOVE</span>
            {selected ? (
              <>
                <h2>{selected.name}</h2>
                {selected.description && <p>{selected.description}</p>}
                <Link
                  href={`/equipment/${encodeURIComponent(selected.slug)}`}
                  onClick={() => setOpen(false)}
                >
                  Explore {selected.name}{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <h2>Explore equipment</h2>
                <p>Browse the complete catalogue.</p>
              </>
            )}
            <Link
              className="equipment-view-all"
              href="/products"
              onClick={() => setOpen(false)}
            >
              View all equipment <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
