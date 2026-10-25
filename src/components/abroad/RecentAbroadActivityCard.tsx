import Link from "next/link";
import { Activity } from "lucide-react";
import type { RecentApplicationActivityInput } from "@/lib/applications/application-dashboard";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN");
}

/**
 * NW06.2 — "Recent activity". `entries` is mergeRecentApplicationActivity()'s
 * output — each one is a real application_status_history row (via
 * getMyApplicationHistory(), Milestone 16), already student-safe (no raw
 * internal `note` text) at the query layer, merged newest-first across every
 * one of the student's own Abroad applications. Never a fabricated event.
 */
export function RecentAbroadActivityCard({ entries }: { entries: RecentApplicationActivityInput[] }) {
  return (
    <section aria-labelledby="recent-activity-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Activity aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
        <h2 id="recent-activity-heading" className="text-base font-semibold text-text">
          Recent activity
        </h2>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No updates on your Abroad applications yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="border-t border-border pt-3 text-sm first:border-0 first:pt-0">
              <p className="text-text">{entry.message}</p>
              <p className="mt-0.5 text-xs text-muted">
                <Link href={`/applications/${entry.applicationId}`} className="hover:underline">
                  {entry.applicationLabel}
                </Link>{" "}
                · {formatDateTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
