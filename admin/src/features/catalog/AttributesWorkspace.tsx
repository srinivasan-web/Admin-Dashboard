import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Filter,
  RotateCcw,
  Power,
  Minus,
  Type,
  Hash,
  ToggleLeft,
  Tag,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import { toast } from "../../components/ui/Toast";
import { loadAttributes, saveAttribute } from "./catalogApi";
import { AttributeForm } from "./AttributeForm";
import type { CatalogAttribute } from "./types";
import { getAttributeVisual } from "./attributeVisuals";

function getDataTypeBadge(type: string, unit?: string | null) {
  let icon = <Type size={12} className="text-slate-400" aria-hidden="true" />;
  if (type === "number") icon = <Hash size={12} className="text-slate-400" aria-hidden="true" />;
  if (type === "boolean") icon = <ToggleLeft size={12} className="text-slate-400" aria-hidden="true" />;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs">
      {icon}
      <span>{type}</span>
      {unit && (
        <span className="font-semibold text-slate-900 font-mono">
          · {unit}
        </span>
      )}
    </div>
  );
}

export function AttributesWorkspace({
  onChanged,
  onClose,
}: {
  onChanged: () => void;
  onClose: () => void;
}) {
  const [attributes, setAttributes] = useState<CatalogAttribute[]>();
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<CatalogAttribute>();
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>();
  const [visible, setVisible] = useState(false);

  /* Animate in on mount */
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function closeWithAnimation() {
    if (
      (!creating && !editing) ||
      window.confirm(
        "Close the attribute editor? Unsaved attribute changes will be lost.",
      )
    ) {
      setVisible(false);
      setTimeout(onClose, 320);
    }
  }

  /* Trap Escape key */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeWithAnimation();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating, editing]);

  useEffect(() => {
    let active = true;
    setLoadError(undefined);
    void loadAttributes()
      .then((response) => {
        if (active) setAttributes(response.data);
      })
      .catch((reason) => {
        if (active) setLoadError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (attributes ?? []).filter(
      (attribute) =>
        (!search ||
          `${attribute.name} ${attribute.slug} ${attribute.unit ?? ""}`
            .toLowerCase()
            .includes(search)) &&
        (status === "all" ||
          (status === "active" ? attribute.is_active : !attribute.is_active)),
    );
  }, [attributes, query, status]);

  function saved() {
    setEditing(undefined);
    setCreating(false);
    setNotice("Attribute saved successfully.");
    toast.success("Attribute saved successfully.");
    setRevision((v) => v + 1);
    onChanged();
  }

  async function toggleStatus(attribute: CatalogAttribute) {
    setActionError(undefined);
    setUpdatingId(attribute.id);
    try {
      await saveAttribute(
        {
          name: attribute.name,
          slug: attribute.slug,
          icon: attribute.icon,
          description: attribute.description,
          data_type: attribute.data_type,
          unit: attribute.unit,
          is_filterable: attribute.is_filterable,
          is_active: !attribute.is_active,
          sort_order: attribute.sort_order,
        },
        attribute.id,
      );
      const msg = `Attribute ${attribute.is_active ? "deactivated" : "activated"}.`;
      setNotice(msg);
      toast.success(msg);
      setRevision((v) => v + 1);
      onChanged();
    } catch (reason) {
      const err = errorMessage(reason);
      setActionError(err);
      toast.error(err);
    } finally {
      setUpdatingId(undefined);
    }
  }

  const isFormOpen = creating || !!editing;
  const hasFilters = Boolean(query || status !== "all");

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeWithAnimation}
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Slide-over drawer */}
      <div
        id="attribute-library"
        role="dialog"
        aria-modal="true"
        aria-label="Attribute Library"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl md:max-w-3xl lg:max-w-4xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 border border-orange-100 shadow-2xs">
              <SlidersHorizontal
                size={18}
                className="text-orange-600"
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Attribute Library
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isFormOpen && (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setNotice(undefined);
                  setActionError(undefined);
                }}
                className="attr-btn-primary"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add attribute</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeWithAnimation}
              aria-label="Close attribute library"
              title="Close"
              className="attr-btn-icon"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Notices ── */}
        {notice && (
          <div
            role="status"
            className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800"
          >
            <CheckCircle2 size={15} className="shrink-0 text-emerald-500" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}
        {actionError && (
          <div
            role="alert"
            className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
          >
            <XCircle size={15} className="shrink-0 text-red-500" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isFormOpen ? (
            /* ── Add / Edit form ── */
            <div className="p-6">
              <AttributeForm
                key={editing?.id ?? "new"}
                selected={editing}
                onSaved={saved}
                onCancel={() => {
                  setCreating(false);
                  setEditing(undefined);
                }}
              />
            </div>
          ) : (
            /* ── List view ── */
            <div className="flex flex-col gap-0 p-6">

              {/* Filter bar: Single line responsive toolbar */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                {/* Search input with left icon and clear button */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    aria-label="Search attributes"
                    placeholder="Search name, slug or unit…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="attr-search-input"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Status select */}
                <select
                  aria-label="Filter attribute status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="attr-filter-select"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                {/* Reset button */}
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setStatus("all");
                    }}
                    className="attr-btn-action border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                )}

                {/* Refresh button with visible icon */}
                <button
                  type="button"
                  title="Refresh attributes"
                  aria-label="Refresh attributes"
                  onClick={() => setRevision((v) => v + 1)}
                  className="attr-btn-icon"
                >
                  <RefreshCw
                    size={15}
                    className={!attributes && !loadError ? "animate-spin text-orange-600" : "text-slate-600"}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {/* Load error */}
              {loadError && (
                <div
                  role="alert"
                  className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                >
                  <XCircle size={15} className="shrink-0" aria-hidden="true" />
                  <span className="flex-1">{loadError}</span>
                  <button
                    type="button"
                    onClick={() => setRevision((v) => v + 1)}
                    className="attr-btn-action border border-red-300 bg-white text-red-700 hover:bg-red-50"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading skeleton */}
              {!attributes && !loadError && (
                <div
                  role="status"
                  className="flex items-center justify-center gap-2.5 py-16 text-sm font-medium text-slate-500"
                >
                  <RefreshCw
                    size={16}
                    className="animate-spin text-orange-600"
                    aria-hidden="true"
                  />
                  <span>Loading attribute library…</span>
                </div>
              )}

              {/* Empty state */}
              {attributes && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    <Tag size={20} className="text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {attributes.length
                      ? "No matching attributes"
                      : "No attributes yet"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {attributes.length
                      ? "Try adjusting your search query or status filter."
                      : "Add an attribute to use it across product specifications."}
                  </p>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Attribute table with horizontal scroll protection */}
              {attributes && filtered.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3.5 text-left">
                          Name
                        </th>
                        <th className="px-4 py-3.5 text-left">
                          Type / Unit
                        </th>
                        <th className="px-4 py-3.5 text-left">
                          <span className="flex items-center gap-1.5">
                            <Filter size={12} aria-hidden="true" />
                            Filter
                          </span>
                        </th>
                        <th className="px-4 py-3.5 text-left">
                          Status
                        </th>
                        <th className="px-5 py-3.5 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((attribute) => {
                        const visual = getAttributeVisual(
                          attribute.name,
                          attribute.slug,
                          attribute.icon,
                        );

                        return (
                          <tr
                            key={attribute.id}
                            className="group transition-colors hover:bg-slate-50/60"
                          >
                            {/* Attribute Name with Icon Avatar */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${visual.bg} shadow-2xs transition group-hover:scale-105`}
                                >
                                  {visual.icon}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 leading-snug">
                                    {attribute.name}
                                  </p>
                                  <p className="font-mono text-xs text-slate-400">
                                    {attribute.slug}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Type / Unit with Icon */}
                            <td className="px-4 py-3.5">
                              {getDataTypeBadge(attribute.data_type, attribute.unit)}
                            </td>

                            {/* Filter column */}
                            <td className="px-4 py-3.5">
                              {attribute.is_filterable ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 size={15} className="text-emerald-500" aria-hidden="true" />
                                  <span>Yes</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                                  <Minus size={14} className="text-slate-300" aria-hidden="true" />
                                  <span>No</span>
                                </span>
                              )}
                            </td>

                            {/* Status with green pulsating dot */}
                            <td className="px-4 py-3.5">
                              {attribute.is_active ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-emerald-700 uppercase">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                                  Inactive
                                </span>
                              )}
                            </td>

                            {/* Actions with clear icons */}
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  title={`Edit ${attribute.name}`}
                                  onClick={() => {
                                    setEditing(attribute);
                                    setNotice(undefined);
                                    setActionError(undefined);
                                  }}
                                  className="attr-btn-action border border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 shadow-2xs"
                                >
                                  <Pencil size={13} className="text-slate-500" aria-hidden="true" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingId === attribute.id}
                                  title={
                                    attribute.is_active
                                      ? `Deactivate ${attribute.name}`
                                      : `Activate ${attribute.name}`
                                  }
                                  onClick={() => void toggleStatus(attribute)}
                                  className={`attr-btn-action shadow-2xs ${
                                    attribute.is_active
                                      ? "border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100"
                                      : "border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  {updatingId === attribute.id ? (
                                    <RefreshCw
                                      size={12}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : attribute.is_active ? (
                                    <Power size={13} aria-hidden="true" />
                                  ) : (
                                    <CheckCircle2 size={13} aria-hidden="true" />
                                  )}
                                  <span>
                                    {attribute.is_active ? "Deactivate" : "Activate"}
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer record count */}
              {attributes && filtered.length > 0 && (
                <p className="mt-3.5 text-xs text-slate-400">
                  {filtered.length} of {attributes.length} attributes shown
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
