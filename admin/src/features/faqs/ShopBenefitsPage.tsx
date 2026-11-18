import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { apiRequest, ApiError, errorMessage, type ApiResponse } from "../../api/client";
import { PageHeader } from "../../components/ui/PageHeader";
import { BannerMediaField } from "../banners/BannerMediaField";
import type { BannerMedia } from "../banners/bannersApi";

type Benefit = {
  id: string;
  title: string;
  description: string | null;
  icon_media_id: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
};
type BenefitForm = Omit<Benefit, "id" | "icon_url">;
type Page = { data: Benefit[]; meta: { current_page: number; last_page: number; total: number } };
const blank: BenefitForm = { title: "", description: null, icon_media_id: null, sort_order: 0, is_active: false };

export function ShopBenefitsPage({ canManage }: { canManage: boolean }) {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<BenefitForm>(blank);
  const [original, setOriginal] = useState<BenefitForm>(blank);
  const [selectedIcon, setSelectedIcon] = useState<BannerMedia>();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const dirty = editing !== null && JSON.stringify(form) !== JSON.stringify(original);

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    void apiRequest<Page>(`/shop-benefits?page=${page}`, "GET", undefined, { signal: controller.signal })
      .then((response) => {
        setBenefits(response.data);
        setPage(response.meta.current_page);
        setLastPage(response.meta.last_page);
        setTotal(response.meta.total);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canManage, page, reload]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const protectedUrl = window.location.href;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const beforeNavigation = (event: Event) => {
      if (saving || (dirty && !window.confirm("Discard unsaved shopping-benefit changes?"))) {
        event.preventDefault();
        if ((event as CustomEvent<{ historyTraversal?: boolean }>).detail?.historyTraversal) {
          window.history.pushState({}, "", protectedUrl);
        }
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("durafit:before-navigation", beforeNavigation);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("durafit:before-navigation", beforeNavigation);
    };
  }, [dirty, saving]);

  function open(benefit?: Benefit) {
    if (dirty && !window.confirm("Discard unsaved shopping-benefit changes?")) return;
    const next = benefit ? { title: benefit.title, description: benefit.description, icon_media_id: benefit.icon_media_id, sort_order: benefit.sort_order, is_active: benefit.is_active } : { ...blank };
    setForm(next);
    setOriginal(next);
    setSelectedIcon(benefit?.icon_media_id && benefit.icon_url ? { id: benefit.icon_media_id, url: benefit.icon_url, mime_type: null } : undefined);
    setFieldErrors({});
    setEditing(benefit?.id ?? "new");
    setNotice(undefined);
  }

  function close() {
    if (dirty && !window.confirm("Discard unsaved shopping-benefit changes?")) return;
    setEditing(null);
    setFieldErrors({});
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { ...form, title: form.title.trim(), description: form.description?.trim() || null };
    if (payload.title.length < 2) { setFieldErrors({ title: ["Enter a title of at least 2 characters."] }); return; }
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      await apiRequest<ApiResponse<Benefit>>(editing === "new" ? "/shop-benefits" : `/shop-benefits/${editing}`, editing === "new" ? "POST" : "PUT", payload);
      setNotice("Shopping benefit saved. Only published benefits appear on product pages.");
      setEditing(null);
      setPage(1);
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.details) setFieldErrors(reason.details);
      setError(errorMessage(reason));
    } finally { setSaving(false); }
  }

  async function setStatus(benefit: Benefit) {
    setError(undefined);
    try {
      await apiRequest(`/shop-benefits/${benefit.id}`, "PUT", { is_active: !benefit.is_active });
      setNotice(benefit.is_active ? "Shopping benefit unpublished." : "Shopping benefit published.");
      setReload((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  async function remove(benefit: Benefit) {
    if (!window.confirm(`Delete “${benefit.title}”?`)) return;
    setError(undefined);
    try {
      await apiRequest(`/shop-benefits/${benefit.id}`, "DELETE");
      setNotice("Shopping benefit deleted.");
      setPage(1);
      setReload((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  return (
    <div className="w-full max-w-none space-y-5 pb-12">
      <PageHeader title="Why Shop" description="Manage verified storewide benefits shown on product-detail pages." breadcrumb={["CMS", "Why Shop"]} actions={canManage && <button type="button" onClick={() => open()}><Plus size={16} /> Add benefit</button>} />
      {!canManage ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="alert">Catalog management permission is required to manage shopping benefits.</p> : <>
        {notice && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {editing && <form onSubmit={(event) => void save(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={editing === "new" ? "Create shopping benefit" : "Edit shopping benefit"}>
          <h2 className="text-lg font-semibold">{editing === "new" ? "Add shopping benefit" : "Edit shopping benefit"}</h2>
          <label className="block text-sm font-medium">Title *<input className="mt-1 block w-full rounded-xl border border-slate-300 p-3" required minLength={2} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />{fieldErrors.title && <span className="text-xs text-red-700">{fieldErrors.title[0]}</span>}</label>
          <label className="block text-sm font-medium">Description<textarea className="mt-1 block min-h-24 w-full rounded-xl border border-slate-300 p-3" maxLength={2000} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} />{fieldErrors.description && <span className="text-xs text-red-700">{fieldErrors.description[0]}</span>}</label>
          <div className="grid gap-4 sm:grid-cols-2"><div><span className="mb-2 block text-sm font-medium">Icon (optional)</span><BannerMediaField label="Benefit icon" selected={selectedIcon} onSelect={(media) => { setSelectedIcon(media); setForm({ ...form, icon_media_id: media.id }); }} onBusyChange={setUploading} error={fieldErrors.icon_media_id?.[0]} />{form.icon_media_id && <button type="button" className="mt-2 !min-h-9 !border-slate-300 !bg-white !text-slate-800" onClick={() => { setSelectedIcon(undefined); setForm({ ...form, icon_media_id: null }); }}>Remove icon</button>}</div><div className="space-y-4"><label className="block text-sm font-medium">Sort order<input className="mt-1 block w-full rounded-xl border border-slate-300 p-3" type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} />{fieldErrors.sort_order && <span className="text-xs text-red-700">{fieldErrors.sort_order[0]}</span>}</label><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Publish now</label></div></div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4"><button type="submit" disabled={saving || uploading}>{saving ? "Saving…" : "Save benefit"}</button><button type="button" className="!border-slate-300 !bg-white !text-slate-800" onClick={close} disabled={saving || uploading}>Cancel</button></div>
        </form>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Shopping-benefit list">
          {loading ? <p className="p-6 text-sm text-slate-600" role="status">Loading shopping benefits…</p> : !benefits.length ? <p className="p-6 text-sm text-slate-600">No benefits yet. Add and publish a verified storewide claim.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-4">Benefit</th><th className="p-4">Order</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{benefits.map((benefit) => <tr key={benefit.id} className="border-t border-slate-200"><td className="p-4"><div className="flex items-center gap-3">{benefit.icon_url && <img src={benefit.icon_url} alt="" className="size-10 object-contain" />}<div><strong className="block text-slate-900">{benefit.title}</strong><span className="mt-1 block text-xs text-slate-500">{benefit.description}</span></div></div></td><td className="p-4">{benefit.sort_order}</td><td className="p-4">{benefit.is_active ? "Published" : "Draft"}</td><td className="p-4"><div className="flex justify-end gap-2"><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" onClick={() => open(benefit)}>Edit</button><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" onClick={() => void setStatus(benefit)}>{benefit.is_active ? "Unpublish" : "Publish"}</button><button type="button" className="!min-h-9 !border-red-200 !bg-white !px-3 !text-red-700" onClick={() => void remove(benefit)}>Delete</button></div></td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-600"><span>{total} benefits · page {page} of {lastPage}</span><div className="flex gap-2"><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button></div></div>
        </section>
      </>}
    </div>
  );
}
