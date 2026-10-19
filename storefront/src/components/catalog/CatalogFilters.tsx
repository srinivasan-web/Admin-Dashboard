import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { CatalogFilter } from "../../api/catalog";

export function CatalogFilters({
  filters,
  selectedValues,
  minPrice,
  maxPrice,
  activeCount,
  open,
  error,
  onClose,
  onRetry,
  onValueToggle,
  onPriceApply,
  onClear,
}: {
  filters?: CatalogFilter[];
  selectedValues: Record<string, string[]>;
  minPrice: string;
  maxPrice: string;
  activeCount: number;
  open: boolean;
  error?: Error;
  onClose: () => void;
  onRetry: () => void;
  onValueToggle: (id: string, value: string) => void;
  onPriceApply: (min: string, max: string) => void;
  onClear: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [priceError, setPriceError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open, onClose]);

  function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const min = String(form.get("min_price") ?? "").trim();
    const max = String(form.get("max_price") ?? "").trim();
    if (min && max && Number(min) > Number(max)) {
      setPriceError("Minimum price must be no more than maximum price.");
      return;
    }
    setPriceError(undefined);
    onPriceApply(min, max);
  }

  return (
    <>
      {open && <button className="catalog-filter-backdrop" aria-label="Close filters" onClick={onClose} />}
      <aside
        ref={panelRef}
        className={`catalog-filter-panel${open ? " is-open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={titleId}
      >
        <div className="catalog-filter-head">
          <div>
            <h2 id={titleId}>Filters</h2>
            <p>Refine available equipment</p>
          </div>
          <button ref={closeRef} className="catalog-filter-close" type="button" onClick={onClose} aria-label="Close filters">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <form className="catalog-price-filter" onSubmit={submitPrice}>
          <fieldset>
            <legend>Price (₹)</legend>
            <div className="catalog-price-fields">
              <label>
                <span>Minimum</span>
                <input name="min_price" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" defaultValue={minPrice} placeholder="0" />
              </label>
              <label>
                <span>Maximum</span>
                <input name="max_price" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" defaultValue={maxPrice} placeholder="Any" />
              </label>
            </div>
            {priceError && <p className="catalog-price-error" role="alert">{priceError}</p>}
            <button className="catalog-price-apply" type="submit">Apply price</button>
          </fieldset>
        </form>
        {filters?.map((filter) => (
          <fieldset className="catalog-attribute-filter" key={filter.id}>
            <legend>{filter.name}{filter.unit ? ` (${filter.unit})` : ""}</legend>
            <div className="catalog-attribute-values">
              {filter.values.map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={(selectedValues[filter.id] ?? []).includes(value)}
                    onChange={() => onValueToggle(filter.id, value)}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {!filters && !error && <p className="catalog-filter-note">Loading specifications…</p>}
        {error && (
          <p className="catalog-filter-note" role="alert">
            Specifications couldn’t load. <button type="button" onClick={onRetry}>Retry</button>
          </p>
        )}
        {filters?.length === 0 && !error && <p className="catalog-filter-note">No specification filters for this selection.</p>}
        {activeCount > 0 && (
          <button className="catalog-filter-clear" type="button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </aside>
    </>
  );
}
