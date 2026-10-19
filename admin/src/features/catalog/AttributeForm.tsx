import { useState, type FormEvent, type ReactNode } from "react";
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
    setFields((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
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

  const inputClass =
    "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50";
  const field = (
    key: keyof AttributeFields,
    label: string,
    input: ReactNode,
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5" key={key}>
      <label
        htmlFor={`attribute-${key}`}
        className="text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {input}
      {errors[key] && (
        <p role="alert" className="text-xs text-red-600">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div>
        <h3 className="m-0 text-base font-semibold text-slate-900">
          {selected ? "Edit attribute" : "Add attribute"}
        </h3>
      
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "name",
          "Name *",
          <input
            id="attribute-name"
            className={inputClass}
            value={fields.name}
            maxLength={255}
            required
            onChange={(event) => change("name", event.target.value)}
            disabled={saving}
          />,
        )}
        {field(
          "slug",
          "Slug (optional)",
          <input
            id="attribute-slug"
            className={inputClass}
            value={fields.slug}
            maxLength={255}
            placeholder="Generated from name when blank"
            onChange={(event) => change("slug", event.target.value)}
            disabled={saving}
          />,
        )}
        {field(
          "data_type",
          "Data type *",
          <select
            id="attribute-data_type"
            className={inputClass}
            value={fields.data_type}
            required
            onChange={(event) => change("data_type", event.target.value)}
            disabled={saving}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean (true / false)</option>
            {selected &&
              !["text", "number", "boolean"].includes(selected.data_type) && (
                <option value={selected.data_type}>
                  {selected.data_type} (existing legacy type)
                </option>
              )}
          </select>,
        )}
        {field(
          "unit",
          "Unit (optional)",
          <input
            id="attribute-unit"
            className={inputClass}
            value={fields.unit}
            maxLength={50}
            placeholder="e.g. kg"
            onChange={(event) => change("unit", event.target.value)}
            disabled={saving}
          />,
        )}
        {field(
          "icon",
          "Icon (optional)",
          <input
            id="attribute-icon"
            className={inputClass}
            value={fields.icon}
            maxLength={255}
            onChange={(event) => change("icon", event.target.value)}
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
            className={inputClass}
            value={fields.sort_order}
            onChange={(event) => change("sort_order", event.target.value)}
            disabled={saving}
          />,
        )}
      </div>
      {field(
        "description",
        "Description (optional)",
        <textarea
          id="attribute-description"
          className={`${inputClass} min-h-24 py-3`}
          value={fields.description}
          onChange={(event) => change("description", event.target.value)}
          disabled={saving}
        />,
      )}
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={fields.is_filterable}
            onChange={(event) => change("is_filterable", event.target.checked)}
            disabled={saving}
          />{" "}
          Filterable
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={fields.is_active}
            onChange={(event) => change("is_active", event.target.checked)}
            disabled={saving}
          />{" "}
          Active
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          className="secondary"
          onClick={cancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : selected ? "Save changes" : "Add attribute"}
        </button>
      </div>
    </form>
  );
}
