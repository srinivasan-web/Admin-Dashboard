import { useMemo, useState } from "react";
import { ArrowLeft, PencilLine, Plus, Power, RotateCcw } from "lucide-react";
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
      <section className="card">
        <FilterBar>
          <input
            aria-label="Search product types"
            placeholder="Search product types"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Filter product types by status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="secondary" onClick={resetFilters}>
            <RotateCcw size={16} /> Reset
          </button>
        </FilterBar>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.image_url ? <img src={item.image_url} alt="" loading="lazy" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" /> : "—"}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.slug}</td>
                  <td>{item.description || "—"}</td>
                  <td>
                    <StatusBadge active={Boolean(item.is_active)} />
                  </td>
                  <td className="table-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => onRouteChange("edit", item.id)}
                    >
                      <PencilLine size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={
                        updatingId === item.id
                          ? "Saving status"
                          : item.is_active
                            ? `Deactivate ${item.name}`
                            : `Activate ${item.name}`
                      }
                      disabled={updatingId === item.id}
                      onClick={() => void toggleStatus(item)}
                    >
                      <Power
                        size={15}
                        aria-hidden="true"
                        className={item.is_active ? "power-on" : "power-off"}
                      />
                    </button>
                  </td>
                </tr>
              ))}
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
