import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export interface LoadingStateProps {
  label?: string;
  subtitle?: string;
  className?: string;
}

export function LoadingState({
  label = "Loading data...",
  subtitle,
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`loading-state flex flex-col items-center justify-center py-12 px-4 text-center ${className}`.trim()}
    >
      <Loader2
        size={32}
        className="text-orange-500 animate-spin mb-3 stroke-[2.2]"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subtitle}</p>}
    </div>
  );
}

export interface EmptyStateProps {
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  children = "No records found matching your criteria.",
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 ${className}`.trim()}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3.5">
        {icon ?? <Inbox size={22} aria-hidden="true" />}
      </div>
      {title && (
        <h4 className="text-sm font-semibold text-slate-900 mb-1">{title}</h4>
      )}
      <div className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
        {children}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  title = "Failed to load information",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className={`card state-card flex flex-col items-center justify-center py-10 px-6 text-center bg-red-50/40 rounded-xl border border-red-200/80 ${className}`.trim()}
    >
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3.5">
        <AlertCircle size={22} aria-hidden="true" />
      </div>
      <h4 className="text-sm font-semibold text-red-900 mb-1">{title}</h4>
      <p className="text-xs text-red-700 max-w-md leading-relaxed mb-4">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw size={14} />}
          className="border-red-300 text-red-700 hover:bg-red-100/50"
        >
          Try Again
        </Button>
      )}
    </section>
  );
}
