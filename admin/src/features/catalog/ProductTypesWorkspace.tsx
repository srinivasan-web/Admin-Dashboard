import { useMemo, useState } from "react";
import { ArrowLeft, PencilLine, Plus, Power, RotateCcw, Search, Tag } from "lucide-react";
import { errorMessage } from "../../api/client";
import { saveMaster } from "./catalogApi";
import { MasterForm } from "./MasterForm";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { Master } from "./types";
import { FilterBar, StatusBadge } from "../../components/ui";
import type { CatalogRouteMode, CatalogRouteState } from "../../app/routes";

export function ProductTypesWorkspace({
  productTypes,
  notice,
  onSaved,
  route,
  onRouteChange,
}: {
  productTypes: Master[];
  notice?: string;
  onSaved: () => void;
  route: CatalogRouteState;
  onRouteChange: (mode: CatalogRouteMode, recordId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const editing = route.mode === "edit"
    ? productTypes.find((item) => item.id === route.recordId)
    : undefined;
  const creating = route.mode === "create";
  const [error, setError] = useState<string>();
  const [updatingId, setUpdatingId] = useState<string>();
  const filtered = useMemo(
    () =>
      productTypes.filter(
        (item) =>
          item.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (status === "all" ||
            (status === "active" && item.is_active) ||
            (status === "inactive" && !item.is_active)),
      ),
    [productTypes, query, status],
  );

  async function toggleStatus(item: Master) {
    setError(undefined);
    setUpdatingId(item.id);
    try {
      await saveMaster(
        "product-types",
        {
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
          image_media_id: item.image_media_id ?? null,
          sort_order: item.sort_order ?? 0,
          is_active: !item.is_active,
        },
        item.id,
      );
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUpdatingId(undefined);
    }
  }
  function resetFilters() {
    setQuery("");
    setStatus("all");
  }
  if (route.mode === "edit" && !editing)
    return <section className="workspace-form" role="alert">
      <p className="error">Product type not found or no longer available.</p>
      <button className="secondary" onClick={() => onRouteChange("list")}>Back to Product Types</button>
    </section>;
  if (creating || editing)
    return (
      <section className="workspace-form w-full space-y-6">
        <ProductManagementHeader
          title={editing ? "Edit Product Type" : "Add Product Type"}
      
          breadcrumb={[
            "Product Management",
            "Product Types",
            editing ? "Edit Product Type" : "Add Product Type",
          ]}
          showBreadcrumb
          actions={
            <button
              className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold leading-[20px] text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer"
              type="button"
              onClick={() => {
                onRouteChange("list");
              }}
            >
              <ArrowLeft size={16} className="text-slate-500" />
              <span>Product Types</span>
            </button>
          }
        />
        <MasterForm
          key={editing?.id ?? "create"}
          path="product-types"
          title="Product Type"
          selected={editing}
          onSaved={() => {
            onRouteChange("list");
            onSaved();
          }}
          onCancel={() => onRouteChange("list")}
        />
      </section>
    );
  return (
    <section className="workspace-list">
      <ProductManagementHeader
        title="Product Types"
        description=""
        breadcrumb={["Product Management", "Product Types"]}
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
      {error && (
        <p className="error" role="alert">
          {error}
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
              aria-label="Search product types"
              placeholder="Search product types by name, slug or description…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="!w-full !rounded-xl !border-slate-200 !bg-white !pl-9.5 !pr-3 !py-2 !text-xs !shadow-2xs focus:!border-orange-500 focus:!ring-2 focus:!ring-orange-500/20 transition"
            />
          </div>
          <select
            aria-label="Filter product types by status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="!h-9 !rounded-xl !border-slate-200 !bg-white !px-3 !py-1.5 !text-xs !font-medium !text-slate-700 !shadow-2xs cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            className="secondary !h-9 !rounded-xl !border-slate-200 !bg-white !px-3.5 !text-xs !font-medium !text-slate-700 !shadow-2xs hover:!bg-slate-50 cursor-pointer"
            onClick={resetFilters}
            type="button"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </FilterBar>
        <div className="table-scroll overflow-hidden rounded-2xl border border-slate-200/90 shadow-2xs bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-16">Image</th>
                <th className="px-4 py-3.5 min-w-[160px]">Name</th>
                <th className="px-4 py-3.5 w-36">Slug</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5 w-28">Status</th>
                <th className="px-4 py-3.5 text-right w-24" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {filtered.map((item) => {
                const hasValidDescription =
                  item.description &&
                  item.description.trim() !== "" &&
                  item.description.trim().toUpperCase() !== "N/A" &&
                  item.description.trim() !== "—";

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex size-11 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 p-1 shadow-2xs shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            loading="lazy"
                            className="size-full object-contain"
                          />
                        ) : (
                          <Tag size={16} className="text-slate-300" aria-hidden="true" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <strong className="block font-semibold text-slate-900 text-sm leading-snug">
                        {item.name}
                      </strong>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                        {item.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-md lg:max-w-xl">
                      {hasValidDescription ? (
                        <p
                          className="line-clamp-2 text-xs text-slate-600 leading-relaxed m-0"
                          title={item.description ?? undefined}
                        >
                          {item.description}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={Boolean(item.is_active)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          className="icon-button spec-action-btn"
                          aria-label={`Edit ${item.name}`}
                          title={`Edit ${item.name}`}
                          onClick={() => onRouteChange("edit", item.id)}
                        >
                          <PencilLine size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          className="icon-button spec-action-btn"
                          aria-label={
                            updatingId === item.id
                              ? "Saving status"
                              : item.is_active
                                ? `Deactivate ${item.name}`
                                : `Activate ${item.name}`
                          }
                          title={
                            item.is_active
                              ? `Deactivate ${item.name}`
                              : `Activate ${item.name}`
                          }
                          disabled={updatingId === item.id}
                          onClick={() => void toggleStatus(item)}
                        >
                          <Power
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                            className={item.is_active ? "power-on" : "power-off"}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="empty-state">
            {productTypes.length === 0
              ? "No product types yet. Add one to begin."
              : "No product types match the current filters."}
          </p>
        )}
        <p className="record-count">
          {filtered.length} of {productTypes.length} records shown.
        </p>
      </section>
    </section>
  );
}
