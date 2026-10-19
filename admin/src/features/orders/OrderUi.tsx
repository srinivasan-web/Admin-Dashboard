import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

const tones: Record<string, string> = {
  active: "!bg-blue-50 !text-blue-700 !ring-blue-200",
  expired: "!bg-amber-50 !text-amber-700 !ring-amber-200",
  released: "!bg-slate-100 !text-slate-700 !ring-slate-200",
  committed: "!bg-emerald-50 !text-emerald-700 !ring-emerald-200",
  success: "!bg-emerald-50 !text-emerald-700 !ring-emerald-200",
  restored: "!bg-amber-50 !text-amber-700 !ring-amber-200",
  paid: "!bg-emerald-50 !text-emerald-700 !ring-emerald-200",
  completed: "!bg-emerald-50 !text-emerald-700 !ring-emerald-200",
  delivered: "!bg-emerald-50 !text-emerald-700 !ring-emerald-200",
  confirmed: "!bg-blue-50 !text-blue-700 !ring-blue-200",
  authorized: "!bg-blue-50 !text-blue-700 !ring-blue-200",
  processing: "!bg-indigo-50 !text-indigo-700 !ring-indigo-200",
  shipped: "!bg-indigo-50 !text-indigo-700 !ring-indigo-200",
  pending: "!bg-amber-50 !text-amber-700 !ring-amber-200",
  hold: "!bg-amber-50 !text-amber-700 !ring-amber-200",
  failed: "!bg-red-50 !text-red-700 !ring-red-200",
  cancelled: "!bg-red-50 !text-red-700 !ring-red-200",
  abandoned: "!bg-slate-100 !text-slate-700 !ring-slate-200",
  refunded: "!bg-purple-50 !text-purple-700 !ring-purple-200",
};

export function OrderStatusBadge({ status }: { status: string | null }) {
  const value = status ?? "Unavailable";
  const tone = status?.toLowerCase() ?? "";
  return (
    <span
      className={`!inline-flex !w-fit !items-center !rounded-full !px-2.5 !py-1 !text-xs !font-semibold !capitalize !ring-1 !ring-inset ${tones[tone] ?? "!bg-slate-100 !text-slate-600 !ring-slate-200"}`}
    >
      {value.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}

export function OrdersPageHeader({
  title,
  description,
  trail,
  actions,
}: {
  title: string;
  description: string;
  trail: string[];
  actions?: ReactNode;
}) {
  return (
    <header className="!mb-6">
      <nav
        aria-label="Breadcrumb"
        className="!mb-3 !flex !flex-wrap !items-center !gap-1 !text-xs !font-medium !text-slate-500"
      >
        {trail.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="!inline-flex !items-center !gap-1"
          >
            {index > 0 && (
              <ChevronRight className="!h-3.5 !w-3.5" aria-hidden="true" />
            )}
            <span
              className={index === trail.length - 1 ? "!text-slate-900" : ""}
            >
              {item}
            </span>
          </span>
        ))}
      </nav>
      <div className="!flex !flex-col !gap-4 sm:!flex-row sm:!items-end sm:!justify-between">
        <div>
          <h1 className="!m-0 !text-3xl !font-bold !tracking-tight !text-slate-950 sm:!text-4xl">
            {title}
          </h1>
          <p className="!mt-2 !max-w-3xl !text-sm !leading-6 !text-slate-600">
            {description}
          </p>
        </div>
        {actions && (
          <div className="!flex !flex-wrap !items-center !gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

export function OrderPanel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`!rounded-2xl !border !border-slate-200 !bg-white !p-5 !shadow-sm ${className}`}
    >
      {title && (
        <h2 className="!mb-4 !text-base !font-semibold !text-slate-950">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function formatMoney(amount: string, currency = "INR") {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatDate(value: string | null, withTime = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}
