import { useState, type FormEvent, type ReactNode } from "react";
import {
  Tag,
  Hash,
  AlignLeft,
  SlidersHorizontal,
  Filter,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  Plus,
} from "lucide-react";
import { ApiError, errorMessage } from "../../api/client";
import { saveAttribute } from "./catalogApi";
import type { CatalogAttribute } from "./types";

type AttributeFields = {
  name: string;
  slug: string;
  icon: string;
  description: string;
  data_type: string;
  unit: string;
  is_filterable: boolean;
  is_active: boolean;
  sort_order: string;
};

function initialFields(selected?: CatalogAttribute): AttributeFields {
  return {
    name: selected?.name ?? "",
    slug: selected?.slug ?? "",
    icon: selected?.icon ?? "",
    description: selected?.description ?? "",
    data_type: selected?.data_type ?? "text",
    unit: selected?.unit ?? "",
    is_filterable: selected?.is_filterable ?? false,
    is_active: selected?.is_active ?? true,
    sort_order: String(selected?.sort_order ?? 0),
  };
}

export function AttributeForm({
  selected,
  onSaved,
  onCancel,
}: {
  selected?: CatalogAttribute;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState(() => initialFields(selected));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function change<K extends keyof AttributeFields>(
    key: K,
    value: AttributeFields[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setDirty(true);
  }

  function cancel() {
    if (!dirty || window.confirm("Discard unsaved attribute changes?"))
      onCancel();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fields.name.trim()) nextErrors.name = "Name is required.";
    if (!fields.data_type.trim())
      nextErrors.data_type = "Data type is required.";
    if (!/^\d+$/.test(fields.sort_order))
      nextErrors.sort_order = "Enter a non-negative whole number.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setError(undefined);
    try {
      await saveAttribute(
        {
          name: fields.name.trim(),
          slug: fields.slug.trim() || null,
          icon: fields.icon.trim() || null,
          description: fields.description.trim() || null,
          data_type: fields.data_type.trim(),
          unit: fields.unit.trim() || null,
          is_filterable: fields.is_filterable,
          is_active: fields.is_active,
          sort_order: Number(fields.sort_order),
        },
        selected?.id,
      );
      setDirty(false);
      onSaved();
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.status === 422 &&
        reason.details
      ) {
        setErrors(
          Object.fromEntries(
            Object.entries(reason.details).map(([key, messages]) => [
              key,
              messages[0] ?? "Invalid value.",
            ]),
          ),
        );
      } else {
        setError(errorMessage(reason));
      }
    } finally {
      setSaving(false);
    }
  }

  const input =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 transition";

  function field(
    key: keyof AttributeFields,
    label: string,
    element: ReactNode,
    hint?: string,
  ) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <label
          htmlFor={`attribute-${key}`}
          className="text-xs font-semibold text-slate-700"
        >
          {label}
        </label>
        {element}
        {hint && !errors[key] && (
          <p className="text-xs text-slate-400">{hint}</p>
        )}
        {errors[key] && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-0">
      {/* Form header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="attr-btn-icon"
          aria-label="Back to list"
          title="Back to list"
        >
          <ChevronLeft size={18} className="text-slate-600" aria-hidden="true" />
        </button>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {selected ? "Edit attribute" : "Add attribute"}
          </h3>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* ── Identity fields ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <Tag size={13} className="text-slate-500" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Identity
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {field(
            "name",
            "Name *",
            <input
              id="attribute-name"
              className={`${input} ${errors.name ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
              value={fields.name}
              maxLength={255}
              required
              autoFocus
              onChange={(e) => change("name", e.target.value)}
              disabled={saving}
            />,
          )}
          {field(
            "slug",
            "Slug (optional)",
            <input
              id="attribute-slug"
              className={input}
              value={fields.slug}
              maxLength={255}
              placeholder="Generated from name"
              onChange={(e) => change("slug", e.target.value)}
              disabled={saving}
            />,
          )}
        </div>
      </div>

      {/* ── Data type ── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <Hash size={13} className="text-slate-500" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Data type
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {field(
            "data_type",
            "Data type *",
            <select
              id="attribute-data_type"
              className={`${input} ${errors.data_type ? "border-red-300" : ""}`}
              value={fields.data_type}
              required
              onChange={(e) => change("data_type", e.target.value)}
              disabled={saving}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean (true / false)</option>
              {selected &&
                !["text", "number", "boolean"].includes(selected.data_type) && (
                  <option value={selected.data_type}>
                    {selected.data_type} (existing)
                  </option>
                )}
            </select>,
          )}
          {field(
            "unit",
            "Unit (optional)",
            <input
              id="attribute-unit"
              className={input}
              value={fields.unit}
              maxLength={50}
              placeholder="e.g. kg, km/h, W"
              onChange={(e) => change("unit", e.target.value)}
              disabled={saving}
            />,
          )}
          {field(
            "icon",
            "Icon (optional)",
            <input
              id="attribute-icon"
              className={input}
              value={fields.icon}
              maxLength={255}
              placeholder="Icon name or class"
              onChange={(e) => change("icon", e.target.value)}
              disabled={saving}
            />,
          )}
          {field(
            "sort_order",
            "Sort order",
            <input
              id="attribute-sort_order"
              type="number"
              min="0"
              step="1"
              className={`${input} ${errors.sort_order ? "border-red-300" : ""}`}
              value={fields.sort_order}
              onChange={(e) => change("sort_order", e.target.value)}
              disabled={saving}
            />,
          )}
        </div>
      </div>

    
      {/* ── Flags ── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <SlidersHorizontal
            size={13}
            className="text-slate-500"
            aria-hidden="true"
          />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Behaviour
          </span>
        </div>
        <div className="flex flex-wrap gap-4 p-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/30">
            <input
              type="checkbox"
              checked={fields.is_filterable}
              onChange={(e) => change("is_filterable", e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-200"
            />
            <div>
              <p className="text-xs font-semibold text-slate-800">Filterable</p>
            </div>
            <Filter size={14} className="ml-auto text-slate-400" />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
            <input
              type="checkbox"
              checked={fields.is_active}
              onChange={(e) => change("is_active", e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
            />
            <div>
              <p className="text-xs font-semibold text-slate-800">Active</p>
            </div>
            <CheckCircle2 size={14} className="ml-auto text-slate-400" />
          </label>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="attr-btn-action border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="attr-btn-primary"
        >
          {saving ? (
            <>
              <RefreshCw
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />
              <span>Saving…</span>
            </>
          ) : selected ? (
            <>
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>Save changes</span>
            </>
          ) : (
            <>
              <Plus size={15} aria-hidden="true" />
              <span>Add attribute</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
