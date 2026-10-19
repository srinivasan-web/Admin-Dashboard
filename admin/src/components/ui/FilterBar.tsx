import type { ReactNode } from "react";

export function FilterBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`filter-bar flex flex-wrap items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 mb-4 transition-colors ${className}`.trim()}
    >
      {children}
    </div>
  );
}
