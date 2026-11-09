import { CloudOff } from "lucide-react";

/**
 * CC-22B — shown when a database-backed section could not be loaded, so a
 * failure is never presented as "nothing here yet".
 */
export function UnavailableNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface-alt px-4 py-3 text-sm text-text-soft">
      <CloudOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div>
        <p className="font-semibold text-text">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
