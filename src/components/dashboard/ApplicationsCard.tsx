import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { APPLICATION_STAGE_LABELS } from "@/types/admin";
import type { MyApplicationSummary } from "@/lib/supabase/education/applications";

const CLOSED_STAGES = new Set(["enrolled", "rejected", "withdrawn"]);

/**
 * UX10-D01 — "Applications". `applications` is the real
 * `listMyApplications()` result, unchanged — never invented universities
 * or statuses.
 *
 * NW06.2 — `viewAllHref` defaults to the generic `/applications` list (used
 * as-is on `/dashboard`); `/studio/abroad` passes
 * `/studio/abroad/applications` instead, so the one "View All" link on this
 * card lands on the new Abroad-scoped dashboard rather than the unfiltered
 * list when this card is shown inside the Abroad workspace.
 */
export function ApplicationsCard({ applications, viewAllHref = "/applications" }: { applications: MyApplicationSummary[]; viewAllHref?: string }) {
  const shown = applications.slice(0, 2);

  return (
    <section aria-labelledby="applications-heading" className="flex h-full flex-col rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
          <ClipboardList aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <h2 id="applications-heading" className="font-sans text-base font-semibold text-text">
            Applications
          </h2>
          <p className="text-xs text-muted">{applications.length === 0 ? "No applications yet" : `${applications.length} application${applications.length === 1 ? "" : "s"}`}</p>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 flex-1 text-sm text-muted">No applications started yet.</p>
      ) : (
        <ul className="mt-4 flex-1 space-y-3">
          {shown.map((application) => (
            <li key={application.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{application.universityName ?? "University application"}</p>
                {application.courseName ? <p className="truncate text-xs text-muted">{application.courseName}</p> : null}
              </div>
              <Badge tone={CLOSED_STAGES.has(application.stage) ? "neutral" : "info"} className="shrink-0">
                {APPLICATION_STAGE_LABELS[application.stage]}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Link href={viewAllHref} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-light">
        View All Applications
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
