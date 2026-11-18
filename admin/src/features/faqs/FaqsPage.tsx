import { useEffect, useState, type FormEvent } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { apiRequest, ApiError, errorMessage, type ApiResponse } from "../../api/client";
import { PageHeader } from "../../components/ui/PageHeader";

type Category = { id: string; name: string };
type Faq = {
  id: string;
  category_id: string | null;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};
type FaqForm = Omit<Faq, "id">;
type Page<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number } };
const blank: FaqForm = { category_id: null, question: "", answer: "", sort_order: 0, is_active: false };

export function FaqsPage({ canManage }: { canManage: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FaqForm>(blank);
  const [original, setOriginal] = useState<FaqForm>(blank);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const dirty = editing !== null && JSON.stringify(form) !== JSON.stringify(original);

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    const controller = new AbortController();
    void apiRequest<ApiResponse<Category[]>>("/categories", "GET", undefined, { signal: controller.signal })
      .then((response) => setCategories(response.data))
      .catch((reason) => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    void apiRequest<Page<Faq>>(`/category-faqs?page=${page}`, "GET", undefined, { signal: controller.signal })
      .then((response) => {
        setFaqs(response.data);
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
      if (saving || (dirty && !window.confirm("Discard unsaved FAQ changes?"))) {
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

  function open(faq?: Faq) {
    if (dirty && !window.confirm("Discard unsaved FAQ changes?")) return;
    const next = faq ? { category_id: faq.category_id, question: faq.question, answer: faq.answer, sort_order: faq.sort_order, is_active: faq.is_active } : { ...blank };
    setForm(next);
    setOriginal(next);
    setEditing(faq?.id ?? "new");
    setFieldErrors({});
    setNotice(undefined);
  }

  function close() {
    if (dirty && !window.confirm("Discard unsaved FAQ changes?")) return;
    setEditing(null);
    setFieldErrors({});
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { ...form, question: form.question.trim(), answer: form.answer.trim() };
    const errors: Record<string, string[]> = {};
    if (payload.question.length < 5) errors.question = ["Enter a question of at least 5 characters."];
    if (payload.answer.length < 2) errors.answer = ["Enter an answer of at least 2 characters."];
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      await apiRequest<ApiResponse<Faq>>(editing === "new" ? "/category-faqs" : `/category-faqs/${editing}`, editing === "new" ? "POST" : "PUT", payload);
      setNotice(editing === "new" ? "FAQ saved as a draft or published according to its status." : "FAQ updated.");
      setEditing(null);
      setPage(1);
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.details) setFieldErrors(reason.details);
      setError(errorMessage(reason));
    } finally { setSaving(false); }
  }

  async function setStatus(faq: Faq) {
    setError(undefined);
    try {
      await apiRequest(`/category-faqs/${faq.id}`, "PUT", { is_active: !faq.is_active });
      setNotice(faq.is_active ? "FAQ unpublished." : "FAQ published.");
      setReload((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  async function remove(faq: Faq) {
    if (!window.confirm(`Delete the FAQ “${faq.question}”?`)) return;
    setError(undefined);
    try {
      await apiRequest(`/category-faqs/${faq.id}`, "DELETE");
      setNotice("FAQ deleted.");
      setPage(1);
      setReload((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  return (
    <div className="w-full max-w-none space-y-5 pb-12">
      <PageHeader title="FAQs" description="Publish answers for all products or one category. Only published answers appear on the storefront." breadcrumb={["CMS", "FAQs"]} actions={canManage && <button type="button" onClick={() => open()}><Plus size={16} /> Add FAQ</button>} />
      {!canManage ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="alert">Catalog management permission is required to manage FAQs.</p> : <>
        {notice && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
        {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert"><span>{error}</span><button type="button" className="!min-h-9 !bg-white !text-red-800" onClick={() => setReload((value) => value + 1)}><RotateCcw size={14} /> Retry</button></div>}
        {editing && <form onSubmit={(event) => void save(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={editing === "new" ? "Create FAQ" : "Edit FAQ"}>
          <h2 className="text-lg font-semibold">{editing === "new" ? "Add FAQ" : "Edit FAQ"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Category <span className="text-slate-500">(optional)</span><select className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3" value={form.category_id ?? ""} onChange={(event) => setForm({ ...form, category_id: event.target.value || null })}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{fieldErrors.category_id && <span className="text-xs text-red-700">{fieldErrors.category_id[0]}</span>}</label>
            <label className="block text-sm font-medium">Sort order<input className="mt-1 block w-full rounded-xl border border-slate-300 p-3" type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} />{fieldErrors.sort_order && <span className="text-xs text-red-700">{fieldErrors.sort_order[0]}</span>}</label>
          </div>
          <label className="block text-sm font-medium">Question *<input className="mt-1 block w-full rounded-xl border border-slate-300 p-3" required minLength={5} maxLength={255} value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} />{fieldErrors.question && <span className="text-xs text-red-700">{fieldErrors.question[0]}</span>}</label>
          <label className="block text-sm font-medium">Answer *<textarea className="mt-1 block min-h-32 w-full rounded-xl border border-slate-300 p-3" required minLength={2} maxLength={10000} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />{fieldErrors.answer && <span className="text-xs text-red-700">{fieldErrors.answer[0]}</span>}</label>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Publish now</label>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4"><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save FAQ"}</button><button type="button" className="!border-slate-300 !bg-white !text-slate-800" onClick={close} disabled={saving}>Cancel</button></div>
        </form>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="FAQ list">
          {loading ? <p className="p-6 text-sm text-slate-600" role="status">Loading FAQs…</p> : !faqs.length ? <p className="p-6 text-sm text-slate-600">No FAQs yet. Add an approved answer to publish it.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[690px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-4">Question</th><th className="p-4">Category</th><th className="p-4">Order</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{faqs.map((faq) => <tr key={faq.id} className="border-t border-slate-200"><td className="max-w-sm p-4"><strong className="block text-slate-900">{faq.question}</strong><span className="mt-1 block truncate text-xs text-slate-500">{faq.answer}</span></td><td className="p-4">{categories.find((category) => category.id === faq.category_id)?.name ?? "All categories"}</td><td className="p-4">{faq.sort_order}</td><td className="p-4">{faq.is_active ? "Published" : "Draft"}</td><td className="p-4"><div className="flex justify-end gap-2"><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" onClick={() => open(faq)}>Edit</button><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" onClick={() => void setStatus(faq)}>{faq.is_active ? "Unpublish" : "Publish"}</button><button type="button" className="!min-h-9 !border-red-200 !bg-white !px-3 !text-red-700" onClick={() => void remove(faq)}>Delete</button></div></td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-600"><span>{total} FAQs · page {page} of {lastPage}</span><div className="flex gap-2"><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className="!min-h-9 !border-slate-300 !bg-white !px-3 !text-slate-800" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button></div></div>
        </section>
      </>}
    </div>
  );
}
