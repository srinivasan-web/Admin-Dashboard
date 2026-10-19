import { type FormEvent, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { errorMessage } from "../../api/client";
import { saveHsnCode } from "./catalogApi";
import type { HsnCode } from "./types";

export function HsnCodeForm({
  selected,
  onSaved,
  onCancel,
}: {
  selected?: HsnCode;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(undefined);
    setSubmitting(true);
    try {
      await saveHsnCode(
        {
          title: data.get("title"),
          hsn_code: data.get("hsn_code") || null,
          type: data.get("type") || null,
          sgst_tax_multiplier: data.get("sgst_tax_multiplier") || null,
          igst_tax_multiplier: data.get("igst_tax_multiplier") || null,
        },
        selected?.id,
      );
      setIsDirty(false);
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  function cancel() {
    if (!isDirty || window.confirm("Discard unsaved changes?")) {
      onCancel();
    }
  }

  return (
    <form
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 w-full transition-all duration-200"
      onSubmit={submit}
      onChange={() => setIsDirty(true)}
      noValidate
    >
      {/* Section Header: 11px uppercase tracking-[0.08em] + 13px muted description */}
      <div className="pb-5 mb-6 border-b border-slate-100">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 m-0">
          {selected ? "EDIT HSN CODE" : "ADD HSN CODE"}
        </h2>
   
      </div>

      <div className="space-y-5">
        {/* Row 1: Title and HSN Code - 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="hsn-title"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none flex items-center gap-1"
            >
              <span>Title</span>
              <span className="text-orange-500 font-bold" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="hsn-title"
              name="title"
              defaultValue={selected?.title}
              required
              placeholder="e.g. Treadmill Equipment"
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="hsn-code"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
            >
              HSN code
            </label>
            <input
              id="hsn-code"
              name="hsn_code"
              defaultValue={selected?.hsn_code ?? ""}
              placeholder="e.g. 950691"
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* Row 2: Type and SGST Tax Multiplier - 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="hsn-type"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
            >
              Type
            </label>
            <input
              id="hsn-type"
              name="type"
              defaultValue={selected?.type ?? ""}
              placeholder="e.g. Fitness Equipment"
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="hsn-sgst"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
            >
              SGST tax multiplier %
            </label>
            <input
              id="hsn-sgst"
              name="sgst_tax_multiplier"
              type="number"
              min="0"
              max="100"
              step=".01"
              defaultValue={selected?.sgst_tax_multiplier ?? ""}
              placeholder="e.g. 9.00"
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* Row 3: IGST Tax Multiplier - 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="hsn-igst"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
            >
              IGST tax multiplier %
            </label>
            <input
              id="hsn-igst"
              name="igst_tax_multiplier"
              type="number"
              min="0"
              max="100"
              step=".01"
              defaultValue={selected?.igst_tax_multiplier ?? ""}
              placeholder="e.g. 18.00"
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* Semantic Form Error Banner */}
        {error && (
          <div
            className="p-3.5 bg-red-50/90 border border-red-200/90 rounded-xl flex items-start gap-2.5 text-red-800"
            role="alert"
          >
            <AlertCircle
              size={18}
              className="text-red-600 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span className="text-[13px] leading-[18px] font-medium">
              {error}
            </span>
          </div>
        )}

        {/* Form Action Bar */}
        <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className="w-full sm:w-auto h-11 px-5 text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-[10px] shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full sm:w-auto h-11 px-6 text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-[10px] shadow-xs hover:shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin text-white"
                  aria-hidden="true"
                />
                <span>Saving…</span>
              </>
            ) : (
              <span>{selected ? "Save changes" : "Add HSN code"}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}