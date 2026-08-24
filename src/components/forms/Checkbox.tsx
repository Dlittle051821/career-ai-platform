import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
}

export function Checkbox({ id, label, error, className, ...rest }: CheckboxProps) {
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
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p role="alert" className="mt-1.5 pl-8 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
