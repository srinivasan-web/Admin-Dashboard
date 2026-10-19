import { type FormEvent, useState } from "react";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { errorMessage } from "../../api/client";
import { BannerMediaField } from "../banners/BannerMediaField";
import type { BannerMedia } from "../banners/bannersApi";
import { saveMaster } from "./catalogApi";
import type { Master } from "./types";

type MasterPath = "brands" | "categories" | "product-types";
type Props = {
  path: MasterPath;
  title: string;
  selected?: Master;
  onSaved: () => void;
  onCancel: () => void;
};

export function MasterForm({
  path,
  title,
  selected,
  onSaved,
  onCancel,
}: Props) {
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<BannerMedia | undefined>(selected?.image_media ?? undefined);
  const [mediaBusy, setMediaBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mediaBusy) return;
    const data = new FormData(event.currentTarget);
    setError(undefined);
    setSubmitting(true);
    try {
      await saveMaster(
        path,
        {
          name: data.get("name"),
          slug: data.get("slug") || null,
          description: data.get("description") || null,
          is_active: data.get("is_active") === "active",
          ...(path === "categories" || path === "product-types" ? {
            image_media_id: selectedMedia?.id ?? null,
            sort_order: Number(data.get("sort_order") ?? 0),
          } : {}),
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

  const sectionTitle =
    path === "categories"
      ? "CATEGORY INFORMATION"
      : path === "product-types"
        ? "PRODUCT TYPE INFORMATION"
        : `${title.toUpperCase()} INFORMATION`;

  const sectionDescription =
    path === "categories"
      ? "Define the category classification and catalog metadata."
      : path === "product-types"
        ? "Create the basic information for this catalog entity."
        : `Enter the core details for this ${title.toLowerCase()}.`;

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
          {sectionTitle}
        </h2>
        <p className="text-[13px] font-normal leading-[18px] text-slate-500 mt-1 m-0">
          {sectionDescription}
        </p>
      </div>

      <div className="space-y-5">
        {/* Name and Slug Row - 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="master-name"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none flex items-center gap-1"
            >
              <span>{title} Name</span>
              <span className="text-orange-500 font-bold" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="master-name"
              name="name"
              defaultValue={selected?.name}
              required
              placeholder={`Enter ${title.toLowerCase()} name`}
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor="master-slug"
              className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
            >
              Slug
            </label>
            <input
              id="master-slug"
              name="slug"
              defaultValue={selected?.slug}
              placeholder="e.g. cardio-equipment"
              disabled={submitting}
              className="w-full h-11 px-3.5 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        {path !== "brands" && (
          <>
            {/* Status Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <label
                htmlFor="master-status"
                className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
              >
                Status
              </label>
              <div className="relative flex items-center w-full">
                <select
                  id="master-status"
                  name="is_active"
                  defaultValue={
                    selected?.is_active === false ? "inactive" : "active"
                  }
                  disabled={submitting}
                  className="w-full h-11 pl-3.5 pr-10 text-[14px] leading-[20px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3.5 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Description Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <label
                htmlFor="master-description"
                className="text-[13px] font-medium leading-[20px] text-slate-700 select-none"
              >
                Description
              </label>
              <textarea
                id="master-description"
                name="description"
                rows={4}
                defaultValue={selected?.description ?? ""}
                placeholder={`Describe the ${title.toLowerCase()}...`}
                disabled={submitting}
                className="w-full min-h-[120px] p-3.5 text-[14px] leading-[22px] bg-white rounded-[10px] border border-slate-200/90 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 shadow-2xs transition-all duration-150 outline-none resize-y placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </>
        )}

        {(path === "categories" || path === "product-types") && (
          <div className="grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 md:grid-cols-[180px_minmax(0,1fr)]">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-slate-700" htmlFor={path === "categories" ? "category-sort-order" : "product-type-sort-order"}>
              Display order
              <input
                id={path === "categories" ? "category-sort-order" : "product-type-sort-order"}
                name="sort_order"
                type="number"
                min="0"
                max="4294967295"
                defaultValue={selected?.sort_order ?? 0}
                disabled={submitting}
                className="h-11 rounded-[10px] border border-slate-200 px-3.5 text-[14px] focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </label>
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate-700">{title} image</p>
              <BannerMediaField
                label={`${title} image`}
                selected={selectedMedia}
                saved={selected?.image_media ?? undefined}
                onSelect={(media) => {
                  setSelectedMedia(media);
                  setIsDirty(true);
                }}
                onBusyChange={setMediaBusy}
              />
              {selectedMedia && (
                <button type="button" className="mt-2 text-xs font-medium text-red-700 underline" onClick={() => {
                  setSelectedMedia(undefined);
                  setIsDirty(true);
                }}>Remove {title.toLowerCase()} image</button>
              )}
            </div>
          </div>
        )}

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
            disabled={submitting || mediaBusy}
            className="w-full sm:w-auto h-11 px-5 text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-[10px] shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || mediaBusy}
            aria-busy={submitting || mediaBusy}
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
              <span>{selected ? "Save changes" : `Create ${title}`}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
