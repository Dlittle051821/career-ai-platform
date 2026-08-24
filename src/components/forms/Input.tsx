import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { fieldBorder, inputClasses } from "./FormField";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ error, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(inputClasses, fieldBorder(error), className)}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
}
