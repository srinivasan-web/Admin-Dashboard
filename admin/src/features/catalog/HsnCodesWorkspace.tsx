import { useMemo, useState } from "react";
import { ArrowLeft, PencilLine, Plus, RotateCcw, Search } from "lucide-react";
import { FilterBar } from "../../components/ui";
import { HsnCodeForm } from "./HsnCodeForm";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { HsnCode } from "./types";
import type { CatalogRouteMode, CatalogRouteState } from "../../app/routes";

type Props = {
  hsnCodes: HsnCode[];
  notice?: string;
  onSaved: () => void;
  route: CatalogRouteState;
  onRouteChange: (mode: CatalogRouteMode, recordId?: string) => void;
};

export function HsnCodesWorkspace({ hsnCodes, notice, onSaved, route, onRouteChange }: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const editing = route.mode === "edit"
    ? hsnCodes.find((item) => item.id === route.recordId)
    : undefined;
  const creating = route.mode === "create";
  const types = useMemo(
    () =>
      [
        ...new Set(
          hsnCodes
            .map((item) => item.type)
            .filter((item): item is string => Boolean(item)),
        ),
      ].sort(),
    [hsnCodes],
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return hsnCodes.filter((item) => {
      const matchesSearch = [item.title, item.hsn_code, item.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
      return matchesSearch && (type === "all" || item.type === type);
    });
  }, [hsnCodes, query, type]);

  function closeForm() {
    onRouteChange("list");
  }

  if (route.mode === "edit" && !editing)
    return <section className="workspace-form" role="alert">
      <p className="error">HSN code not found or no longer available.</p>
      <button className="secondary" onClick={closeForm}>Back to HSN Codes</button>
    </section>;
  if (creating || editing) {
    return (
      <section className="workspace-form w-full space-y-6">
        <ProductManagementHeader
          title={editing ? "Edit HSN Code" : "Add HSN Code"}
        
          breadcrumb={[
            "Product Management",
            "HSN Codes",
            editing ? "Edit HSN Code" : "Add HSN Code",
          ]}
          actions={
            <button
              className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold leading-[20px] text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer"
              type="button"
              onClick={closeForm}
            >
              <ArrowLeft size={16} className="text-slate-500" />
              <span>HSN Codes</span>
            </button>
          }
        />
        <HsnCodeForm
          key={editing?.id ?? "create"}
          selected={editing}
          onSaved={() => {
            closeForm();
            onSaved();
          }}
          onCancel={closeForm}
        />
      </section>
    );
  }

  return (
    <section className="workspace-list">
      <ProductManagementHeader
        title="HSN Codes"
        breadcrumb={["Product Management", "HSN Codes"]}
        actions={
          <button className="add-new-btn" onClick={() => onRouteChange("create")}>
            <Plus size={16} /> Add New
          </button>
        }
      />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="card w-full max-w-full">
        <FilterBar className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              aria-label="Search HSN codes"
              placeholder="Search title, HSN code, or type…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="!w-full !rounded-xl !border-slate-200 !bg-white !pl-9.5 !pr-3 !py-2 !text-xs !shadow-2xs focus:!border-orange-500 focus:!ring-2 focus:!ring-orange-500/20 transition"
            />
          </div>
          <select
            aria-label="Filter HSN codes by type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="!h-9 !rounded-xl !border-slate-200 !bg-white !px-3 !py-1.5 !text-xs !font-medium !text-slate-700 !shadow-2xs cursor-pointer"
          >
            <option value="all">All types</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="secondary !h-9 !rounded-xl !border-slate-200 !bg-white !px-3.5 !text-xs !font-medium !text-slate-700 !shadow-2xs hover:!bg-slate-50 cursor-pointer"
            onClick={() => {
              setQuery("");
              setType("all");
            }}
            type="button"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </FilterBar>
        <div className="table-scroll overflow-hidden rounded-2xl border border-slate-200/90 shadow-2xs bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 min-w-[200px]">Title</th>
                <th className="px-4 py-3.5 w-36">HSN Code</th>
                <th className="px-4 py-3.5 w-32">Type</th>
                <th className="px-4 py-3.5 w-24 text-center">SGST</th>
                <th className="px-4 py-3.5 w-24 text-center">IGST</th>
                <th className="px-4 py-3.5 text-right w-20" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <strong className="block font-semibold text-slate-900 text-sm leading-snug">
                      {item.title}
                    </strong>
                  </td>
                  <td className="px-4 py-3">
                    {item.hsn_code ? (
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 font-semibold">
                        {item.hsn_code}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                      {item.type || "General"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono font-medium text-slate-700">
                      {item.sgst_tax_multiplier === null
                        ? "—"
                        : `${item.sgst_tax_multiplier}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono font-medium text-slate-700">
                      {item.igst_tax_multiplier === null
                        ? "—"
                        : `${item.igst_tax_multiplier}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="icon-button spec-action-btn"
                      aria-label={`Edit ${item.title}`}
                      title={`Edit ${item.title}`}
                      onClick={() => onRouteChange("edit", item.id)}
                    >
                      <PencilLine size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="empty-state">
            {hsnCodes.length === 0
              ? "No HSN codes yet. Add one to begin."
              : "No HSN codes match the current filters."}
          </p>
        )}
        <p className="record-count">
          {filtered.length} of {hsnCodes.length} records shown.
        </p>
      </section>
    </section>
  );
}
