import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "../../api/client";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { recordLabel, type FinanceRecord, type Page } from "./financeApi";

export function FinanceReference({ label, endpoint, value, onChange, error }: { label: string; endpoint: string; value: string; onChange: (value: string) => void; error?: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<Page<FinanceRecord>>();
  const [failure, setFailure] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailure(undefined);
    const timer = window.setTimeout(() => {
      void apiRequest<Page<FinanceRecord>>(`${endpoint}?page=${page}&search=${encodeURIComponent(search)}`, "GET", undefined, { signal: controller.signal })
        .then(setResponse).catch((reason) => { if (!controller.signal.aborted) setFailure(errorMessage(reason)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [endpoint, search, page, reload]);
  const last = response?.meta?.last_page ?? response?.last_page ?? 1;
  return <div className="space-y-2 rounded-lg border border-slate-200 p-3">
    <Input label={`Search ${label.toLowerCase()}`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
    <Select label={label} required value={value} error={error} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose {label.toLowerCase()}</option>
      {value && !response?.data.some((item) => item.id === value) && <option value={value}>Current selection · {value}</option>}
      {response?.data.map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}
    </Select>
    {failure ? <p role="alert" className="text-xs text-red-700">{failure} <button type="button" onClick={() => setReload((value) => value + 1)}>Retry</button></p>
      : loading ? <p role="status" className="text-xs text-slate-500">Loading choices…</p>
      : !response?.data.length && <p className="text-xs text-slate-500">No matching records. Create the required record in its tab first.</p>}
    {last > 1 && <div className="flex items-center gap-2 text-xs"><Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous choices</Button><span>{page}/{last}</span><Button size="sm" variant="secondary" disabled={page >= last || loading} onClick={() => setPage(page + 1)}>Next choices</Button></div>}
  </div>;
}
