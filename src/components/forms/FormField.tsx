import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Label + hint + accessible error message wrapper for a single form control. */
export function FormField({ id, label, required, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-soft">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-error">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
        )}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm text-error">
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined.length > 0 ? joined : undefined;
}

export const inputClasses =
  "w-full rounded-[var(--radius-control)] border bg-surface px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted/70 transition-colors focus:border-secondary disabled:cursor-not-allowed disabled:opacity-60";

export function fieldBorder(hasError?: string) {
  return hasError ? "border-error" : "border-border-strong";
}
