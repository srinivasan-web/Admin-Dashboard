import type { ReactNode } from "react";
import { Breadcrumb } from "./Breadcrumb";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb: string[];
  eyebrow?: string;
}) {
  return (
    <div className="page-header-container mb-6">
      <Breadcrumb items={breadcrumb} />
      <div className="workspace-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-1">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[11px] font-semibold leading-[16px] uppercase tracking-wider text-orange-600 mb-1">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[28px] font-bold leading-[36px] tracking-tight text-slate-900 m-0">
            {title}
          </h1>
          {description && (
            <p className="page-intro text-[14px] font-normal leading-[20px] text-slate-500 mt-1 m-0">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="header-actions flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
