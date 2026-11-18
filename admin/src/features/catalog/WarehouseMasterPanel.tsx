import { type FormEvent, useState } from "react";
import {
  PencilLine,
  Trash2,
  Plus,
  Warehouse,
  Search,
  MapPin,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import { toast } from "../../components/ui/Toast";
import { deleteWarehouse, saveWarehouse } from "./catalogApi";
import type { WarehouseLocation } from "./types";

type Warehouse = WarehouseLocation;
type WarehouseForm = {
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: string;
  longitude: string;
};
const emptyForm: WarehouseForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  latitude: "",
  longitude: "",
};
function formFor(warehouse?: Warehouse): WarehouseForm {
  return warehouse
    ? {
        name: warehouse.name,
        address: warehouse.address ?? "",
        city: warehouse.city ?? "",
        state: warehouse.state ?? "",
        postal_code: warehouse.postal_code ?? "",
        latitude: warehouse.latitude ?? "",
        longitude: warehouse.longitude ?? "",
      }
    : emptyForm;
}

export function WarehouseMasterPanel({
  warehouses,
  onSaved,
}: {
  warehouses: Warehouse[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<Warehouse>();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const filtered = warehouses.filter((w) =>
    w.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function cancel() {
    if (
      JSON.stringify(form) !== JSON.stringify(formFor(editing)) &&
      !window.confirm("Discard unsaved warehouse changes?")
    )
      return;
    setAdding(false);
    setEditing(undefined);
    setForm(emptyForm);
    setError(undefined);
  }

  function fieldChange(field: keyof WarehouseForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: e.target.value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await saveWarehouse(
        {
          ...form,
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postal_code: form.postal_code.trim(),
          latitude: form.latitude.trim() || null,
          longitude: form.longitude.trim() || null,
        },
        editing?.id,
      );
      const msg = editing ? "Warehouse updated." : "Warehouse created.";
      setNotice(msg);
      toast.success(msg);
      setEditing(undefined);
      setAdding(false);
      setForm(emptyForm);
      onSaved();
    } catch (reason) {
      const err = errorMessage(reason);
      setError(err);
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(warehouse: Warehouse) {
    if (
      !window.confirm(
        `Delete ${warehouse.name}? Warehouses with stock records or orders cannot be deleted.`,
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await deleteWarehouse(warehouse.id);
      setNotice("Warehouse deleted.");
      toast.success("Warehouse deleted.");
      onSaved();
    } catch (reason) {
      const err = errorMessage(reason);
      setError(err);
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  const isFormOpen = adding || !!editing;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <Warehouse size={15} className="text-slate-600" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              Warehouses
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {warehouses.length} location{warehouses.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAdding(true);
              setForm(emptyForm);
              setError(undefined);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-60"
          >
            <Plus size={14} aria-hidden="true" />
            Add warehouse
          </button>
        )}
      </div>

      {/* Notices */}
      {notice && (
        <div
          role="status"
          className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Add / Edit form */}
      {isFormOpen ? (
        <form onSubmit={submit} className="px-6 py-6">
          <h3 className="mb-5 text-sm font-bold text-slate-800">
            {editing ? `Edit: ${editing.name}` : "New warehouse"}
          </h3>

          {/* Main fields */}
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["name", "Warehouse name", "text", true],
                ["address", "Address", "text", false],
                ["city", "City", "text", false],
                ["state", "State / Province", "text", false],
                ["postal_code", "Postal code", "text", false],
              ] as const
            ).map(([field, label, , required]) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {label}
                  {required && (
                    <span className="ml-0.5 text-orange-500" aria-hidden="true">
                      *
                    </span>
                  )}
                </span>
                <input
                  value={form[field]}
                  onChange={fieldChange(field)}
                  required={required}
                  maxLength={255}
                  disabled={busy}
                  autoFocus={field === "name"}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 transition"
                />
              </label>
            ))}
          </div>

          {/* Coordinates row */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(
              [
                ["latitude", "Latitude", -90, 90],
                ["longitude", "Longitude", -180, 180],
              ] as const
            ).map(([field, label, min, max]) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <MapPin size={12} className="text-slate-400" />
                  {label}
                  <span className="ml-auto font-normal text-slate-400">
                    optional
                  </span>
                </span>
                <input
                  type="number"
                  step="any"
                  min={min}
                  max={max}
                  value={form[field]}
                  onChange={fieldChange(field)}
                  disabled={busy}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 transition"
                />
              </label>
            ))}
          </div>

          {/* Form actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create warehouse"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="px-6 pb-6">
          {/* Search */}
          <div className="relative my-4">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search warehouses…"
              aria-label="Search warehouses"
              className="h-9 w-full max-w-xs rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[440px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Warehouse name
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((warehouse) => (
                  <tr
                    key={warehouse.id}
                    className="group transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Warehouse
                            size={13}
                            className="text-slate-500"
                            aria-hidden="true"
                          />
                        </div>
                        <span className="font-medium text-slate-800">
                          {warehouse.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={`Edit ${warehouse.name}`}
                          aria-label={`Edit ${warehouse.name}`}
                          disabled={busy}
                          onClick={() => {
                            setEditing(warehouse);
                            setForm(formFor(warehouse));
                            setError(undefined);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                        >
                          <PencilLine size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${warehouse.name}`}
                          aria-label={`Delete ${warehouse.name}`}
                          disabled={busy}
                          onClick={() => void remove(warehouse)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Warehouse size={28} className="text-slate-300" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-600">
                  {warehouses.length
                    ? "No matching warehouses"
                    : "No warehouses yet"}
                </p>
                <p className="text-xs text-slate-400">
                  {warehouses.length
                    ? "Try a different search term."
                    : "Add a warehouse to begin managing stock."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
