import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Images, Search, UploadCloud } from "lucide-react";
import { errorMessage } from "../../api/client";
import { listMedia, uploadMedia, type BannerMedia } from "./bannersApi";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

export function BannerMediaField({
  label,
  selected,
  saved,
  error,
  onSelect,
  onBusyChange,
}: {
  label: string;
  selected?: BannerMedia;
  saved?: BannerMedia;
  error?: string;
  onSelect: (media: BannerMedia) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [library, setLibrary] = useState<BannerMedia[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string>();
  const errorId = `${label.toLowerCase().replaceAll(" ", "-")}-error`;

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!libraryOpen) return;
    let active = true;
    setLibraryLoading(true);
    setLibraryError(undefined);
    void listMedia(debouncedSearch, page)
      .then((response) => {
        if (!active) return;
        setLibrary(response.data);
        setLastPage(response.meta.last_page);
      })
      .catch((reason) => {
        if (active) setLibraryError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLibraryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [libraryOpen, debouncedSearch, page]);

  async function chooseFile(file?: File) {
    if (!file || uploading) return;
    if (!allowedTypes.has(file.type) || file.size > maxBytes) {
      setUploadError("Choose a JPG, PNG, or WebP image up to 5 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploading(true);
    onBusyChange(true);
    setUploadError(undefined);
    try {
      const response = await uploadMedia(file);
      onSelect(response.data);
    } catch (reason) {
      setUploadError(errorMessage(reason));
    } finally {
      URL.revokeObjectURL(url);
      setPreviewUrl(undefined);
      setUploading(false);
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  }

  const currentDisplayUrl = previewUrl ?? selected?.url;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Dropzone Card */}
      <div
        className={`banner-dropzone relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[140px] ${
          dragging
            ? "is-dragging border-orange-500 bg-orange-50/50"
            : "border-slate-200 hover:border-orange-300 bg-white hover:bg-slate-50/70"
        }`}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void chooseFile(event.dataTransfer.files[0]);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        aria-describedby={error || uploadError ? errorId : undefined}
      >
        {currentDisplayUrl ? (
          <div className="relative w-full flex flex-col items-center">
            <img
              src={currentDisplayUrl}
              alt={`${label} preview`}
              className="max-h-36 w-full object-contain rounded-lg border border-slate-100"
            />
            <div className="mt-2 text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1.5">
              <UploadCloud size={14} />
              <span>
                {uploading ? "Uploading…" : "Click or drop to replace image"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
              <ImageIcon size={22} aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold text-slate-700">
              Click to upload or drag & drop
            </span>
            <span className="text-[11px] text-slate-400">
              JPG, PNG, or WebP up to 5 MB
            </span>
          </div>
        )}
      </div>

      <input
        ref={input}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
        }}
        aria-label={`Upload ${label.toLowerCase()}`}
      />

      {/* Media Library Selector Action */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setLibraryOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 !text-slate-700 hover:!bg-slate-50 !bg-white transition-colors cursor-pointer shadow-2xs !min-h-0 !shadow-none !transform-none"
        >
          <Images size={14} className="text-slate-400" />
          <span>
            {libraryOpen ? "Close Media Library" : "Choose from Library"}
          </span>
        </button>

        {selected && (
          <span
            className="text-[11px] text-slate-500 truncate max-w-[200px]"
            title={selected.original_filename ?? selected.id}
          >
            Selected: {selected.original_filename ?? selected.id}
          </span>
        )}
      </div>

      {saved && selected?.id !== saved.id && (
        <p className="text-[11px] text-slate-400 m-0">
          Saved image remains until you submit updates.
        </p>
      )}

      {(error || uploadError) && (
        <span
          id={errorId}
          className="text-xs font-medium text-red-600"
          role="alert"
        >
          {error || uploadError}
        </span>
      )}

      {/* Media Library Drawer */}
      {libraryOpen && (
        <div className="mt-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              aria-label={`Search images for ${label.toLowerCase()}`}
              placeholder="Search library images…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-full h-8.5 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-orange-500"
            />
          </div>

          {libraryLoading && (
            <p className="text-xs text-slate-400 text-center py-4" role="status">
              Loading library images…
            </p>
          )}

          {libraryError && (
            <p className="text-xs text-red-600 text-center" role="alert">
              {libraryError}
            </p>
          )}

          {!libraryLoading && !libraryError && library.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              No images found in library.
            </p>
          )}

          {!libraryLoading && !libraryError && library.length > 0 && (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {library.map((media) => {
                const isSelected = selected?.id === media.id;
                return (
                  <button
                    type="button"
                    key={media.id}
                    className={`banner-lib-item ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      onSelect(media);
                      setLibraryOpen(false);
                    }}
                    title={media.original_filename ?? media.id}
                  >
                    <img src={media.url} alt={media.original_filename ?? "Media"} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Library Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Page {page} of {lastPage}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 rounded border border-slate-200 !bg-white disabled:opacity-40 !text-slate-700 !min-h-0 !p-1 !shadow-none !transform-none cursor-pointer"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 rounded border border-slate-200 !bg-white disabled:opacity-40 !text-slate-700 !min-h-0 !p-1 !shadow-none !transform-none cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
