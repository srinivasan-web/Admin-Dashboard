import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 border-transparent shadow-xs focus-visible:ring-orange-500/30",
  secondary:
    "bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-300 shadow-xs focus-visible:ring-slate-400/30",
  outline:
    "bg-transparent text-orange-600 hover:bg-orange-50/70 active:bg-orange-100/70 border-orange-300 focus-visible:ring-orange-500/30",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 border-transparent focus-visible:ring-slate-400/30",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-transparent shadow-xs focus-visible:ring-red-500/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-5 text-base rounded-lg gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 border focus-visible:outline-none focus-visible:ring-3 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
      ) : (
        leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && (
        <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
}
