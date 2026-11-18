import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ExternalLink,
  Eye,
  PencilLine,
  Plus,
  Power,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { apiRequest, errorMessage } from "../../api/client";
import { StatusBadge } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { BannerForm } from "./BannerForm";
import {
  deleteBanner,
  listBanners,
  updateBanner,
  type Banner,
} from "./bannersApi";
import "./banners.css";

type Placement = "all" | "landing" | "listing";

function scheduleLabel(banner: Banner): string {
  if (!banner.start_at && !banner.end_at) return "Unscheduled";
  const now = Date.now();
  const start = banner.start_at ? new Date(banner.start_at).getTime() : null;
  const end = banner.end_at ? new Date(banner.end_at).getTime() : null;
  if (start && now < start) return "Upcoming";
  if (end && now > end) return "Expired";
  return "Current";
}

function dateLabel(value: string | null): string {
  if (!value) return "Open";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BannersPage({
  mode = "list",
  id,
  onCreate,
  onEdit,
  onList,
}: {
  mode?: "list" | "create" | "edit";
  id?: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onList: () => void;
}) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [scheduling, setScheduling] = useState<
    "all" | "current" | "upcoming" | "expired" | "unscheduled"
  >("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [placement, setPlacement] = useState<Placement>("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const pageSize = 10;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ data: Array<{ id: string; name: string }> }>("/categories"),
      apiRequest<{ data: Array<{ id: string; name: string }> }>("/product-types"),
    ]).then(([categories, types]) => {
      if (active) setTargetNames(Object.fromEntries([...categories.data, ...types.data].map((record) => [record.id, record.name])));
    }).catch(() => { /* The banner list remains usable while target names load. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (mode !== "list") return;
    let active = true;
    setLoading(true);
    setError(undefined);
    void listBanners({
      search: debouncedSearch || undefined,
      status: status === "all" ? undefined : status,
      scheduling: scheduling === "all" ? undefined : scheduling,
      sort_order: sortOrder,
    })
      .then((data) => {
        if (active) setBanners(data);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, debouncedSearch, status, scheduling, sortOrder, reloadKey]);

  const counts = useMemo(() => {
    let landing = 0;
    let listing = 0;
    for (const b of banners) {
      const p = b.page?.trim().toLowerCase();
      if (p === "landing") landing++;
      else if (p === "listing") listing++;
    }
    return { all: banners.length, landing, listing };
  }, [banners]);

  const filtered = useMemo(
    () =>
      banners.filter(
        (banner) =>
          placement === "all" ||
          banner.page?.trim().toLowerCase() === placement,
      ),
    [banners, placement],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function reset() {
    setSearch("");
    setStatus("all");
    setScheduling("all");
    setSortOrder("asc");
    setPlacement("all");
    setPage(1);
  }

  async function toggleStatus(banner: Banner) {
    setBusyId(banner.id);
    setError(undefined);
    try {
      await updateBanner(banner.id, { is_active: !banner.is_active });
      const msg = `${banner.title} ${banner.is_active ? "deactivated" : "activated"}.`;
      setNotice(msg);
      toast.success(msg);
      setReloadKey((key) => key + 1);
    } catch (reason) {
      const err = errorMessage(reason);
      setError(err);
      toast.error(err);
    } finally {
      setBusyId(undefined);
    }
  }

  async function remove(banner: Banner) {
    if (
      !window.confirm(
        `Delete “${banner.title}”? The linked media files will be kept.`,
      )
    )
      return;
    setBusyId(banner.id);
    setError(undefined);
    try {
      await deleteBanner(banner.id);
      const msg = `${banner.title} deleted.`;
      setNotice(msg);
      toast.success(msg);
      if (visible.length === 1 && page > 1) setPage((current) => current - 1);
      setReloadKey((key) => key + 1);
    } catch (reason) {
      const err = errorMessage(reason);
      setError(err);
      toast.error(err);
    } finally {
      setBusyId(undefined);
    }
  }

  if (mode === "create" || mode === "edit") {
    return (
      <BannerForm
        key={mode === "edit" ? id : "create"}
        mode={mode}
        id={id}
        onCancel={onList}
        onSaved={() => {
          const msg = mode === "edit" ? "Banner updated." : "Banner created.";
          setNotice(msg);
          toast.success(msg);
          setReloadKey((key) => key + 1);
          onList();
        }}
      />
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
        <span className="text-slate-700 font-semibold">Banners</span>
      </nav>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight m-0">
            Banners
          </h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm font-semibold shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} aria-hidden="true" />
          <span>Add Banner</span>
        </button>
      </div>

      {notice && (
        <div
          className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-xl text-[13px] font-medium text-emerald-800 flex items-center justify-between"
          role="status"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(undefined)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-semibold underline cursor-pointer ml-4 !bg-transparent !p-0 !min-h-0 !border-0 !shadow-none !transform-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          className="p-4 bg-red-50/90 border border-red-200/90 rounded-xl flex items-center justify-between gap-4 text-red-800"
          role="alert"
        >
          <span className="text-sm font-medium">{error}</span>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Placement Tabs */}
        <div
          className="flex items-center gap-1 border-b border-slate-200/80 px-6 pt-2 bg-white overflow-x-auto select-none"
          role="tablist"
          aria-label="Banner page placement"
        >
          {(
            [
              { id: "all", label: "All", count: counts.all },
              { id: "landing", label: "Landing Page", count: counts.landing },
              { id: "listing", label: "Listing Page", count: counts.listing },
            ] as const
          ).map((tab) => {
            const active = placement === tab.id;
            return (
              <button
                type="button"
                role="tab"
                key={tab.id}
                aria-selected={active}
                onClick={() => {
                  setPlacement(tab.id);
                  setPage(1);
                }}
                className={`banner-tab-btn relative px-4 py-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer !bg-transparent !border-0 !shadow-none !transform-none !min-h-0 flex items-center gap-2 ${
                  active
                    ? "!text-orange-600 font-semibold"
                    : "!text-slate-500 hover:!text-slate-800"
                }`}
              >
                <span>{tab.label}</span>
              
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-t-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Filter Toolbar - Single Clean Responsive Row */}
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-3 bg-slate-50/60 border-b border-slate-200/80">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[100px]">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              aria-label="Search banners"
              placeholder="Search banners by title…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-3 text-sm bg-white rounded-xl border border-slate-200 text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors shadow-2xs"
            />
          </div>

          {/* Filter Controls Group */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
            <select
              aria-label="Filter banner status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
              className="banner-filter-select h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-orange-500 shadow-2xs cursor-pointer flex-1 sm:flex-none w-full sm:w-[135px]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              aria-label="Filter banner schedule"
              value={scheduling}
              onChange={(event) => {
                setScheduling(event.target.value as typeof scheduling);
                setPage(1);
              }}
              className="banner-filter-select h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-orange-500 shadow-2xs cursor-pointer flex-1 sm:flex-none w-full sm:w-[145px]"
            >
              <option value="all">All schedules</option>
              <option value="current">Current</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
              <option value="unscheduled">Unscheduled</option>
            </select>

         

            <button
              type="button"
              onClick={reset}
              title="Reset all filters"
              className="h-10 px-3.5 text-xs sm:text-sm font-medium !bg-white border border-slate-200 !text-slate-600 hover:!text-slate-900 hover:!bg-slate-50 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer flex-none !min-h-0 !transform-none !shadow-none"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-14 text-center text-slate-400 text-sm" role="status">
            Loading banners…
          </div>
        ) : error ? null : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="text-base font-semibold text-slate-800 m-0">
              {banners.length ? "No matching banners" : "No banners yet"}
            </h2>
            <p className="text-sm text-slate-400 mt-1 mb-4">
              {banners.length
                ? "Try clearing filters or search terms."
                : "Create your first promotional banner to showcase in the storefront."}
            </p>
            {!banners.length && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white font-semibold text-xs shadow-xs hover:bg-orange-700 transition-colors cursor-pointer"
              >
                <Plus size={15} /> Add Banner
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Desktop Image</th>
                    <th className="py-3 px-4">Mobile Image</th>
                    <th className="py-3 px-4 text-center w-20">Sort</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">User Info</th>
                    <th className="py-3 px-4 text-center pr-3" aria-label="Actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((banner, index) => {
                    const rowNum = (page - 1) * pageSize + index + 1;
                    const sched = scheduleLabel(banner);

                    return (
                      <tr
                        key={banner.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-xs">
                          {rowNum}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {banner.title}
                          </div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 capitalize">
                            {banner.page ?? "unassigned"}
                          </span>
                          {banner.category_id && <span className="ml-1 text-[11px] text-slate-500">Category: {targetNames[banner.category_id] ?? "Loading…"}</span>}
                          {banner.product_type_id && <span className="ml-1 text-[11px] text-slate-500">Equipment: {targetNames[banner.product_type_id] ?? "Loading…"}</span>}
                        </td>

                        <td className="py-3.5 px-4">
                          {banner.desktop_media?.url ? (
                            <img
                              className="w-16 h-11 object-cover rounded-lg border border-slate-200 bg-slate-50 shadow-2xs"
                              src={banner.desktop_media.url}
                              alt={`${banner.title} desktop`}
                            />
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              None
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {banner.mobile_media?.url ? (
                            <img
                              className="w-12 h-14 object-cover rounded-lg border border-slate-200 bg-slate-50 shadow-2xs"
                              src={banner.mobile_media.url}
                              alt={`${banner.title} mobile`}
                            />
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              None
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-700">
                          {banner.sort_order}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 leading-tight">
                            {sched}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar size={11} aria-hidden="true" />
                            <span>
                              {dateLabel(banner.start_at)} →{" "}
                              {dateLabel(banner.end_at)}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge active={Boolean(banner.is_active)} />
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 text-xs">
                          Not recorded
                        </td>

                        {/* Actions Column: Single Clean Horizontal Line */}
                        <td className="py-3.5 px-4 text-center pr-3">
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            {/* Preview Action */}
                            <button
                              type="button"
                              className="banner-action-btn"
                              title="Preview banner"
                              aria-label={`Preview ${banner.title}`}
                              onClick={() => {
                                setPreviewBanner(banner);
                                setPreviewMode("desktop");
                              }}
                            >
                              <Eye size={15} aria-hidden="true" />
                            </button>

                            {/* Edit Action */}
                            <button
                              type="button"
                              className="banner-action-btn"
                              title="Edit banner"
                              aria-label={`Edit ${banner.title}`}
                              onClick={() => onEdit(banner.id)}
                              disabled={busyId === banner.id}
                            >
                              <PencilLine size={15} aria-hidden="true" />
                            </button>

                            {/* Activate / Deactivate Toggle */}
                            <button
                              type="button"
                              className="banner-action-btn"
                              title={
                                banner.is_active
                                  ? "Deactivate banner"
                                  : "Activate banner"
                              }
                              aria-label={
                                banner.is_active
                                  ? `Deactivate ${banner.title}`
                                  : `Activate ${banner.title}`
                              }
                              onClick={() => void toggleStatus(banner)}
                              disabled={busyId === banner.id}
                            >
                              <Power
                                size={15}
                                className={
                                  banner.is_active ? "power-on" : "power-off"
                                }
                                aria-hidden="true"
                              />
                            </button>

                            {/* Delete Action */}
                            <button
                              type="button"
                              className="banner-action-btn danger"
                              title={`Delete ${banner.title}`}
                              aria-label={`Delete ${banner.title}`}
                              onClick={() => void remove(banner)}
                              disabled={busyId === banner.id}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 sm:px-6 flex items-center justify-between border-t border-slate-200/80 text-xs text-slate-500">
              <span>
                {filtered.length} banner{filtered.length === 1 ? "" : "s"} · Page{" "}
                {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer !min-h-0 !p-1.5 !px-3"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer !min-h-0 !p-1.5 !px-3"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Interactive Banner Preview Modal */}
      {previewBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          onClick={() => setPreviewBanner(null)}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2
                  id="preview-modal-title"
                  className="text-base font-bold text-slate-900 m-0"
                >
                  {previewBanner.title}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                  {previewBanner.page ?? "unassigned"}
                </span>
                <StatusBadge active={Boolean(previewBanner.is_active)} />
              </div>

              {/* Viewport Switcher & Close */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer !min-h-0 !border-0 !shadow-none !transform-none ${
                      previewMode === "desktop"
                        ? "!bg-white !text-slate-900 font-semibold shadow-2xs"
                        : "!bg-transparent !text-slate-600 hover:!text-slate-900"
                    }`}
                  >
                    Desktop (1920×600)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer !min-h-0 !border-0 !shadow-none !transform-none ${
                      previewMode === "mobile"
                        ? "!bg-white !text-slate-900 font-semibold shadow-2xs"
                        : "!bg-transparent !text-slate-600 hover:!text-slate-900"
                    }`}
                  >
                    Mobile (768×600)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewBanner(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer !min-h-0 !p-0 !border-0 !bg-transparent !shadow-none !transform-none"
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Media Preview Box */}
              <div className="bg-slate-100 rounded-xl p-3 flex items-center justify-center border border-slate-200/80 min-h-[220px]">
                {previewMode === "desktop" ? (
                  previewBanner.desktop_media?.url ? (
                    <img
                      src={previewBanner.desktop_media.url}
                      alt={`${previewBanner.title} desktop preview`}
                      className="w-full max-h-[340px] object-contain rounded-lg shadow-2xs"
                    />
                  ) : (
                    <div className="text-slate-400 text-sm">
                      No desktop creative attached
                    </div>
                  )
                ) : previewBanner.mobile_media?.url ? (
                  <img
                    src={previewBanner.mobile_media.url}
                    alt={`${previewBanner.title} mobile preview`}
                    className="max-w-[320px] max-h-[380px] object-contain rounded-lg shadow-2xs"
                  />
                ) : (
                  <div className="text-slate-400 text-sm">
                    No mobile creative attached
                  </div>
                )}
              </div>

              {/* Banner Attributes Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-slate-400 font-medium block">
                    Redirect Destination
                  </span>
                  {previewBanner.redirect_url ? (
                    <a
                      href={previewBanner.redirect_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-orange-600 hover:underline flex items-center gap-1 mt-1 truncate"
                    >
                      <span className="truncate">{previewBanner.redirect_url}</span>
                      <ExternalLink size={12} className="flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-600 font-medium mt-1 block">
                      None (Non-clickable)
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-slate-400 font-medium block">
                    Schedule Period
                  </span>
                  <span className="text-slate-700 font-medium mt-1 block">
                    {dateLabel(previewBanner.start_at)} →{" "}
                    {dateLabel(previewBanner.end_at)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-slate-400 font-medium block">
                    Sort Priority
                  </span>
                  <span className="text-slate-700 font-mono font-medium mt-1 block">
                    #{previewBanner.sort_order}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setPreviewBanner(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors cursor-pointer !min-h-0 !shadow-none !transform-none !bg-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToEdit = previewBanner.id;
                  setPreviewBanner(null);
                  onEdit(idToEdit);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer !min-h-0 !shadow-none !transform-none"
              >
                <PencilLine size={13} />
                <span>Edit Banner</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
