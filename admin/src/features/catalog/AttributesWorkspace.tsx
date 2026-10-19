import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { errorMessage } from "../../api/client";
import { loadAttributes, saveAttribute } from "./catalogApi";
import { AttributeForm } from "./AttributeForm";
import type { CatalogAttribute } from "./types";

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
    setNotice("Attribute saved.");
    setRevision((value) => value + 1);
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
      setNotice(
        `Attribute ${attribute.is_active ? "deactivated" : "activated"}.`,
      );
      setRevision((value) => value + 1);
      onChanged();
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <section
      id="attribute-library"
      className="my-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      aria-label="Specification attribute library"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold text-slate-900">
            Specification attributes
          </h2>
      
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (
                (!creating && !editing) ||
                window.confirm(
                  "Close the attribute editor? Unsaved attribute changes will be lost.",
                )
              )
                onClose();
            }}
          >
            Close
          </button>
          {!creating && !editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setCreating(true);
                setNotice(undefined);
              }}
            >
              <Plus size={16} /> Add attribute
            </button>
          )}
        </div>
      </div>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="error">
          {actionError}
        </p>
      )}
      {creating || editing ? (
        <AttributeForm
          key={editing?.id ?? "new"}
          selected={editing}
          onSaved={saved}
          onCancel={() => {
            setCreating(false);
            setEditing(undefined);
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              aria-label="Search attributes"
              className="min-w-48 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Search name, slug or unit"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Filter attribute status"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Refresh attributes"
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {loadError && (
            <div role="alert" className="error">
              {loadError}{" "}
              <button
                type="button"
                className="secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {!attributes && !loadError && (
            <p role="status" className="text-sm text-slate-500">
              Loading attributes…
            </p>
          )}
          {attributes && filtered.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              {attributes.length
                ? "No attributes match these filters."
                : "No attributes yet. Add one to use it in product specifications."}
            </p>
          )}
          {attributes && filtered.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Type / Unit</th>
                    <th className="px-3 py-3">Filter</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((attribute) => (
                    <tr
                      key={attribute.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-3">
                        <strong className="text-slate-900">
                          {attribute.name}
                        </strong>
                        <span className="block text-xs text-slate-500">
                          {attribute.slug}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {attribute.data_type}
                        {attribute.unit ? ` · ${attribute.unit}` : ""}
                      </td>
                      <td className="px-3 py-3">
                        {attribute.is_filterable ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-3">
                        {attribute.is_active ? "Active" : "Inactive"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              setEditing(attribute);
                              setNotice(undefined);
                            }}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={updatingId === attribute.id}
                            onClick={() => void toggleStatus(attribute)}
                          >
                            {updatingId === attribute.id
                              ? "Saving…"
                              : attribute.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {attributes && (
            <p className="mt-3 text-xs text-slate-500">
              {filtered.length} of {attributes.length} attributes shown. Search
              and status filtering are local to this list.
            </p>
          )}
        </>
      )}
    </section>
  );
}
