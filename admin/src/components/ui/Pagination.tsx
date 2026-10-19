import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  perPage?: number;
  totalCount?: number;
  isLoading?: boolean;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  perPage,
  totalCount,
  isLoading = false,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1 && totalCount === undefined) {
    return null;
  }

  const startRecord = perPage && totalCount ? (page - 1) * perPage + 1 : undefined;
  const endRecord =
    perPage && totalCount ? Math.min(page * perPage, totalCount) : undefined;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200/80 rounded-b-xl text-xs text-slate-500 ${className}`.trim()}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {totalCount !== undefined && startRecord && endRecord ? (
          <span>
            Showing <strong className="text-slate-800 font-semibold">{startRecord}</strong> to{" "}
            <strong className="text-slate-800 font-semibold">{endRecord}</strong> of{" "}
            <strong className="text-slate-800 font-semibold">{totalCount}</strong> results
          </span>
        ) : (
          <span>
            Page <strong className="text-slate-800 font-semibold">{page}</strong> of{" "}
            <strong className="text-slate-800 font-semibold">{Math.max(totalPages, 1)}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
