import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { getApplicationNextAction } from "@/lib/applications/application-lifecycle";
import type { MyApplicationSummary } from "@/lib/supabase/education/applications";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Milestone 16 — one row on the student's /applications dashboard.
 * Deliberately compact (spec: "compact cards" at mobile widths) — full
 * detail (timeline, note editor, actions, history) lives on
 * /applications/[id], reached via this card's own link. The deadline shown
 * here is ONLY resolveApplicationDeadline()'s real, intake-backed value —
 * never the free-text `intake`/legacy `deadlines` fields, which stay on the
 * detail page for backward-compatible display but are not promoted to this
 * summary row (spec §15: never guess or upgrade a soft date to a headline
 * deadline).
 */
export function ApplicationCard({ application }: { application: MyApplicationSummary }) {
  const title =
    application.courseName && application.universityName
      ? `${application.courseName} at ${application.universityName}`
      : (application.courseName ?? application.universityName ?? "University/course record no longer available");
  const next = getApplicationNextAction(application.stage);
  const deadline = application.resolvedDeadline;
  const updated = formatDate(application.updatedAt);

  return (
    <Card as="article" className="!p-4 sm:!p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-primary">
            <Link href={`/applications/${application.id}`} className="hover:underline">
              {title}
            </Link>
          </h3>
          {updated ? <p className="mt-0.5 text-xs text-muted">Last updated {updated}</p> : null}
        </div>
        <ApplicationStatusBadge stage={application.stage} />
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Deadline</dt>
          <dd className="mt-0.5 text-text">{deadline ? `${formatDate(deadline.date)} (${deadline.label})` : "Deadline not available"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Next step</dt>
          <dd className="mt-0.5 text-text">{next.label}</dd>
        </div>
      </dl>

      <div className="mt-4 flex justify-end">
        <Link href={`/applications/${application.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
          View details →
        </Link>
      </div>
    </Card>
  );
}
