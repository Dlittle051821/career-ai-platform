import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import {
  APPLICATION_BUCKET_LABELS,
  APPLICATION_BUCKET_ORDER,
  getApplicationBucket,
  getApplicationNextAction,
  type ApplicationBucket,
} from "@/lib/applications/application-lifecycle";
import type { MyApplicationSummary } from "@/lib/supabase/education/applications";
import { PathwayGraphic, type PathwayNode } from "@/components/graphics/PathwayGraphic";

/**
 * UX09 Part B — the task asks to "make the journey clearer... only where
 * state truthfully supports it." This card's bucket already comes from
 * getApplicationBucket() (Milestone 16), so this never introduces a
 * second rules engine — it only decides whether showing that bucket as a
 * forward-moving pathway would be an honest picture.
 *
 * `closed` is deliberately excluded from the "normal forward progress"
 * read: it covers `enrolled` (a genuine success) AND `rejected`/
 * `withdrawn` (not a success) alike. A filled, checkmarked pathway node
 * reads as "completed successfully" — true for an enrolled application,
 * misleading for a rejected or withdrawn one. So the pathway only renders
 * for a bucket a student is still actively moving through, or has moved
 * through successfully; a rejected/withdrawn application keeps its
 * existing, already-correctly-toned ApplicationStatusBadge instead.
 */
function shouldShowPathway(stage: MyApplicationSummary["stage"]): boolean {
  return stage !== "rejected" && stage !== "withdrawn";
}

function buildPathwayNodes(currentBucket: ApplicationBucket): PathwayNode[] {
  const currentIndex = APPLICATION_BUCKET_ORDER.indexOf(currentBucket);
  return APPLICATION_BUCKET_ORDER.map((bucket, index) => ({
    id: bucket,
    label: APPLICATION_BUCKET_LABELS[bucket],
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

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
  const bucket = getApplicationBucket(application.stage);
  const showPathway = shouldShowPathway(application.stage);

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

      {showPathway ? (
        <PathwayGraphic
          nodes={buildPathwayNodes(bucket)}
          accessibility={{ kind: "meaningful", label: `Application progress: ${APPLICATION_BUCKET_LABELS[bucket]}` }}
          className="mt-4 border-t border-border pt-4"
          animateActiveSegment={false}
        />
      ) : null}

      <div className="mt-4 flex justify-end">
        <Link href={`/applications/${application.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
          View details →
        </Link>
      </div>
    </Card>
  );
}
