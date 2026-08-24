import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { fieldBorder, inputClasses } from "./FormField";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ error, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(inputClasses, fieldBorder(error), "min-h-[120px] resize-y", className)}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
}
