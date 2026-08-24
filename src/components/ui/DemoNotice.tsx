import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Honest-demo-behaviour notice. Use anywhere content, data, or an
 * interaction is illustrative rather than real/live/backed by a server.
 */
export function DemoNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-control)] border border-info/25 bg-info-light px-4 py-3 text-sm text-info",
        className
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
