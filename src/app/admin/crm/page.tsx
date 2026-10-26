import type { Metadata } from "next";
import Link from "next/link";
import { Users, Contact, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SectionCard } from "@/components/admin/CommandCentreWidgets";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { getStudentStatusDistribution } from "@/lib/supabase/admin/students";
import { getLeadStageDistribution, getLeadsNeedingFollowUpCount } from "@/lib/supabase/admin/leads";
import { withShareOfTotal } from "@/lib/admin/analytics";
import { ADMIN_STUDENT_STATUS_LABELS, LEAD_STAGE_LABELS, type AdminStudentStatus, type LeadStage } from "@/types/admin";

export const metadata: Metadata = { title: "Student CRM & Lifecycle" };

/**
 * NW08.3 — Student CRM & Lifecycle Management overview.
 *
 * This page does NOT introduce a new, merged "lifecycle status" column or
 * table. Nextwise has two real, separate, pre-existing status models — a
 * Lead's `stage` (new/contacted/qualified/nurturing/converted/lost) and a
 * Student's operational `status` (prospect/active/inactive/archived) — and
 * this page shows both, honestly labeled as what they are, side by side,
 * with links into the existing filtered list pages
 * (/admin/leads?stage=..., /admin/students?status=...) that already
 * support these exact query params. See
 * docs/milestones/NW08/NW08_01_ADMIN_AUDIT.md §3 for why a single
 * synthetic "10-stage lifecycle" was deliberately NOT built: it would
 * either duplicate these two real enums or paper over the real distinction
 * between "someone we're trying to enroll" (a lead) and "someone already
 * enrolled with us" (a student).
 */
function DistributionBars<S extends string>({ rows, labels, basePath, paramName }: { rows: { stage: S; count: number }[]; labels: Record<S, string>; basePath: string; paramName: string }) {
  const withShare = withShareOfTotal(rows);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted">Nothing recorded yet.</p>;
  }
  return (
    <div className="space-y-3">
      {withShare.map((row) => (
        <Link key={row.stage} href={`${basePath}?${paramName}=${row.stage}`} className="block">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-text">{labels[row.stage as S] ?? row.stage}</span>
            <span className="text-muted">
              {row.count} {row.sharePercent !== null ? `(${row.sharePercent}%)` : ""}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
            <div className="h-full rounded-full bg-secondary" style={{ width: `${row.sharePercent ?? 0}%` }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function AdminCrmOverviewPage() {
  const admin = await getCurrentAdmin();
  const canReadStudents = hasPermission(admin?.role, "students:read");
  const canReadLeads = hasPermission(admin?.role, "leads:read");

  const [studentDistribution, leadDistribution, leadsNeedingFollowUp] = await Promise.all([
    canReadStudents ? getStudentStatusDistribution() : Promise.resolve<{ status: AdminStudentStatus; count: number }[]>([]),
    canReadLeads ? getLeadStageDistribution() : Promise.resolve<{ stage: LeadStage; count: number }[]>([]),
    canReadLeads ? getLeadsNeedingFollowUpCount() : Promise.resolve(0),
  ]);

  const totalStudents = studentDistribution.reduce((sum, r) => sum + r.count, 0);
  const totalLeads = leadDistribution.reduce((sum, r) => sum + r.count, 0);
  const convertedLeads = leadDistribution.find((r) => r.stage === "converted")?.count ?? 0;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Students & CRM</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Student CRM & Lifecycle</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A unified view over the existing Leads and Students systems — not a new or parallel CRM. Every count below
          is a live, bounded query against the same `leads` and `admin_student_meta` tables the Leads and Students
          pages already use.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-2xl font-semibold text-primary">{totalLeads}</p>
          <p className="mt-1 text-sm text-muted">Total leads</p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold text-primary">{leadsNeedingFollowUp}</p>
          <p className="mt-1 text-sm text-muted">Leads overdue for follow-up</p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold text-primary">{convertedLeads}</p>
          <p className="mt-1 text-sm text-muted">Leads converted to students</p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold text-primary">{totalStudents}</p>
          <p className="mt-1 text-sm text-muted">Total students</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {canReadLeads ? (
          <SectionCard
            title="Lead stage"
            subtitle="Where every lead currently sits — click a stage to open the filtered Leads list."
            action={
              <Link href="/admin/leads" className="flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary">
                <Contact aria-hidden="true" className="h-4 w-4" /> Leads <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <DistributionBars rows={leadDistribution} labels={LEAD_STAGE_LABELS} basePath="/admin/leads" paramName="stage" />
          </SectionCard>
        ) : null}

        {canReadStudents ? (
          <SectionCard
            title="Student status"
            subtitle="Operational status set by staff — click a status to open the filtered Students list."
            action={
              <Link href="/admin/students" className="flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary">
                <Users aria-hidden="true" className="h-4 w-4" /> Students <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <DistributionBars
              rows={studentDistribution.map((r) => ({ stage: r.status, count: r.count }))}
              labels={ADMIN_STUDENT_STATUS_LABELS}
              basePath="/admin/students"
              paramName="status"
            />
          </SectionCard>
        ) : null}
      </div>

      {!canReadLeads && !canReadStudents ? (
        <Card className="mt-6">
          <p className="text-sm text-muted">Your role does not have access to lead or student records.</p>
        </Card>
      ) : null}
    </div>
  );
}
