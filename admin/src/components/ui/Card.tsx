import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`card bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  title,
  subtitle,
  action,
  ...props
}: CardProps & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 ${className}`.trim()}
      {...props}
    >
      {title || subtitle ? (
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="text-base font-semibold text-slate-900 leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 leading-normal">
              {subtitle}
            </p>
          )}
        </div>
      ) : (
        children
      )}
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`p-5 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
