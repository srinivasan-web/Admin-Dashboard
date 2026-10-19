import { useMemo, useState } from "react";
import { ArrowLeft, PencilLine, Plus, RotateCcw } from "lucide-react";
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
      <section className="card">
        <FilterBar>
          <input
            aria-label="Search HSN codes"
            placeholder="Search title, HSN code, or type"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Filter HSN codes by type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All types</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="secondary"
            onClick={() => {
              setQuery("");
              setType("all");
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
        </FilterBar>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>HSN Code</th>
                <th>Type</th>
                <th>SGST</th>
                <th>IGST</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>{item.hsn_code || "—"}</td>
                  <td>{item.type || "—"}</td>
                  <td>
                    {item.sgst_tax_multiplier === null
                      ? "—"
                      : `${item.sgst_tax_multiplier}%`}
                  </td>
                  <td>
                    {item.igst_tax_multiplier === null
                      ? "—"
                      : `${item.igst_tax_multiplier}%`}
                  </td>
                  <td className="table-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.title}`}
                      title={`Edit ${item.title}`}
                      onClick={() => onRouteChange("edit", item.id)}
                    >
                      <PencilLine size={15} aria-hidden="true" />
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
