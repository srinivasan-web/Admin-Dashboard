import type { ReactNode } from "react";

type Props = {
  items: string[];
};

export function Breadcrumb({ items }: Props) {
  return (
    <nav className="breadcrumb flex items-center gap-1.5 text-[12px] font-normal leading-[18px] text-slate-500 mb-2" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-slate-400 select-none" aria-hidden="true">›</span>}
          {index === items.length - 1 ? (
            <span className="font-semibold text-slate-800">{item}</span>
          ) : (
            <span className="text-slate-500">{item}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageActions({ children }: { children: ReactNode }) {
  return <div className="header-actions flex items-center gap-3">{children}</div>;
}
