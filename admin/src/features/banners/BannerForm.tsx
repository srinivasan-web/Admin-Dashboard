import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Calendar, Link2, Save } from "lucide-react";
import { ApiError, errorMessage } from "../../api/client";
import { BannerMediaField } from "./BannerMediaField";
import {
  createBanner,
  getBanner,
  updateBanner,
  type Banner,
  type BannerInput,
  type BannerMedia,
} from "./bannersApi";
import "./banners.css";

type BannerDraft = {
  title: string;
  description: string;
  cta_text: string;
  desktop_media_id: string;
  mobile_media_id: string;
  page: string;
  sort_order: number;
  redirect_url: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
};

const emptyDraft: BannerDraft = {
  title: "",
  description: "",
  cta_text: "",
  desktop_media_id: "",
  mobile_media_id: "",
  page: "landing",
  sort_order: 0,
  redirect_url: "",
  start_at: "",
  end_at: "",
  is_active: true,
};

function toLocalDateTimeString(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function draftFromBanner(banner: Banner): BannerDraft {
  return {
    title: banner.title,
    description: banner.description ?? "",
    cta_text: banner.cta_text ?? "",
    desktop_media_id: banner.desktop_media_id,
    mobile_media_id: banner.mobile_media_id,
    page: banner.page ?? "landing",
    sort_order: banner.sort_order,
    redirect_url: banner.redirect_url ?? "",
    start_at: toLocalDateTimeString(banner.start_at),
    end_at: toLocalDateTimeString(banner.end_at),
    is_active: banner.is_active,
  };
}

function validate(draft: BannerDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = "Title is required.";
  if (draft.description.length > 2000)
    errors.description = "Description must be 2,000 characters or fewer.";
  if (draft.cta_text.length > 120)
    errors.cta_text = "Button text must be 120 characters or fewer.";
  if (!draft.desktop_media_id.trim())
    errors.desktop_media_id = "Desktop image is required.";
  if (!draft.mobile_media_id.trim())
    errors.mobile_media_id = "Mobile image is required.";
  if (!draft.page.trim()) errors.page = "Page is required.";
  if (draft.sort_order < 0)
    errors.sort_order = "Sort order must be zero or greater.";
  if (draft.redirect_url.trim()) {
    try {
      const url = new URL(draft.redirect_url);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Unsupported URL scheme");
    } catch {
      errors.redirect_url = "Enter a valid URL (e.g. https://example.com).";
    }
  }
  if (
    draft.start_at &&
    draft.end_at &&
    new Date(draft.end_at) < new Date(draft.start_at)
  ) {
    errors.end_at = "End date must be after the start date.";
  }
  return errors;
}

export function BannerForm({
  mode,
  id,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  id?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BannerDraft>(emptyDraft);
  const [savedBanner, setSavedBanner] = useState<Banner>();
  const [desktopMedia, setDesktopMedia] = useState<BannerMedia>();
  const [mobileMedia, setMobileMedia] = useState<BannerMedia>();
  const [desktopUploading, setDesktopUploading] = useState(false);
  const [mobileUploading, setMobileUploading] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    let active = true;
    setLoading(true);
    getBanner(id)
      .then(({ data }) => {
        if (!active) return;
        setSavedBanner(data);
        setDesktopMedia(data.desktop_media);
        setMobileMedia(data.mobile_media);
        setDraft(draftFromBanner(data));
        setLoadError(undefined);
      })
      .catch((reason) => {
        if (active) setLoadError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, id]);

  function change<K extends keyof BannerDraft>(key: K, value: BannerDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(undefined);

    const payload: BannerInput = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      cta_text: draft.cta_text.trim() || null,
      desktop_media_id: draft.desktop_media_id,
      mobile_media_id: draft.mobile_media_id,
      page: draft.page.trim().toLowerCase(),
      sort_order: draft.sort_order,
      redirect_url: draft.redirect_url.trim() || null,
      start_at: draft.start_at ? new Date(draft.start_at).toISOString() : null,
      end_at: draft.end_at ? new Date(draft.end_at).toISOString() : null,
      is_active: draft.is_active,
    };

    try {
      if (mode === "edit" && id) {
        await updateBanner(id, payload);
      } else {
        await createBanner(payload);
      }
      setDirty(false);
      onSaved();
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.status === 422 &&
        reason.details
      ) {
        const mapped: Record<string, string> = {};
        for (const [key, messages] of Object.entries(reason.details)) {
          if (messages?.[0]) mapped[key] = messages[0];
        }
        setErrors(mapped);
      } else {
        setSubmitError(errorMessage(reason));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved banner modifications?")) {
      return;
    }
    onCancel();
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm" role="status">
        Loading banner details…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-4 text-red-800"
        role="alert"
      >
        <span>{loadError}</span>
        <button
          type="button"
          className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-xl text-xs font-semibold cursor-pointer !min-h-0 !shadow-none !transform-none"
          onClick={onCancel}
        >
          Back to banners
        </button>
      </div>
    );
  }

  return (
    <section className="w-full space-y-6">
      {/* Breadcrumb Navigation */}
      <nav
        className="flex items-center gap-1.5 text-xs text-slate-400 font-medium select-none"
        aria-label="Breadcrumb"
      >
        <span>CMS</span>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          onClick={cancel}
          className="text-slate-500 hover:text-orange-600 transition-colors cursor-pointer !bg-transparent !p-0 !min-h-0 !border-0 !shadow-none !transform-none"
        >
          Banners
        </button>
        <span aria-hidden="true">/</span>
        <span className="text-slate-700 font-semibold">
          {mode === "edit" ? "Edit Banner" : "Add Banner"}
        </span>
      </nav>

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight m-0">
            {mode === "edit" ? "Edit Banner" : "Add Banner"}
          </h1>
        </div>
        <button
          type="button"
          onClick={cancel}
          disabled={desktopUploading || mobileUploading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 !bg-white hover:!bg-slate-50 !text-slate-700 font-medium text-xs shadow-2xs transition-colors cursor-pointer !min-h-0 !shadow-none !transform-none"
        >
          <ArrowLeft size={15} />
          <span>Back to Banners</span>
        </button>
      </div>

      {/* Main Form */}
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-8"
      >
        {/* SECTION 1: GENERAL INFORMATION & REDIRECT DESTINATION */}
        <div className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 m-0">
            1. Placement & Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 mt-4">
            {/* Title */}
            <div className="sm:col-span-6 flex flex-col gap-1.5">
              <label
                htmlFor="banner-title"
                className="text-[13px] flex items-center gap-1.5 font-semibold text-slate-700"
              >
                Banner Title <span className="text-red-500">*</span>
              </label>
              <input
                id="banner-title"
                value={draft.title}
                onChange={(event) => change("title", event.target.value)}
                maxLength={255}
                required
                placeholder="e.g., Summer Fitness Mega Sale"
                aria-invalid={Boolean(errors.title)}
                className="w-full h-11 px-3.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs"
              />
              {errors.title && (
                <span className="text-xs font-medium text-red-600">
                  {errors.title}
                </span>
              )}
            </div>

            {/* Target Page */}
            <div className="sm:col-span-3 flex flex-col gap-1.5">
              <label
                htmlFor="banner-page"
                className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5 "
              >
                Target Page <span className="text-red-500">*</span>
              </label>
              <select
                id="banner-page"
                value={draft.page}
                onChange={(event) => change("page", event.target.value)}
                required
                aria-invalid={Boolean(errors.page)}
                className="w-full h-11 px-3 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs cursor-pointer capitalize"
              >
                <option value="landing">Landing Page</option>
                <option value="listing">Listing Page</option>
              </select>
              {errors.page && (
                <span className="text-xs font-medium text-red-600">
                  {errors.page}
                </span>
              )}
            </div>

            {/* Sort Order */}
            <div className="sm:col-span-3 flex flex-col gap-1.5">
              <label
                htmlFor="banner-sort"
                className="text-[13px] font-semibold text-slate-700"
              >
                Sort Order
              </label>
              <input
                id="banner-sort"
                type="number"
                min="0"
                value={draft.sort_order}
                onChange={(event) =>
                  change("sort_order", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.sort_order)}
                className="w-full h-11 px-3.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs font-mono"
              />
              {errors.sort_order && (
                <span className="text-xs font-medium text-red-600">
                  {errors.sort_order}
                </span>
              )}
            </div>

            <div className="sm:col-span-12 flex flex-col gap-1.5">
              <label
                htmlFor="banner-description"
                className="text-[13px] font-semibold text-slate-700"
              >
                Hero Description
              </label>
              <textarea
                id="banner-description"
                value={draft.description}
                onChange={(event) => change("description", event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Short supporting copy shown over the banner image"
                aria-invalid={Boolean(errors.description)}
                className="w-full px-3.5 py-3 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs resize-y"
              />
              {errors.description && (
                <span className="text-xs font-medium text-red-600">
                  {errors.description}
                </span>
              )}
            </div>

            <div className="sm:col-span-4 flex flex-col gap-1.5">
              <label
                htmlFor="banner-cta-text"
                className="text-[13px] font-semibold text-slate-700"
              >
                Button Text
              </label>
              <input
                id="banner-cta-text"
                value={draft.cta_text}
                onChange={(event) => change("cta_text", event.target.value)}
                maxLength={120}
                placeholder="e.g., Explore equipment"
                aria-invalid={Boolean(errors.cta_text)}
                aria-describedby="banner-cta-help"
                className="w-full h-11 px-3.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs"
              />
              <span id="banner-cta-help" className="text-xs text-slate-500">
                {draft.cta_text.trim() && !draft.redirect_url.trim()
                  ? "Add a destination URL to display this button on the storefront."
                  : "Displayed on the storefront when a destination URL is set."}
              </span>
              {errors.cta_text && (
                <span className="text-xs font-medium text-red-600">
                  {errors.cta_text}
                </span>
              )}
            </div>

            <div className="sm:col-span-8 flex flex-col gap-1.5">
              <label
                htmlFor="banner-url"
                className="text-[13px] font-semibold text-slate-700 flex items-center justify-between"
              >
                <span>Destination / Redirect URL</span>
                <span className="text-xs font-normal text-slate-400">
                  Optional destination for the banner button
                </span>
              </label>
              <div className="relative flex items-center w-full">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                  <Link2 size={16} aria-hidden="true" />
                </div>
                <input
                  id="banner-url"
                  type="url"
                  value={draft.redirect_url}
                  onChange={(event) =>
                    change("redirect_url", event.target.value)
                  }
                  placeholder="https://durafit.in/collections/treadmills"
                  aria-invalid={Boolean(errors.redirect_url)}
                  className="w-full h-11 pl-10 pr-4 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs font-mono text-xs sm:text-sm"
                />
              </div>
              {errors.redirect_url && (
                <span className="text-xs font-medium text-red-600">
                  {errors.redirect_url}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: BANNER CREATIVES (BALANCED 2-COLUMN LAYOUT) */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 m-0">
              2. Banner Creatives
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 m-0">
              Provide optimized visual media tailored for desktop and mobile
              viewports.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Desktop Banner Field */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Desktop Creative <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  1920 × 600 px recommended
                </span>
              </div>
              <BannerMediaField
                label="Desktop Banner"
                selected={desktopMedia}
                saved={savedBanner?.desktop_media}
                error={errors.desktop_media_id}
                onSelect={(media) => {
                  setDesktopMedia(media);
                  change("desktop_media_id", media.id);
                }}
                onBusyChange={setDesktopUploading}
              />
            </div>

            {/* Mobile Banner Field */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Mobile Creative <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  768 × 600 px recommended
                </span>
              </div>
              <BannerMediaField
                label="Mobile Banner"
                selected={mobileMedia}
                saved={savedBanner?.mobile_media}
                error={errors.mobile_media_id}
                onSelect={(media) => {
                  setMobileMedia(media);
                  change("mobile_media_id", media.id);
                }}
                onBusyChange={setMobileUploading}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: CAMPAIGN SCHEDULE & VISIBILITY */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 m-0">
            3. Campaign Schedule & Visibility
          </h2>

          <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="start_at"
                  className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Calendar size={14} className="text-slate-400" />
                  <span>Start Date & Time</span>
                </label>
                <input
                  id="start_at"
                  type="datetime-local"
                  value={draft.start_at}
                  onChange={(event) => change("start_at", event.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 outline-none shadow-2xs"
                />
                {errors.start_at && (
                  <span className="text-xs font-medium text-red-600">
                    {errors.start_at}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="end_at"
                  className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Calendar size={14} className="text-slate-400" />
                  <span>End Date & Time</span>
                </label>
                <input
                  id="end_at"
                  type="datetime-local"
                  value={draft.end_at}
                  onChange={(event) => change("end_at", event.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:border-orange-500 outline-none shadow-2xs"
                />
                {errors.end_at && (
                  <span className="text-xs font-medium text-red-600">
                    {errors.end_at}
                  </span>
                )}
              </div>
            </div>

            {/* Active Status Checkbox */}
            <div className="pt-3 border-t border-slate-200/60">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(event) =>
                    change("is_active", event.target.checked)
                  }
                  className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Active in storefront immediately
                </span>
              </label>
              <p className="text-xs text-slate-400 ml-6.5 mt-0.5">
                When unchecked, this banner remains hidden from customer-facing
                storefronts.
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <div
            className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-800"
            role="alert"
          >
            {submitError}
          </div>
        )}

        {/* BOTTOM FORM ACTIONS */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancel}
            disabled={submitting || desktopUploading || mobileUploading}
            className="px-5 py-2.5 rounded-xl border border-slate-200 !text-slate-700 font-semibold text-sm hover:!bg-slate-50 transition-colors cursor-pointer !bg-white !min-h-0 !shadow-none !transform-none"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || desktopUploading || mobileUploading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold text-sm shadow-xs hover:shadow-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer !min-h-0 !transform-none"
          >
            <Save size={16} aria-hidden="true" />
            <span>
              {submitting
                ? "Saving…"
                : desktopUploading || mobileUploading
                  ? "Uploading images…"
                  : mode === "edit"
                    ? "Update Banner"
                    : "Create Banner"}
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
