import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      className = "",
      containerClassName = "",
      disabled,
      required,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`.trim()}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-700 flex items-center gap-1"
          >
            <span>{label}</span>
            {required && (
              <span className="text-orange-500 font-bold" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            className={`w-full h-10 px-3 py-2 text-sm bg-white rounded-lg border transition-colors outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon ? "pr-9" : ""} ${
              error
                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-900"
                : "border-slate-300 hover:border-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-800"
            } ${className}`.trim()}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-600 font-medium mt-0.5">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-xs text-slate-500 mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      className = "",
      containerClassName = "",
      disabled,
      required,
      children,
      ...props
    },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`.trim()}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-slate-700 flex items-center gap-1"
          >
            <span>{label}</span>
            {required && (
              <span className="text-orange-500 font-bold" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${selectId}-error`
                : helperText
                  ? `${selectId}-helper`
                  : undefined
            }
            className={`w-full h-10 pl-3 pr-8 py-2 text-sm bg-white rounded-lg border appearance-none transition-colors outline-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
              error
                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-900"
                : "border-slate-300 hover:border-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-800"
            } ${className}`.trim()}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-2.5 pointer-events-none text-slate-400"
            aria-hidden="true"
          />
        </div>
        {error ? (
          <p id={`${selectId}-error`} className="text-xs text-red-600 font-medium mt-0.5">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${selectId}-helper`} className="text-xs text-slate-500 mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = "Select";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      className = "",
      containerClassName = "",
      disabled,
      required,
      rows = 3,
      ...props
    },
    ref,
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`.trim()}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-semibold text-slate-700 flex items-center gap-1"
          >
            <span>{label}</span>
            {required && (
              <span className="text-orange-500 font-bold" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : helperText
                ? `${textareaId}-helper`
                : undefined
          }
          className={`w-full px-3 py-2 text-sm bg-white rounded-lg border transition-colors outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-900"
              : "border-slate-300 hover:border-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-800"
          } ${className}`.trim()}
          {...props}
        />
        {error ? (
          <p id={`${textareaId}-error`} className="text-xs text-red-600 font-medium mt-0.5">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${textareaId}-helper`} className="text-xs text-slate-500 mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
