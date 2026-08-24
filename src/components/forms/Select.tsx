import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldBorder, inputClasses } from "./FormField";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export function Select({ error, className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(inputClasses, fieldBorder(error), "appearance-none pr-10", className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
