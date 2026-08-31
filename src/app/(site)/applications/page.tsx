import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList, Info } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/supabase/profile";
import { listMyApplications } from "@/lib/supabase/education/applications";
import { APPLICATION_STAGE_LABELS, type DecisionStatus } from "@/types/admin";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "My Applications",
};

type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

const DECISION_STATUS_TONE: Record<DecisionStatus, BadgeTone> = {
  pending: "neutral",
  offer: "success",
  waitlist: "warning",
  rejected: "error",
  deferred: "warning",
};

/** src/types/admin.ts exports no label map for DecisionStatus, so title-case the raw value instead of inventing one ("pending" -> "Pending"). */
function decisionStatusLabel(status: DecisionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN");
}

/**
 * The logged-in student's own applications. `/applications` is already
 * covered by PROTECTED_PATHS in src/lib/supabase/middleware.ts, so a
 * logged-out visitor is redirected before this ever renders — the redirect
 * below is defense in depth for the rare race right after logout, same
 * reasoning as src/app/(site)/profile/page.tsx's own comment.
 *
 * This page is read-only by design: RLS grants a student SELECT/INSERT on
 * `applications`, never UPDATE (see applications.ts's docblock) — stage and
 * decision fields only move when the NextWise team updates them.
 */
export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/applications");

  const applications = await listMyApplications();

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Your account</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">My Applications</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Applications you&apos;ve started from a course page, and where each one currently stands.
        </p>
      </div>

      {applications.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <ClipboardList aria-hidden="true" className="h-9 w-9 text-muted" />
          <h2 className="text-base font-semibold text-primary">No applications started yet</h2>
          <p className="max-w-sm text-sm text-muted">
            Explore courses to get started — you can start an application directly from any course page.
          </p>
          <LinkButton href="/courses" size="sm" className="mt-2">
            Explore courses
          </LinkButton>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary-dark" />
            <p>
              Stage and decision updates here are made by the {BRAND_NAME} team as your application progresses — there&apos;s
              nothing you need to edit yourself.
            </p>
          </div>

          <div className="space-y-4">
            {applications.map((application) => {
              const submissionDate = formatDate(application.submissionDate);
              const nextActionDate = formatDate(application.nextActionDate);
              const createdDate = formatDate(application.createdAt);
              const title =
                application.courseName && application.universityName
                  ? `${application.courseName} at ${application.universityName}`
                  : (application.courseName ?? application.universityName ?? "University/course record no longer available");

              return (
                <Card key={application.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-primary">{title}</h2>
                      {createdDate ? <p className="mt-1 text-sm text-muted">Started {createdDate}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{APPLICATION_STAGE_LABELS[application.stage]}</Badge>
                      <Badge tone={DECISION_STATUS_TONE[application.decisionStatus] ?? "neutral"}>
                        {decisionStatusLabel(application.decisionStatus)}
                      </Badge>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Intake</dt>
                      <dd className="mt-0.5 text-text">{application.intake ?? "Not available"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Submission date</dt>
                      <dd className="mt-0.5 text-text">{submissionDate ?? "Not submitted yet"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Offer type</dt>
                      <dd className="mt-0.5 text-text">{application.offerType ?? "Not available"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Next action</dt>
                      <dd className="mt-0.5 text-text">
                        {application.nextAction
                          ? `${application.nextAction}${nextActionDate ? ` (by ${nextActionDate})` : ""}`
                          : "Not available"}
                      </dd>
                    </div>
                  </dl>

                  {application.deadlines.length > 0 ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Deadlines</p>
                      <ul className="mt-1.5 space-y-1 text-sm text-text">
                        {application.deadlines.map((deadline, i) => (
                          <li key={`${deadline.label}-${i}`}>
                            {deadline.label}: {formatDate(deadline.dueDate) ?? deadline.dueDate}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </Section>
  );
}
