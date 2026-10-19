import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { tokens } from "../../design-system/tokens";

interface BaseTextProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
}

export function PageTitle({ children, className = "", ...props }: BaseTextProps) {
  return (
    <h1
      className={`${tokens.typography.pageTitle} ${className}`.trim()}
      {...props}
    >
      {children}
    </h1>
  );
}

export function PageDescription({ children, className = "", ...props }: BaseTextProps) {
  return (
    <p
      className={`${tokens.typography.pageDescription} ${className}`.trim()}
      {...props}
    >
      {children}
    </p>
  );
}

export function SectionTitle({ children, className = "", ...props }: BaseTextProps) {
  return (
    <h2
      className={`${tokens.typography.sectionTitle} ${className}`.trim()}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardTitle({ children, className = "", ...props }: BaseTextProps) {
  return (
    <h3
      className={`${tokens.typography.cardTitle} ${className}`.trim()}
      {...props}
    >
      {children}
    </h3>
  );
}

export function Eyebrow({ children, className = "", ...props }: BaseTextProps) {
  return (
    <span
      className={`${tokens.typography.sidebarSection} inline-block mb-1 text-orange-600 ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function FormLabel({
  children,
  required,
  className = "",
  ...props
}: FormLabelProps) {
  return (
    <label
      className={`${tokens.typography.label} flex items-center gap-1 mb-1.5 ${className}`.trim()}
      {...props}
    >
      <span>{children}</span>
      {required && (
        <span className="text-orange-500 font-bold" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export function BodyText({
  children,
  muted = false,
  className = "",
  ...props
}: BaseTextProps & { muted?: boolean }) {
  return (
    <p
      className={`${muted ? tokens.typography.bodyMuted : tokens.typography.body} ${className}`.trim()}
      {...props}
    >
      {children}
    </p>
  );
}

export function HelperText({
  children,
  error = false,
  className = "",
  ...props
}: BaseTextProps & { error?: boolean }) {
  return (
    <span
      className={`${error ? tokens.typography.helperTextError : tokens.typography.helperText} block mt-1 ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export function CodeText({ children, className = "", ...props }: BaseTextProps) {
  return (
    <code
      className={`${tokens.typography.code} ${className}`.trim()}
      {...props}
    >
      {children}
    </code>
  );
}
