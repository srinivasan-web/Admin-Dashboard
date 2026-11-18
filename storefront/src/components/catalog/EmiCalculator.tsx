import { useEffect, useRef, useState, type FormEvent } from "react";
import { Wallet } from "lucide-react";
import { formatMoney, submitFinance, type EmiQuote, type PurchaseResource } from "../../api/purchase";

export function EmiCalculator({ productId, options }: { productId: string; options: PurchaseResource }) {
  const plans = options.data?.data.plans;
  const [selection, setSelection] = useState("");
  const selected = plans?.find((plan) => plan.plan_id === selection) ?? plans?.[0];
  const [result, setResult] = useState<{ source: unknown; planId: string; quote?: EmiQuote; error?: string }>();
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const enquirySubmission = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    if (!selected || !options.data) return;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    const source = options.data;
    const planId = selected.plan_id;
    setResult({ source, planId });
    void submitFinance<{ data: EmiQuote }>(productId, "calculate", { plan_id: planId }, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ source, planId, quote: data }); })
      .catch((error: unknown) => { if (!controller.signal.aborted || timedOut) setResult({ source, planId, error: timedOut ? "Calculation took too long. Please try again." : error instanceof Error ? error.message : "Calculation failed. Please try again." }); })
      .finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [productId, selected?.plan_id, options.data]);
  const current = result && result.source === options.data && result.planId === selected?.plan_id ? result : undefined;

  async function enquire(event: FormEvent) {
    event.preventDefault();
    if (!selected || sending) return;
    if (!/^[6-9][0-9]{9}$/.test(mobile) || !consent) { setFeedback("Enter a valid 10-digit Indian mobile number and agree to be contacted."); return; }
    setSending(true); setFeedback("");
    try {
      const fingerprint = `${productId}|${selected.plan_id}|${mobile}`;
      if (enquirySubmission.current?.fingerprint !== fingerprint) enquirySubmission.current = { fingerprint, key: crypto.randomUUID() };
      await submitFinance(productId, "enquiries", { plan_id: selected.plan_id, mobile_number: mobile, consent, idempotency_key: enquirySubmission.current.key });
      setFeedback("Your EMI enquiry has been recorded."); setMobile(""); setConsent(false);
      enquirySubmission.current = null;
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Your enquiry could not be sent. Please try again."); }
    finally { setSending(false); }
  }

  if (options.error) return <section className="mt-4 rounded-xl border border-line p-5" aria-label="EMI plans"><p role="alert" className="text-sm text-red-700">EMI plans could not be loaded. <button type="button" className="underline" onClick={options.retry}>Try again</button></p></section>;
  if (!plans) return <div className="mt-4 animate-pulse rounded-xl border border-line p-5 text-sm text-muted" role="status">Checking EMI availability…</div>;
  if (!plans.length) return <p className="mt-4 text-xs text-muted">No EMI plans are currently available for this product.</p>;
  const quote = current?.quote;
  return <section id="emi-calculator" className="mt-4 scroll-mt-36 rounded-xl border border-line bg-white p-5 shadow-sm sm:p-6" aria-labelledby="emi-title">
    <div className="flex items-center justify-between gap-3"><h2 id="emi-title" className="flex items-center gap-2 text-base font-bold"><Wallet size={18} aria-hidden="true" />EMI calculator</h2><span className="rounded-full border border-orange-300 px-2 py-1 text-[10px] font-semibold text-orange-700">EMI AVAILABLE</span></div>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose an EMI plan">
      {plans.map((plan) => <button type="button" key={plan.plan_id} aria-pressed={selected?.plan_id === plan.plan_id} onClick={() => { setSelection(plan.plan_id); setFeedback(""); }} className={`min-h-10 rounded-lg border px-3 py-2 text-xs transition-colors ${selected?.plan_id === plan.plan_id ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:border-accent"}`}>{plan.tenure_months}M · {plan.provider.name}</button>)}
    </div>
    <div className="mt-4 border-t border-line pt-4" aria-live="polite" aria-busy={!current?.quote && !current?.error}>
      {current?.error ? <p role="alert" className="text-sm text-red-700">{current.error} <button type="button" onClick={options.retry} className="underline">Refresh plans</button></p>
        : !quote ? <p role="status" className="text-sm text-muted">Calculating monthly EMI…</p>
        : <>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-muted">Monthly EMI</p><strong className="text-2xl">{formatMoney(quote.monthly_emi)}</strong><span className="ml-1 text-xs text-muted">× {quote.tenure_months} months</span></div><div className="text-right"><p className="text-xs text-muted">Total payable</p><strong>{formatMoney(quote.total_payable)}</strong></div></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted"><div><dt>Principal</dt><dd className="mt-1 text-navy">{formatMoney(quote.principal)}</dd></div><div><dt>Interest payable</dt><dd className="mt-1 text-navy">{formatMoney(quote.interest_payable)}</dd></div><div><dt>Upfront processing fee</dt><dd className="mt-1 text-navy">{formatMoney(quote.processing_fee)}</dd></div><div><dt>Annual interest rate</dt><dd className="mt-1 text-navy">{quote.method === "no_cost" ? "Interest waived by merchant" : `${Number(quote.annual_interest_rate)}%`}</dd></div></dl>
          <p className="mt-3 text-xs leading-5 text-muted">Estimate from {quote.provider.name}, subject to lender approval. Final instalment: {formatMoney(quote.final_instalment)}. Processing fee is paid upfront. Additional lender taxes or charges, if any, are not included.</p>
        </>}
    </div>
    <form onSubmit={(event) => void enquire(event)} className="mt-5 border-t border-line pt-4">
      <label htmlFor="emi-mobile" className="block text-xs font-medium">Request an EMI callback (optional)</label>
      <div className="mt-2 flex gap-2"><input id="emi-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} required pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" value={mobile} onChange={(event) => setMobile(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm" /><button type="submit" disabled={sending || !quote} className="rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{sending ? "Sending…" : "Send"}</button></div>
      <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><input type="checkbox" checked={consent} required onChange={(event) => setConsent(event.target.checked)} className="mt-1" />I agree to be contacted about this product’s EMI options.</label>
      {feedback && <p role="status" className="mt-2 text-xs">{feedback}</p>}
    </form>
  </section>;
}
