import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { CatalogFilter } from "../../api/catalog";

type PricePreset = {
  label: string;
  min: string;
  max: string;
};

const PRICE_PRESETS: PricePreset[] = [
  { label: "Under ₹25k", min: "", max: "25000" },
  { label: "₹25k – ₹50k", min: "25000", max: "50000" },
  { label: "₹50k – ₹75k", min: "50000", max: "75000" },
  { label: "₹75k & Above", min: "75000", max: "" },
];

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

  // Local price input state for smooth typing & editing
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);
  const [priceError, setPriceError] = useState<string>();

  // Accordion collapsed states (default open for all)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Filter value search queries inside long specification groups
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalMin(minPrice);
    setLocalMax(maxPrice);
    setPriceError(undefined);
  }, [minPrice, maxPrice]);

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
    const minVal = localMin.trim();
    const maxVal = localMax.trim();
    if (minVal && maxVal && Number(minVal) > Number(maxVal)) {
      setPriceError("Min price cannot exceed Max price.");
      return;
    }
    setPriceError(undefined);
    onPriceApply(minVal, maxVal);
  }

  function applyPreset(preset: PricePreset) {
    setLocalMin(preset.min);
    setLocalMax(preset.max);
    setPriceError(undefined);
    onPriceApply(preset.min, preset.max);
  }

  function resetPrice() {
    setLocalMin("");
    setLocalMax("");
    setPriceError(undefined);
    onPriceApply("", "");
  }

  function toggleCollapse(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={panelRef}
        id="catalog-filters-sidebar"
        className={`catalog-filter-panel ${
          open
            ? "fixed inset-y-0 right-0 z-50 flex w-[min(380px,90vw)] flex-col bg-white shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:w-full lg:shadow-none"
            : "hidden lg:block lg:sticky lg:top-[90px] lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto"
        } rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm [scrollbar-width:thin]`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={titleId}
      >
        {/* Header Section */}
        <div className="catalog-filter-head flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-accent-deep">
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="text-[16px] font-bold text-navy tracking-tight">
                  Filters
                </h2>
                {activeCount > 0 && (
                  <span className="rounded-full bg-accent-deep px-2 py-0.5 text-[10px] font-bold text-white leading-none">
                    {activeCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Refine specifications</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-deep hover:text-[#a83d00] transition-colors"
                title="Clear all filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
              aria-label="Close filters"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          {/* Price Range Filter */}
          <div className="catalog-price-filter border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => toggleCollapse("price")}
                className="flex items-center justify-between w-full text-left font-bold text-[13px] text-navy hover:text-accent-deep transition-colors"
              >
                <span>Price (₹)</span>
                <ChevronDown
                  size={15}
                  className={`text-slate-400 transition-transform duration-200 ${
                    collapsed["price"] ? "-rotate-90" : ""
                  }`}
                />
              </button>
            </div>

            {!collapsed["price"] && (
              <div>
                {/* Price Quick Presets */}
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {PRICE_PRESETS.map((preset) => {
                    const isSelected =
                      minPrice === preset.min && maxPrice === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border text-left transition-all ${
                          isSelected
                            ? "bg-accent-deep text-white border-accent-deep shadow-2xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Min & Max Inputs */}
                <form onSubmit={submitPrice} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col text-[11px] text-slate-500 font-medium">
                      <span className="mb-1">Min (₹)</span>
                      <input
                        name="min_price"
                        type="number"
                        min="0"
                        max="9999999"
                        step="1"
                        inputMode="numeric"
                        value={localMin}
                        onChange={(e) => setLocalMin(e.target.value)}
                        placeholder="0"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-navy focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none font-tech"
                      />
                    </label>

                    <label className="flex flex-col text-[11px] text-slate-500 font-medium">
                      <span className="mb-1">Max (₹)</span>
                      <input
                        name="max_price"
                        type="number"
                        min="0"
                        max="9999999"
                        step="1"
                        inputMode="numeric"
                        value={localMax}
                        onChange={(e) => setLocalMax(e.target.value)}
                        placeholder="Any"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-navy focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none font-tech"
                      />
                    </label>
                  </div>

                  {priceError && (
                    <p className="text-[11px] text-red-600 font-medium mt-1" role="alert">
                      {priceError}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 h-9 rounded-lg bg-navy hover:bg-navy-soft active:scale-[0.98] text-white text-[12px] font-bold transition-all shadow-2xs"
                    >
                      Apply Price
                    </button>
                    {(minPrice || maxPrice) && (
                      <button
                        type="button"
                        onClick={resetPrice}
                        className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Dynamic Specifications */}
          {filters?.map((filter) => {
            const isCollapsed = Boolean(collapsed[filter.id]);
            const selectedList = selectedValues[filter.id] ?? [];
            const query = (filterSearch[filter.id] ?? "").toLowerCase().trim();
            const visibleValues = query
              ? filter.values.filter((v) => v.toLowerCase().includes(query))
              : filter.values;

            return (
              <fieldset
                key={filter.id}
                className="catalog-attribute-filter border-b border-slate-100 pb-5 last:border-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <legend className="sr-only">{filter.name}</legend>
                  <button
                    type="button"
                    onClick={() => toggleCollapse(filter.id)}
                    className="flex items-center justify-between w-full text-left font-bold text-[13px] text-navy hover:text-accent-deep transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>{filter.name}</span>
                      {filter.unit && (
                        <span className="text-[11px] font-normal text-slate-400">
                          ({filter.unit})
                        </span>
                      )}
                      {selectedList.length > 0 && (
                        <span className="rounded-full bg-orange-100 text-accent-deep px-1.5 py-0.2 text-[10px] font-bold">
                          {selectedList.length}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="space-y-1.5">
                    {/* Search inside filter values if > 5 options */}
                    {filter.values.length > 5 && (
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={filterSearch[filter.id] ?? ""}
                          onChange={(e) =>
                            setFilterSearch((prev) => ({
                              ...prev,
                              [filter.id]: e.target.value,
                            }))
                          }
                          placeholder={`Search ${filter.name}…`}
                          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/70 pl-7 pr-2.5 text-[11px] text-navy placeholder:text-slate-400 focus:bg-white focus:border-accent outline-none"
                        />
                        <Search
                          size={13}
                          className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none"
                        />
                      </div>
                    )}

                    {/* Values Checkbox List */}
                    <div className="catalog-attribute-values max-h-48 overflow-y-auto space-y-1 pr-1 [scrollbar-width:thin]">
                      {visibleValues.map((value) => {
                        const checked = selectedList.includes(value);
                        return (
                          <label
                            key={value}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[12px] cursor-pointer transition-colors ${
                              checked
                                ? "bg-orange-50/70 text-navy font-semibold"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onValueToggle(filter.id, value)}
                                className="size-4 rounded border-slate-300 text-accent-deep focus:ring-accent/20 cursor-pointer accent-[#ff6b1a]"
                              />
                              <span className="truncate">{value}</span>
                            </div>
                          </label>
                        );
                      })}

                      {visibleValues.length === 0 && (
                        <p className="text-[11px] text-slate-400 py-1 px-2">
                          No matching values.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}

          {!filters && !error && (
            <div className="space-y-3 py-2 animate-pulse">
              <div className="h-4 w-1/2 bg-slate-100 rounded" />
              <div className="h-8 w-full bg-slate-100 rounded-lg" />
              <div className="h-4 w-2/3 bg-slate-100 rounded" />
              <div className="h-8 w-full bg-slate-100 rounded-lg" />
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-[12px] text-red-700">
              <p className="mb-2">Filters couldn't load.</p>
              <button
                type="button"
                onClick={onRetry}
                className="font-bold underline hover:text-red-800"
              >
                Retry loading filters
              </button>
            </div>
          )}
        </div>

        {/* Mobile Sticky Bottom Action */}
        <div className="lg:hidden mt-auto pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-navy hover:bg-navy-soft active:scale-[0.98] text-white font-bold text-sm transition-all shadow-md"
          >
            Show Results {activeCount > 0 ? `(${activeCount} applied)` : ""}
          </button>
        </div>
      </aside>
    </>
  );
}
