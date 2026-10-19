import { useMemo, useState } from "react";
import { ArrowLeft, PencilLine, Plus, Power, RotateCcw } from "lucide-react";
import { errorMessage } from "../../api/client";
import { saveMaster } from "./catalogApi";
import { MasterForm } from "./MasterForm";
import { CategoryListingsPanel } from "./CategoryListingsPanel";
import { ProductManagementHeader } from "./ProductManagementHeader";
import type { Master } from "./types";
import { FilterBar, StatusBadge } from "../../components/ui";
import type { CatalogRouteMode, CatalogRouteState } from "../../app/routes";

type Props = {
  categories: Master[];
  notice?: string;
  onSaved: () => void;
  route: CatalogRouteState;
  onRouteChange: (mode: CatalogRouteMode, recordId?: string) => void;
};

export function CategoriesWorkspace({ categories, notice, onSaved, route, onRouteChange }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const editing = route.mode === "edit"
    ? categories.find((item) => item.id === route.recordId)
    : undefined;
  const creating = route.mode === "create";
  const [error, setError] = useState<string>();
  const [updatingId, setUpdatingId] = useState<string>();
  const filtered = useMemo(
    () =>
      categories.filter(
        (item) =>
          item.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (status === "all" ||
            (status === "active" && item.is_active) ||
            (status === "inactive" && !item.is_active)),
      ),
    [categories, query, status],
  );

  async function toggleStatus(item: Master) {
    setError(undefined);
    setUpdatingId(item.id);
    try {
      await saveMaster(
        "categories",
        {
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
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

  function closeForm() {
    onRouteChange("list");
  }

  if (route.mode === "edit" && !editing)
    return <section className="workspace-form" role="alert">
      <p className="error">Category not found or no longer available.</p>
      <button className="secondary" onClick={closeForm}>Back to Categories</button>
    </section>;
  if (creating || editing) {
    return (
      <section className="workspace-form w-full space-y-6">
        <ProductManagementHeader
          title={editing ? "Edit Category" : "Add Category"}
      
          breadcrumb={[
            "Product Management",
            "Categories",
            editing ? "Edit Category" : "Add Category",
          ]}
          actions={
            <button
              className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold leading-[20px] text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer"
              type="button"
              onClick={closeForm}
            >
              <ArrowLeft size={16} className="text-slate-500" />
              <span>Categories</span>
            </button>
          }
        />
        <MasterForm
          key={editing?.id ?? "create"}
          path="categories"
          title="Category"
          selected={editing}
          onSaved={() => {
            closeForm();
            onSaved();
          }}
          onCancel={closeForm}
        />
        {editing && <CategoryListingsPanel categoryId={editing.id} />}
      </section>
    );
  }

  return (
    <section className="workspace-list">
      <ProductManagementHeader
        title="Categories"
        breadcrumb={["Product Management", "Categories"]}
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
            aria-label="Search categories"
            placeholder="Search categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Filter categories by status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            className="secondary"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
        </FilterBar>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Category</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Order</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" loading="lazy" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.slug}</td>
                  <td>{item.description || "—"}</td>
                  <td>{item.sort_order ?? 0}</td>
                  <td>
                    <StatusBadge active={Boolean(item.is_active)} />
                  </td>
                  <td className="table-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.name}`}
                      title={`Edit ${item.name}`}
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
                      title={
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
                        className={item.is_active ? "power-on" : "power-off"}
                        aria-hidden="true"
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
            {categories.length === 0
              ? "No categories yet. Add one to begin."
              : "No categories match the current filters."}
          </p>
        )}
        <p className="record-count">
          {filtered.length} of {categories.length} records shown.
        </p>
      </section>
    </section>
  );
}
