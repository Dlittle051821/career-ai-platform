import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { UpcomingDeadlineItem } from "@/lib/applications/application-dashboard";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * NW06.2 — "Upcoming deadlines". Every row is one of the student's own
 * Abroad applications with a real, intake-backed deadline
 * (resolveApplicationDeadline() — never a guessed date), soonest first.
 * An already-passed deadline on a still-active application is shown, not
 * hidden, flagged "Overdue" so the student sees it rather than loses it.
 */
export function UpcomingAbroadDeadlinesCard({ deadlines }: { deadlines: UpcomingDeadlineItem[] }) {
  return (
    <section aria-labelledby="upcoming-deadlines-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <CalendarClock aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
        <h2 id="upcoming-deadlines-heading" className="text-base font-semibold text-text">
          Upcoming deadlines
        </h2>
      </div>

      {deadlines.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No upcoming deadlines on your active Abroad applications.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {deadlines.map((item) => (
            <li key={item.applicationId} className="flex items-start justify-between gap-3 border-t border-border pt-3 text-sm first:border-0 first:pt-0">
              <div className="min-w-0">
                <Link href={`/applications/${item.applicationId}`} className="truncate font-medium text-text hover:underline">
                  {item.label}
                </Link>
                <p className="mt-0.5 text-xs text-muted">{item.deadline.label}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-text">{formatDate(item.deadline.date)}</p>
                {item.isOverdue ? (
                  <Badge tone="error" className="mt-1">
                    Overdue
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
