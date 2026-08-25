import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Responsible-interpretation notice — distinct from `DemoNotice`. Use this
 * where the data or feature IS real (not illustrative placeholder data)
 * but still needs a plain-language reminder about how much weight to put
 * on it — e.g. the recommendation engine's qualitative, evidence-bounded
 * output. Never use this in place of `DemoNotice` for actually-fake data,
 * and never use `DemoNotice` here — mislabeling either direction is
 * exactly the kind of false-precision/false-demo confusion these two
 * components exist to keep apart.
 */
export function GuidanceNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft",
        className
      )}
    >
      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary-dark" />
      <div>{children}</div>
    </div>
  );
}
