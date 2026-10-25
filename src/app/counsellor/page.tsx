import type { Metadata } from "next";
import Link from "next/link";
import { Users, CalendarHeart, ShieldAlert, FileCheck2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { getCounsellorDashboardData } from "@/lib/supabase/admin/counsellor-dashboard";
import { ADMIN_STUDENT_STATUS_LABELS } from "@/types/admin";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { RECOMMENDATION_DRAFT_STATUS_LABELS, isRecommendationDraftStatus } from "@/lib/recommendations/drafts";
import { isApplicationTaskStatus, isApplicationTaskOverdue, APPLICATION_TASK_STATUS_LABELS } from "@/lib/applications/application-tasks";
import { formatDiscoverySessionDateTime } from "@/lib/discovery-sessions/format";

export const metadata: Metadata = { title: "Dashboard" };

function SummaryTile({ label, value, tone, href }: { label: string; value: number; tone?: "warning" | "error"; href?: string }) {
  const content = (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
      <p className={tone === "error" ? "text-3xl font-semibold text-error" : tone === "warning" ? "text-3xl font-semibold text-warning" : "text-3xl font-semibold text-primary"}>
        {value}
      </p>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function CounsellorDashboardPage() {
  const admin = await getCurrentAdmin();
  const data = await getCounsellorDashboardData();

  const firstName = admin?.email?.split("@")[0] ?? "there";

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellor Studio</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Welcome back, {firstName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          One case per student — the same profile, Discovery Session record, saved universities, and application
          information you&apos;d see on their own account, nothing fragmented or duplicated.
        </p>
      </div>

      {data.partialFailure ? (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning-light">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-warning">
            One or more sections below couldn&apos;t load just now. The numbers and lists you do see are real — reload to retry the rest.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="My Caseload" value={data.summary.caseloadTotal} href="/counsellor/students" />
        <SummaryTile label="Upcoming Sessions" value={data.summary.upcomingSessionCount} href="/counsellor/discovery-sessions" />
        <SummaryTile
          label="Pending Verifications"
          value={data.summary.pendingVerificationCount}
          tone={data.summary.pendingVerificationCount > 0 ? "warning" : undefined}
          href="/counsellor/verifications"
        />
        <SummaryTile label="Recommendation Drafts" value={data.summary.recommendationDraftsAwaitingActionCount} href="/counsellor/recommendations" />
      </div>

      {data.summary.unclaimedSessionRequestCount > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-info/30 bg-info-light">
          <p className="text-sm text-info">
            {data.summary.unclaimedSessionRequestCount} unclaimed Discovery Session request{data.summary.unclaimedSessionRequestCount === 1 ? "" : "s"} waiting for a counsellor.
          </p>
          <LinkButton href="/counsellor/discovery-sessions?unassigned=on" size="sm" variant="outline">
            View unclaimed
          </LinkButton>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <Users aria-hidden="true" className="h-4 w-4 text-secondary" /> My Caseload
            </h2>
            <Link href="/counsellor/students" className="text-sm font-semibold text-secondary-dark hover:text-primary">
              View all
            </Link>
          </div>
          {data.caseload.length === 0 ? (
            <EmptyState icon={Users} title="No cases yet" description="A case appears here once a student is assigned to you, or once you run their Discovery Session." />
          ) : (
            <ul className="divide-y divide-border">
              {data.caseload.slice(0, 6).map((s) => (
                <li key={s.userId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/counsellor/students/${s.userId}`} className="truncate font-medium text-text hover:text-primary hover:underline">
                      {s.fullName || "Unnamed student"}
                    </Link>
                    <p className="text-xs text-muted">{s.profileCompletionPercent}% profile complete</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.pendingVerification ? <Badge tone="warning">Needs review</Badge> : null}
                    <StatusBadge status={s.status} labelOverride={ADMIN_STUDENT_STATUS_LABELS[s.status]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <CalendarHeart aria-hidden="true" className="h-4 w-4 text-secondary" /> Upcoming Discovery Sessions
            </h2>
            <Link href="/counsellor/discovery-sessions" className="text-sm font-semibold text-secondary-dark hover:text-primary">
              View all
            </Link>
          </div>
          {data.upcomingSessions.length === 0 ? (
            <EmptyState icon={CalendarHeart} title="Nothing scheduled" description="A session you've scheduled will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {data.upcomingSessions.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/counsellor/discovery-sessions/${s.id}`} className="truncate font-medium text-text hover:text-primary hover:underline">
                      {s.studentName ?? "Unnamed student"}
                    </Link>
                    <p className="text-xs text-muted">{s.scheduledAt ? formatDiscoverySessionDateTime(s.scheduledAt) : "No time set yet"}</p>
                  </div>
                  <StatusBadge status={s.status} labelOverride={DISCOVERY_SESSION_STATUS_LABELS[s.status]} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <FileCheck2 aria-hidden="true" className="h-4 w-4 text-secondary" /> Recommendation Drafts
            </h2>
            <Link href="/counsellor/recommendations" className="text-sm font-semibold text-secondary-dark hover:text-primary">
              View all
            </Link>
          </div>
          {data.recommendationDrafts.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="No recommendation reports yet"
              description="Author a recommendation report from a student's case to start the draft → review → release process."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recommendationDrafts.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/counsellor/recommendations/${d.id}`} className="truncate font-medium text-text hover:text-primary hover:underline">
                    {d.title}
                  </Link>
                  {isRecommendationDraftStatus(d.status) ? (
                    <Badge tone={d.status === "released_to_student" ? "success" : d.status === "changes_requested" ? "warning" : "neutral"}>
                      {RECOMMENDATION_DRAFT_STATUS_LABELS[d.status]}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <ClipboardCheck aria-hidden="true" className="h-4 w-4 text-secondary" /> Operational Tasks
            </h2>
            <Link href="/counsellor/tasks" className="text-sm font-semibold text-secondary-dark hover:text-primary">
              View all
            </Link>
          </div>
          {data.operationalTasks.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Nothing outstanding" description="An open application task on one of your cases will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {data.operationalTasks.slice(0, 6).map((t) => {
                const overdue = isApplicationTaskStatus(t.status) && isApplicationTaskOverdue(t.status, t.dueDate);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/admin/applications/${t.applicationId}`} className="truncate font-medium text-text hover:text-primary hover:underline">
                        {t.title}
                      </Link>
                      {overdue ? (
                        <p className="flex items-center gap-1 text-xs text-error">
                          <ShieldAlert aria-hidden="true" className="h-3 w-3" /> Overdue
                        </p>
                      ) : null}
                    </div>
                    {isApplicationTaskStatus(t.status) ? <Badge tone={overdue ? "error" : "neutral"}>{APPLICATION_TASK_STATUS_LABELS[t.status]}</Badge> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
