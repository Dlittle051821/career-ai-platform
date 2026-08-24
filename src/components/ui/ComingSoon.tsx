import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";

/** Empty/coming-soon state for features intentionally out of scope in Milestone 1. */
export function ComingSoon({
  title,
  description,
  className,
}: {
  title: string;
  description: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface-alt p-6",
        className
      )}
    >
      <Badge tone="info">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        Coming soon
      </Badge>
      <p className="text-base font-semibold text-primary">{title}</p>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}
