import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { errorMessage } from "../../api/client";
import { getAttributeVisual } from "./attributeVisuals";
import {
  deleteSpecification,
  loadHighlights,
  loadSpecifications,
  saveHighlights,
  saveSpecification,
} from "./catalogApi";
import type {
  CatalogAttribute,
  ProductHighlight,
  ProductSpecification,
} from "./types";

type Panel = "specifications" | "highlights" | "filters";

export function ProductSpecificationsPanel({
  productId,
  attributes,
  panel,
  title = "Specifications",
}: {
  productId: string;
  attributes: CatalogAttribute[];
  panel: Panel;
  title?: string;
}) {
  const [specifications, setSpecifications] = useState<ProductSpecification[]>(
    [],
  );
  const [highlights, setHighlights] = useState<ProductHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [selectedAttributeId, setSelectedAttributeId] = useState("");
  const [editingSpecification, setEditingSpecification] =
    useState<ProductSpecification>();

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const [specificationResponse, highlightResponse] = await Promise.all([
        loadSpecifications(productId),
        loadHighlights(productId),
      ]);
      setSpecifications(specificationResponse.data);
      setHighlights(highlightResponse.data);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [productId]);

  const selectedIds = useMemo(
    () =>
      new Set(highlights.map((highlight) => highlight.product_attribute_id)),
    [highlights],
  );
  const availableAttributes = attributes.filter(
    (attribute) =>
      attribute.is_active &&
      !specifications.some(
        (specification) => specification.attribute.id === attribute.id,
      ),
  );
  const filterableSpecifications = specifications.filter(
    (specification) => specification.attribute.is_filterable,
  );

  async function addSpecification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);
    try {
      const response = await saveSpecification(
        productId,
        {
          attribute_id: form.get("attribute_id"),
          value: form.get("value"),
          sort_order: Number(form.get("sort_order") || 0),
        },
        editingSpecification?.id,
      );
      const showInHighlights = form.get("show_in_highlights") === "on";
      const remainingHighlights = highlights.filter(
        (highlight) =>
          highlight.product_attribute_id !== response.data.id &&
          highlight.product_attribute_id !== editingSpecification?.id,
      );
      const nextHighlights = showInHighlights
        ? [
            ...remainingHighlights,
            {
              product_attribute_id: response.data.id,
              sort_order: remainingHighlights.length,
              is_active: true,
            },
          ]
        : remainingHighlights;

      await saveHighlights(
        productId,
        nextHighlights.map((highlight, sortOrder) => ({
          product_attribute_id: highlight.product_attribute_id,
          sort_order: sortOrder,
          is_active: highlight.is_active,
        })),
      );
      setShowForm(false);
      setSelectedAttributeId("");
      setEditingSpecification(undefined);
      setNotice("Specification saved.");
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  function editSpecification(specification: ProductSpecification) {
    setEditingSpecification(specification);
    setSelectedAttributeId(specification.attribute.id);
    setShowForm(true);
  }

  async function removeSpecification(specification: ProductSpecification) {
    if (
      !window.confirm(
        `Remove ${specification.attribute.name} from this product?`,
      )
    )
      return;
    setSaving(true);
    setError(undefined);
    try {
      await deleteSpecification(productId, specification.id);
      setNotice("Specification removed.");
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  function toggleHighlight(specification: ProductSpecification) {
    setHighlights((current) => {
      const existing = current.find(
        (highlight) => highlight.product_attribute_id === specification.id,
      );
      if (existing)
        return current.filter((highlight) => highlight.id !== existing.id);
      return [
        ...current,
        {
          id: `new-${specification.id}`,
          product_attribute_id: specification.id,
          sort_order: current.length,
          is_active: true,
          specification,
        },
      ];
    });
    setNotice(undefined);
  }

  function moveHighlight(index: number, direction: -1 | 1) {
    setHighlights((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered.map((highlight, sortOrder) => ({
        ...highlight,
        sort_order: sortOrder,
      }));
    });
  }

  async function persistHighlights() {
    setSaving(true);
    setError(undefined);
    try {
      await saveHighlights(
        productId,
        highlights.map((highlight, sortOrder) => ({
          product_attribute_id: highlight.product_attribute_id,
          sort_order: sortOrder,
          is_active: highlight.is_active,
        })),
      );
      setNotice("Highlights saved.");
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <p className="empty-state">Loading product specifications…</p>;
  if (error)
    return (
      <div>
        <p className="error" role="alert">
          {error}
        </p>
        <button
          className="secondary"
          type="button"
          onClick={() => void reload()}
        >
          Retry
        </button>
      </div>
    );

  if (panel === "filters") {
    return (
      <section>
        <h2>Filter Attribute</h2>
      
        {filterableSpecifications.length === 0 ? (
          <p className="empty-state">
            No filterable specifications are available.
          </p>
        ) : (
          <SpecificationTable specifications={filterableSpecifications} />
        )}
      </section>
    );
  }

  if (panel === "highlights") {
    return (
      <section>
        <h2>Product highlights</h2>
        <p className="content-copy">
          Select existing specifications, set their active state, and order the
          customer-facing highlights. No name or value is duplicated.
        </p>
        {specifications.length === 0 ? (
          <p className="empty-state">
            Add a specification before selecting highlights.
          </p>
        ) : (
          <>
            <div className="highlight-picker">
              {specifications.map((specification) => (
                <label key={specification.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(specification.id)}
                    onChange={() => toggleHighlight(specification)}
                  />
                  {specification.attribute.name}: {specification.value}
                  {specification.attribute.unit
                    ? ` ${specification.attribute.unit}`
                    : ""}
                </label>
              ))}
            </div>
            {highlights.length > 0 && (
              <div className="table-scroll highlight-order-table">
                <table>
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highlights.map((highlight, index) => (
                      <tr key={highlight.product_attribute_id}>
                        <td>
                          <strong>{highlight.specification.attribute.name}</strong>
                        </td>
                        <td>
                          {highlight.specification.value}
                          {highlight.specification.attribute.unit
                            ? ` ${highlight.specification.attribute.unit}`
                            : ""}
                        </td>
                        <td>
                          <label className="checkbox compact-checkbox">
                            <input
                              type="checkbox"
                              checked={highlight.is_active}
                              onChange={() =>
                                setHighlights((current) =>
                                  current.map((item) =>
                                    item.product_attribute_id ===
                                    highlight.product_attribute_id
                                      ? { ...item, is_active: !item.is_active }
                                      : item,
                                  ),
                                )
                              }
                            />
                            Active
                          </label>
                        </td>
                        <td className="table-actions">
                          <button
                            className="icon-button spec-action-btn"
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveHighlight(index, -1)}
                            aria-label="Move highlight up"
                            title="Move highlight up"
                          >
                            <ArrowUp size={14} strokeWidth={2.25} />
                          </button>
                          <button
                            className="icon-button spec-action-btn"
                            type="button"
                            disabled={index === highlights.length - 1}
                            onClick={() => moveHighlight(index, 1)}
                            aria-label="Move highlight down"
                            title="Move highlight down"
                          >
                            <ArrowDown size={14} strokeWidth={2.25} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="sticky-action-bar">
              <button
                type="button"
                disabled={saving}
                onClick={() => void persistHighlights()}
              >
                {saving ? "Saving…" : "Save highlights"}
              </button>
            </div>
          </>
        )}
        {notice && <p className="notice">{notice}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="content-copy">
            Assign reusable attributes and values to this product.
          </p>
        </div>
        <button
          type="button"
          disabled={availableAttributes.length === 0 && !editingSpecification}
          onClick={() => {
            setEditingSpecification(undefined);
            setSelectedAttributeId("");
            setShowForm((value) => !value);
          }}
        >
          <Plus size={18} /> Add specification
        </button>
      </div>
      {showForm && (
        <form className="card specification-form" onSubmit={addSpecification}>
          <div className="form-grid">
            <label>
              Attribute
              <select
                name="attribute_id"
                required
                value={selectedAttributeId}
                disabled={Boolean(editingSpecification)}
                onChange={(event) => setSelectedAttributeId(event.target.value)}
              >
                <option value="" disabled>
                  Select an attribute
                </option>
                {(editingSpecification
                  ? [editingSpecification.attribute]
                  : availableAttributes
                ).map((attribute) => (
                  <option key={attribute.id} value={attribute.id}>
                    {attribute.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Value
              <input
                name="value"
                required
                maxLength={1000}
                defaultValue={editingSpecification?.value ?? ""}
              />
            </label>
            <label>
              Unit
              <input
                value={
                  (editingSpecification?.attribute.id === selectedAttributeId
                    ? editingSpecification.attribute
                    : availableAttributes.find(
                        (attribute) => attribute.id === selectedAttributeId,
                      ))?.unit ?? "—"
                }
                disabled
                aria-label="Unit from selected attribute"
              />
            </label>
            <label>
              Sort order
              <input
                name="sort_order"
                type="number"
                min="0"
                defaultValue={
                  editingSpecification?.sort_order ?? specifications.length
                }
              />
            </label>
            <label className="checkbox">
              <input
                name="show_in_highlights"
                type="checkbox"
                defaultChecked={
                  editingSpecification
                    ? selectedIds.has(editingSpecification.id)
                    : false
                }
              />{" "}
              Show in Highlights
            </label>
          </div>
          <div className="form-actions">
            <button disabled={saving}>
              {saving
                ? "Saving…"
                : editingSpecification
                  ? "Update specification"
                  : "Save specification"}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingSpecification(undefined);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {specifications.length === 0 ? (
        <p className="empty-state">No specifications have been added.</p>
      ) : (
        <SpecificationTable
          specifications={specifications}
          onEdit={editSpecification}
          onRemove={removeSpecification}
          disabled={saving}
        />
      )}
      {notice && <p className="notice">{notice}</p>}
    </section>
  );
}

function SpecificationTable({
  specifications,
  onEdit,
  onRemove,
  disabled = false,
}: {
  specifications: ProductSpecification[];
  onEdit?: (specification: ProductSpecification) => void;
  onRemove?: (specification: ProductSpecification) => void;
  disabled?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Sort order</th>
            {(onEdit || onRemove) && (
              <th>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {specifications.map((specification) => {
            const visual = getAttributeVisual(
              specification.attribute.name,
              specification.attribute.slug,
              specification.attribute.icon,
              14,
            );
            return (
              <tr key={specification.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${visual.bg} shadow-2xs`}
                      title={specification.attribute.name}
                      aria-hidden="true"
                    >
                      {visual.icon}
                    </div>
                    <strong>{specification.attribute.name}</strong>
                  </div>
                </td>
                <td>{specification.value}</td>
                <td>{specification.attribute.unit ?? "—"}</td>
                <td>{specification.sort_order}</td>
                {(onEdit || onRemove) && (
                  <td className="table-actions">
                    {onEdit && (
                      <button
                        className="icon-button spec-action-btn"
                        type="button"
                        disabled={disabled}
                        aria-label={`Edit ${specification.attribute.name}`}
                        title={`Edit ${specification.attribute.name}`}
                        onClick={() => onEdit(specification)}
                      >
                        Edit
                      </button>
                    )}
                    {onRemove && (
                      <button
                        className="icon-button danger spec-action-btn"
                        type="button"
                        disabled={disabled}
                        aria-label={`Remove ${specification.attribute.name}`}
                        title={`Remove ${specification.attribute.name}`}
                        onClick={() => onRemove(specification)}
                      >
                        <Trash2 size={14} strokeWidth={2.25} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
