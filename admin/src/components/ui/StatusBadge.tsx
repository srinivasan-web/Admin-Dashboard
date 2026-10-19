import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusBadgeProps {
  active?: boolean;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "sm" | "md";
  children?: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  success: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700 border-amber-200/80",
    dot: "bg-amber-500",
  },
  danger: {
    badge: "bg-rose-50 text-rose-700 border-rose-200/80",
    dot: "bg-rose-500",
  },
  info: {
    badge: "bg-blue-50 text-blue-700 border-blue-200/80",
    dot: "bg-blue-500",
  },
  neutral: {
    badge: "bg-slate-100 text-slate-600 border-slate-200/80",
    dot: "bg-slate-400",
  },
};

export function StatusBadge({
  active,
  variant,
  dot = false,
  size = "md",
  children,
  className = "",
}: StatusBadgeProps) {
  const resolvedVariant: BadgeVariant =
    variant ?? (active === undefined ? "neutral" : active ? "success" : "neutral");

  const activeClass = active === undefined ? "" : active ? "active" : "inactive";
  const styles = variantStyles[resolvedVariant];
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  const defaultContent =
    children ?? (active === undefined ? resolvedVariant : active ? "Active" : "Inactive");

  return (
    <span
      className={`status-badge inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors ${sizeClasses} ${styles.badge} ${activeClass} ${className}`.trim()}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{defaultContent}</span>
    </span>
  );
}
