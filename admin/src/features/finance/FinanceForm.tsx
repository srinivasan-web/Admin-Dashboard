import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, ApiError, errorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { FinanceReference } from "./FinanceReference";
import type { FinanceKind, FinanceRecord } from "./financeApi";

type Field = { key: string; label: string; type?: "number" | "datetime-local" | "reference" | "select" | "checkbox"; endpoint?: string; optional?: boolean; step?: string; max?: number; options?: [string, string][]; initial?: string | boolean };
const product: Field = { key: "product_id", label: "Product", type: "reference", endpoint: "/products" };
const fields: Record<FinanceKind, Field[]> = {
  "emi-providers": [{ key: "name", label: "Approved provider name" }, { key: "code", label: "Unique provider code" }],
  "emi-plans": [
    { key: "provider_id", label: "Provider", type: "reference", endpoint: "/finance/emi-providers" },
    { key: "tenure_months", label: "Tenure (months)", type: "number", step: "1", max: 120 },
    { key: "annual_interest_rate", label: "Annual interest rate (%)", type: "number", step: "0.0001", max: 100, initial: "0" },
    { key: "processing_fee", label: "Upfront processing fee (₹)", type: "number", initial: "0" },
    { key: "minimum_amount", label: "Minimum eligible amount (₹)", type: "number", initial: "0" },
    { key: "maximum_amount", label: "Maximum eligible amount (₹)", type: "number", optional: true },
    { key: "is_no_cost", label: "Merchant waives interest (processing fee still applies)", type: "checkbox", initial: false },
    { key: "starts_at", label: "Valid from", type: "datetime-local", optional: true }, { key: "ends_at", label: "Valid until", type: "datetime-local", optional: true },
  ],
  "product-emi-plans": [product, { key: "emi_plan_id", label: "EMI plan", type: "reference", endpoint: "/finance/emi-plans" }, { key: "variant_id", label: "Optional variant UUID (must belong to product)", optional: true }, { key: "sort_order", label: "Display order", type: "number", step: "1", initial: "0" }],
  "flash-sales": [{ key: "name", label: "Sale name" }, { key: "starts_at", label: "Starts at", type: "datetime-local" }, { key: "ends_at", label: "Ends at", type: "datetime-local" }],
  "flash-sale-products": [product, { key: "flash_sale_id", label: "Flash sale", type: "reference", endpoint: "/finance/flash-sales" }, { key: "discount_type", label: "Pricing rule", type: "select", initial: "price", options: [["price", "Fixed selling price"], ["percent", "Percentage off current selling price"], ["fixed", "Amount off current selling price"]] }, { key: "discount_value", label: "Price / discount value", type: "number" }],
};
type Values = Record<string, string | boolean | null>;
function initial(kind: FinanceKind, record?: FinanceRecord): Values {
  const values: Values = { is_active: record?.is_active ?? false };
  for (const field of fields[kind]) {
    const value = record?.[field.key] ?? field.initial ?? "";
    if (field.type === "datetime-local" && value) {
      const date = new Date(String(value));
      values[field.key] = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    } else values[field.key] = typeof value === "boolean" ? value : String(value);
  }
  return values;
}

export function FinanceForm({ kind, record, onSaved, onClose }: { kind: FinanceKind; record?: FinanceRecord; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState(() => initial(kind, record));
  const [original] = useState(() => initial(kind, record));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  useEffect(() => {
    const protectedUrl = window.location.href;
    const beforeNavigation = (event: Event) => {
      if (saving || (dirty && !window.confirm("Discard unsaved finance changes?"))) {
        event.preventDefault();
        if ((event as CustomEvent<{ historyTraversal?: boolean }>).detail?.historyTraversal) window.history.pushState({}, "", protectedUrl);
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty || saving) event.preventDefault(); };
    window.addEventListener("durafit:before-navigation", beforeNavigation);
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("durafit:before-navigation", beforeNavigation); window.removeEventListener("beforeunload", beforeUnload); };
  }, [dirty, saving]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.is_active && !window.confirm("Publish these approved terms? Customers will see eligible active plans and sales.")) return;
    const payload = { ...form };
    for (const field of fields[kind]) {
      const value = payload[field.key];
      if (field.optional && value === "") payload[field.key] = null;
      else if (field.type === "datetime-local" && value) payload[field.key] = new Date(String(value)).toISOString();
      else if (typeof value === "string") payload[field.key] = value.trim();
    }
    setSaving(true); setFailure(undefined); setErrors({});
    try { await apiRequest(`/finance/${kind}${record ? `/${record.id}` : ""}`, record ? "PUT" : "POST", payload); onSaved(); }
    catch (reason) { setFailure(errorMessage(reason)); if (reason instanceof ApiError) setErrors(reason.details ?? {}); }
    finally { setSaving(false); }
  }
  return <form aria-label="Finance configuration" className="space-y-5 rounded-xl border border-slate-200 bg-white p-5" onSubmit={(event) => void save(event)}>
    <h2 className="text-lg font-semibold">{record ? "Edit configuration" : "Add configuration"}</h2>
    {failure && <p role="alert" className="text-sm text-red-700">{failure}</p>}
    <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
      {fields[kind].map((field) => field.type === "reference"
        ? <FinanceReference key={field.key} label={field.label} endpoint={field.endpoint!} value={String(form[field.key] ?? "")} onChange={(value) => setForm({ ...form, [field.key]: value, ...(field.key === "product_id" && kind === "product-emi-plans" ? { variant_id: "" } : {}) })} error={errors[field.key]?.[0]} />
        : field.type === "checkbox" ? <label key={field.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked })} />{field.label}</label>
        : field.type === "select" ? <Select key={field.key} label={field.label} required value={String(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>{field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        : <Input key={field.key} label={field.label} type={field.type ?? "text"} required={!field.optional} min={field.type === "number" ? field.key === "tenure_months" ? 1 : 0 : undefined} max={field.max} step={field.step ?? (field.type === "number" ? "0.01" : field.type === "datetime-local" ? "1" : undefined)} value={String(form[field.key] ?? "")} error={errors[field.key]?.[0]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />)}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />Active — publish approved configuration</label>
    </fieldset>
    <p className="text-xs text-slate-500">Dates use your device’s local timezone. Draft records are inactive by default. Only enter approved lender terms and sale prices.</p>
    <div className="flex gap-3"><Button type="submit" isLoading={saving}>Save configuration</Button><Button variant="secondary" disabled={saving} onClick={() => { if (!dirty || window.confirm("Discard unsaved finance changes?")) onClose(); }}>Cancel</Button></div>
  </form>;
}
