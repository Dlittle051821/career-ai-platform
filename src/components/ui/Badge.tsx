import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-alt text-text-soft border-border-strong",
  success: "bg-success-light text-success border-success/20",
  warning: "bg-warning-light text-warning border-warning/20",
  error: "bg-error-light text-error border-error/20",
  info: "bg-info-light text-info border-info/20",
  accent: "bg-accent-light text-accent-dark border-accent/25",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
