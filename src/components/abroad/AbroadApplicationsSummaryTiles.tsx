import { AlertTriangle, CheckCircle2, ClipboardList, ListTodo } from "lucide-react";

export interface AbroadApplicationsSummaryTilesProps {
  totalCount: number;
  activeCount: number;
  actionRequiredCount: number;
  overdueCount: number;
}

/**
 * NW06.2 — the four summary tiles atop the Abroad Application Dashboard.
 * Every number here is a plain count derived from data the page already
 * fetched (listMyApplications()/listMyOpenApplicationTasks(), both
 * Abroad-filtered) — no new query, and never a percentage or score that
 * could be mistaken for an eligibility signal.
 */
export function AbroadApplicationsSummaryTiles({ totalCount, activeCount, actionRequiredCount, overdueCount }: AbroadApplicationsSummaryTilesProps) {
  const tiles = [
    { key: "total", label: "Abroad applications", value: totalCount, icon: ClipboardList, tone: "text-secondary-dark bg-secondary-light" },
    { key: "active", label: "Active", value: activeCount, icon: CheckCircle2, tone: "text-info bg-info-light" },
    { key: "action", label: "Action required", value: actionRequiredCount, icon: ListTodo, tone: "text-warning bg-warning-light" },
    { key: "overdue", label: "Overdue", value: overdueCount, icon: AlertTriangle, tone: "text-error bg-error-light" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${tile.tone}`}>
            <tile.icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <p className="mt-3 text-2xl font-semibold text-primary">{tile.value}</p>
          <p className="text-xs text-muted">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
