import { useEffect, useMemo, useState } from "react";
import { apiRequest, errorMessage } from "../../api/client";
import { loadAttributes } from "./catalogApi";
import type { CatalogAttribute } from "./types";

type ComparisonRow = {
  attribute_id: string;
  label: string | null;
  sort_order: number;
  is_active: boolean;
};
type EditedRow = { selected: boolean; label: string; sort_order: number };

export function CategoryComparisonPanel({ categoryId }: { categoryId: string }) {
  const [attributes, setAttributes] = useState<CatalogAttribute[]>([]);
  const [rows, setRows] = useState<Record<string, EditedRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    void Promise.all([
      loadAttributes(),
      apiRequest<{ data: ComparisonRow[] }>(`/categories/${categoryId}/comparison-specifications`),
    ]).then(([definitions, configuration]) => {
      if (!active) return;
      setAttributes(definitions.data.filter((attribute) => attribute.is_active));
      setRows(Object.fromEntries(configuration.data.map((row) => [row.attribute_id, {
        selected: row.is_active,
        label: row.label ?? "",
        sort_order: row.sort_order,
      }])));
    }).catch((reason) => {
      if (active) setError(errorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [categoryId]);

  const selectedCount = useMemo(() => Object.values(rows).filter((row) => row.selected).length, [rows]);

  function edit(id: string, change: Partial<EditedRow>) {
    setRows((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { selected: false, label: "", sort_order: 0 }), ...change },
    }));
    setNotice(undefined);
  }

  async function save() {
    if (selectedCount > 24) {
      setError("Choose no more than 24 comparison rows.");
      return;
    }
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const specifications = attributes
        .filter((attribute) => rows[attribute.id]?.selected)
        .map((attribute) => ({
          attribute_id: attribute.id,
          label: rows[attribute.id].label.trim() || null,
          sort_order: rows[attribute.id].sort_order,
        }));
      await apiRequest(`/categories/${categoryId}/comparison-specifications`, "PUT", { specifications });
      setNotice("Comparison settings saved. The storefront shows these rows when at least two eligible products are available.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="category-comparison-title">
    <h2 id="category-comparison-title" className="m-0 text-lg font-semibold text-slate-900">Product comparison</h2>
    <p className="mt-1 text-sm text-slate-500">Choose the specifications customers can compare for products in this category. Values come from each product’s saved attributes; blank values appear as “Not provided”.</p>
    {loading ? <p className="mt-4 text-sm text-slate-500">Loading comparison settings…</p> : <>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-4 text-sm text-green-700" role="status">{notice}</p>}
      {attributes.length === 0 ? <p className="mt-4 text-sm text-slate-500">No active attributes are available. Create an attribute before configuring comparison.</p> : <>
        <div className="mt-5 max-h-[32rem] overflow-y-auto rounded-xl border border-slate-200">
          {attributes.map((attribute) => {
            const row = rows[attribute.id];
            return <div key={attribute.id} className="grid gap-3 border-b border-slate-100 p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px] sm:items-center">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input type="checkbox" checked={Boolean(row?.selected)} onChange={(event) => edit(attribute.id, { selected: event.target.checked })} />
                <span>{attribute.name}{attribute.unit ? ` (${attribute.unit})` : ""}</span>
              </label>
              <input aria-label={`Comparison label for ${attribute.name}`} placeholder="Optional customer-facing label" maxLength={120} disabled={!row?.selected} value={row?.label ?? ""} onChange={(event) => edit(attribute.id, { label: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50" />
              <input aria-label={`Order for ${attribute.name}`} type="number" min={0} max={4294967295} disabled={!row?.selected} value={row?.sort_order ?? 0} onChange={(event) => edit(attribute.id, { sort_order: Number(event.target.value) || 0 })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50" />
            </div>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{selectedCount} of 24 comparison rows selected</span>
          <button type="button" className="add-new-btn" disabled={saving || selectedCount > 24} onClick={() => void save()}>{saving ? "Saving…" : "Save comparison"}</button>
        </div>
      </>}
    </>}
  </section>;
}
