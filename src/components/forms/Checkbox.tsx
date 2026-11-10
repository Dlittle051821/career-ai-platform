import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
}

export function Checkbox({ id, label, error, className, "aria-describedby": ariaDescribedBy, ...rest }: CheckboxProps) {
  // CC-23 — link the error to the checkbox so screen readers announce it
  // (e.g. the required Terms consent on /register), keeping any caller-provided description.
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-text-soft">
        <input
          id={id}
          type="checkbox"
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 rounded border-border-strong text-secondary accent-secondary",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 pl-8 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
