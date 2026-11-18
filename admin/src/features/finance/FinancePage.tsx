import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { apiRequest, errorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { Tabs } from "../../components/ui/Tabs";
import { canLeaveWorkspace } from "../../app/navigationGuard";
import { FinanceForm } from "./FinanceForm";
import { financeKinds, financeList, recordLabel, type Enquiry, type FinanceKind, type FinanceRecord, type Page } from "./financeApi";

const labels: Record<FinanceKind | "emi-enquiries", string> = { "emi-providers": "Providers", "emi-plans": "EMI plans", "product-emi-plans": "Product plans", "flash-sales": "Flash sales", "flash-sale-products": "Sale products", "emi-enquiries": "Enquiries" };
type Section = keyof typeof labels;
function currentSection(): Section {
  const value = new URLSearchParams(window.location.search).get("section");
  return value && Object.hasOwn(labels, value) ? value as Section : "emi-providers";
}
const readableIssue = (issue: string) => issue.replaceAll("_", " ");
function details(row: FinanceRecord, kind: FinanceKind): string {
  if (kind === "emi-providers") return row.code ?? "";
  if (kind === "emi-plans") return `${row.annual_interest_rate}% APR · ₹${row.processing_fee} upfront fee · ${row.minimum_amount}–${row.maximum_amount ?? "no maximum"} eligible`;
  if (kind === "product-emi-plans") return row.variant_id ? `Variant ${row.variant_id}` : "Base product";
  if (kind === "flash-sales") return `${new Date(row.starts_at!).toLocaleString()} → ${new Date(row.ends_at!).toLocaleString()}`;
  return `${row.discount_type}: ${row.discount_value}`;
}

export default function FinancePage({ canManage }: { canManage: boolean }) {
  const [section, setSection] = useState<Section>(currentSection);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [response, setResponse] = useState<Page<FinanceRecord> | Page<Enquiry>>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [editing, setEditing] = useState<FinanceRecord | "new">();
  const [contact, setContact] = useState<Enquiry>();
  const [contactLoading, setContactLoading] = useState(false);
  const [deliveryIssue, setDeliveryIssue] = useState<string | null>();
  const [busy, setBusy] = useState<string>();
  const contactRequest = useRef<AbortController | null>(null);
  useEffect(() => () => contactRequest.current?.abort(), []);

  useEffect(() => {
    const restore = () => { setSection(currentSection()); setPage(1); setEditing(undefined); setContact(undefined); };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    contactRequest.current?.abort();
    setContactLoading(false);
    setLoading(true); setFailure(undefined); setResponse(undefined); setContact(undefined);
    const promise = section === "emi-enquiries"
      ? apiRequest<Page<Enquiry>>(`/finance/emi-enquiries?page=${page}`, "GET", undefined, { signal: controller.signal })
      : financeList(section, page, appliedSearch, controller.signal);
    void promise.then(setResponse).catch((reason) => { if (!controller.signal.aborted) setFailure(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    void apiRequest<{ data: { configuration_issue: string | null } }>("/finance/delivery-status", "GET", undefined, { signal: controller.signal })
      .then((result) => setDeliveryIssue(result.data.configuration_issue)).catch(() => { if (!controller.signal.aborted) setDeliveryIssue("configuration_status_unavailable"); });
    return () => controller.abort();
  }, [canManage, section, page, appliedSearch, reload]);

  function changeSection(value: string) {
    if (!canLeaveWorkspace()) return;
    setSection(value as Section); setPage(1); setSearch(""); setAppliedSearch(""); setEditing(undefined); setContact(undefined); setNotice(undefined);
    window.history.pushState({}, "", `/finance?section=${encodeURIComponent(value)}`);
  }
  async function reveal(id: string) {
    contactRequest.current?.abort();
    const controller = new AbortController();
    contactRequest.current = controller;
    setContact(undefined); setContactLoading(true); setFailure(undefined);
    try { setContact((await apiRequest<{ data: Enquiry }>(`/finance/emi-enquiries/${id}`, "GET", undefined, { signal: controller.signal })).data); }
    catch (reason) { if (!controller.signal.aborted) setFailure(errorMessage(reason)); }
    finally { if (!controller.signal.aborted) setContactLoading(false); }
  }
  async function retryNotification(id: string) {
    setBusy(id); setFailure(undefined);
    try {
      const result = await apiRequest<{ data: Enquiry }>(`/finance/emi-enquiries/${id}/retry`, "POST", {});
      setNotice(result.data.notification_status === "blocked" ? `Delivery blocked: ${readableIssue(result.data.notification_error ?? "configuration required")}` : "Notification scheduled for retry.");
      setReload((value) => value + 1);
    } catch (reason) { setFailure(errorMessage(reason)); }
    finally { setBusy(undefined); }
  }
  const lastPage = response?.last_page ?? response?.meta?.last_page ?? 1;
  const total = response?.total ?? response?.meta?.total ?? 0;

  return <div className="w-full max-w-none space-y-5 pb-12">
    <PageHeader title="EMI & Flash Sales" description="Configure approved financing terms, scheduled promotions and consented enquiry follow-up." breadcrumb={["Catalog & Sales", "EMI & Flash Sales"]} actions={canManage && <Button variant="secondary" onClick={() => setReload((value) => value + 1)} leftIcon={<RefreshCw size={16} />}>Refresh</Button>} />
    {!canManage ? <p role="alert">Catalog management permission is required.</p> : <>
      <div className="overflow-x-auto"><Tabs items={[...financeKinds, "emi-enquiries" as const].map((id) => ({ id, label: labels[id] }))} activeTab={section} onChange={changeSection} /></div>
      {deliveryIssue && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Enquiry notifications need configuration: {readableIssue(deliveryIssue)}. Saved enquiries remain available below.</p>}
      {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {failure && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{failure} <button type="button" onClick={() => setReload((value) => value + 1)} className="underline">Retry loading</button></p>}
      {editing && section !== "emi-enquiries" && <FinanceForm key={`${section}-${editing === "new" ? "new" : editing.id}`} kind={section} record={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setNotice("Configuration saved. Active records become visible only when all eligibility rules are met."); setReload((value) => value + 1); }} />}
      {section !== "emi-enquiries" && <form className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); setPage(1); }}>
        <Input label="Search configuration" value={search} onChange={(event) => setSearch(event.target.value)} containerClassName="sm:max-w-md" />
        <Button type="submit" variant="secondary">Search</Button><Button leftIcon={<Plus size={16} />} disabled={Boolean(editing)} onClick={() => { setEditing("new"); setNotice(undefined); }}>Add {labels[section].toLowerCase()}</Button>
      </form>}
      {contactLoading && <p role="status">Loading enquiry contact…</p>}
      {contact && <section aria-label="Enquiry contact" className="space-y-2 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Consented callback: {contact.product_name ?? "Product"}</h2><p className="text-sm">Mobile: <a href={`tel:+91${contact.mobile_number}`} className="text-orange-700 underline">{contact.mobile_number}</a></p><p className="text-xs text-slate-500">Consent recorded {contact.consented_at ? new Date(contact.consented_at).toLocaleString() : "—"}. Notification status: {contact.notification_status}.</p><Button variant="secondary" size="sm" onClick={() => setContact(undefined)}>Hide contact</Button></section>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? <p role="status" className="p-6 text-sm text-slate-500">Loading {labels[section].toLowerCase()}…</p>
          : !response?.data.length ? <p className="p-6 text-sm text-slate-500">No {labels[section].toLowerCase()} found. {section !== "emi-enquiries" && "Add approved configuration to get started."}</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">{section === "emi-enquiries" ? "Product / enquiry" : "Configuration"}</th><th className="p-4">Details</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">
            {section === "emi-enquiries" ? (response.data as Enquiry[]).map((row) => <tr key={row.id}><td className="p-4"><strong>{row.product_name ?? "Product"}</strong><p className="mt-1 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</p></td><td className="p-4"><span>{row.mobile_masked}</span><p className="text-xs text-slate-500">{row.notification_attempts} delivery attempts</p>{row.notification_error && <p className="mt-1 text-xs text-amber-700">{readableIssue(row.notification_error)}</p>}</td><td className="p-4">{row.notification_status}</td><td className="p-4"><div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => void reveal(row.id)}>View contact</Button>{["failed", "blocked", "pending"].includes(row.notification_status) && <Button size="sm" variant="outline" disabled={Boolean(busy)} isLoading={busy === row.id} onClick={() => void retryNotification(row.id)}>Retry notification</Button>}</div></td></tr>)
              : (response.data as FinanceRecord[]).map((row) => <tr key={row.id}><td className="p-4 font-medium">{recordLabel(row)}</td><td className="max-w-sm p-4 text-xs leading-5 text-slate-500">{details(row, section)}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${row.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{row.is_active ? "Active" : "Draft"}</span></td><td className="p-4 text-right"><Button size="sm" variant="secondary" disabled={Boolean(editing)} onClick={() => setEditing(row)}>Edit</Button></td></tr>)}
          </tbody></table></div>}
        <Pagination page={page} totalPages={lastPage} totalCount={total} perPage={20} isLoading={loading} onPageChange={setPage} />
      </section>
    </>}
  </div>;
}
