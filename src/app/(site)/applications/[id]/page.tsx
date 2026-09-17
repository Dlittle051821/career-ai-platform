import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/supabase/profile";
import { getMyApplicationById, getMyApplicationHistory } from "@/lib/supabase/education/applications";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { ApplicationTimeline } from "@/components/applications/ApplicationTimeline";
import { ApplicationActions } from "@/components/applications/ApplicationActions";
import { ApplicationNoteEditor } from "@/components/applications/ApplicationNoteEditor";
import { getApplicationNextAction } from "@/lib/applications/application-lifecycle";
import { APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/types/admin";

export const metadata: Metadata = { title: "Application details" };

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString("en-IN");
}

/**
 * Milestone 16 — the real /applications/[id] detail page (spec §9/§10/§14).
 * Ownership is enforced entirely by getMyApplicationById() (never trust the
 * dynamic route param alone — a mismatched/foreign id resolves to null,
 * rendered here as a plain 404, exactly like a genuinely nonexistent id, so
 * a student changing the URL can never distinguish "not yours" from
 * "doesn't exist"). Shows only what the spec calls student-safe: no raw
 * internal_notes, no assigned_counsellor_id, no admin-only history `note`
 * text — getMyApplicationHistory() already enforces that at the query
 * layer, not just here.
 */
export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/applications/${id}`);

  const application = await getMyApplicationById(id);
  if (!application) notFound();

  const history = await getMyApplicationHistory(id);
  const next = getApplicationNextAction(application.stage);
  const title =
    application.courseName && application.universityName
      ? `${application.courseName} at ${application.universityName}`
      : (application.courseName ?? application.universityName ?? "University/course record no longer available");

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <Link href="/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to my applications
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Application</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary balance sm:text-3xl">{title}</h1>
          {application.universityCountryName ? <p className="mt-1 text-sm text-muted">{application.universityCountryName}</p> : null}
        </div>
        <ApplicationStatusBadge stage={application.stage} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-base font-semibold text-primary">Progress</h2>
            <div className="mt-4">
              <ApplicationTimeline stage={application.stage} />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-primary">Details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Intake</dt>
                <dd className="mt-0.5 text-text">{application.resolvedDeadline?.label.split(" — ")[0] ?? application.intake ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Deadline</dt>
                <dd className="mt-0.5 text-text">
                  {application.resolvedDeadline ? `${formatDate(application.resolvedDeadline.date)} (${application.resolvedDeadline.label})` : "Deadline not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Started</dt>
                <dd className="mt-0.5 text-text">{formatDate(application.createdAt) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Submitted</dt>
                <dd className="mt-0.5 text-text">{formatDate(application.submittedAt) ?? "Not submitted yet"}</dd>
              </div>
              {application.decisionAt ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Decision</dt>
                  <dd className="mt-0.5 text-text">{formatDate(application.decisionAt)}</dd>
                </div>
              ) : null}
              {application.withdrawnAt ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Withdrawn</dt>
                  <dd className="mt-0.5 text-text">{formatDate(application.withdrawnAt)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-primary">Your note</h2>
            <div className="mt-4">
              <ApplicationNoteEditor applicationId={application.id} initialNote={application.studentNote} />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-primary">History</h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No updates recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="border-t border-border pt-3 text-sm first:border-0 first:pt-0">
                    <p className="text-text">
                      {h.studentVisibleMessage ?? `Status changed to "${APPLICATION_STAGE_LABELS[h.toStatus as ApplicationStage] ?? h.toStatus}".`}
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(h.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-primary">Next step</h2>
            <p className="mt-2 text-sm text-text">{next.label}</p>
            <p className="mt-4 text-xs text-muted">
              NextWise tracks your application journey here — marking a step complete does not itself submit anything to the university unless stated
              otherwise.
            </p>
            <div className="mt-4">
              <ApplicationActions applicationId={application.id} stage={application.stage} />
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}
