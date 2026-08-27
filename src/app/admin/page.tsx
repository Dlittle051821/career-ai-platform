import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserCheck, Sparkles, CalendarClock, ClipboardList, Clock, Wallet, TrendingUp, UserCog, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getAdminDashboardSummary } from "@/lib/supabase/admin/dashboard";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { formatMoney } from "@/lib/admin/money";
import { withShareOfTotal } from "@/lib/admin/analytics";
import { ADMIN_ROLE_LABELS, LEAD_STAGE_LABELS, type LeadStage } from "@/types/admin";

export const metadata: Metadata = { title: "Dashboard" };

function SummaryCard({
  icon: Icon,
  label,
  value,
  href,
  tone = "neutral",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  href?: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClasses = {
    neutral: "bg-secondary-light text-secondary-dark",
    warning: "bg-warning-light text-warning",
    success: "bg-success-light text-success",
  }[tone];

  const content = (
    <Card className="flex items-start gap-4 transition-shadow hover:shadow-soft">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-primary">{value}</p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function AdminDashboardPage() {
  const [admin, summary] = await Promise.all([getCurrentAdmin(), getAdminDashboardSummary()]);
  const funnelWithShare = withShareOfTotal(summary.leadFunnel);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
          {admin ? `Welcome, ${ADMIN_ROLE_LABELS[admin.role]}` : "Dashboard"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every figure below is a live count from the database — an empty database shows zero, not a placeholder.
          See docs/admin-system-guide.md §11 for exactly how each metric is defined.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Users} label="Total students" value={summary.totalStudents} href="/admin/students" />
        <SummaryCard icon={UserCheck} label="Active students" value={summary.activeStudents} href="/admin/students?status=active" tone="success" />
        <SummaryCard icon={Sparkles} label="New leads" value={summary.newLeadsCount} href="/admin/leads?stage=new" />
        <SummaryCard
          icon={CalendarClock}
          label="Leads needing follow-up"
          value={summary.leadsNeedingFollowUp}
          href="/admin/leads"
          tone={summary.leadsNeedingFollowUp > 0 ? "warning" : "neutral"}
        />
        <SummaryCard icon={ClipboardList} label="Active applications" value={summary.activeApplicationsCount} href="/admin/applications" />
        <SummaryCard
          icon={Clock}
          label="Upcoming deadlines (14d)"
          value={summary.upcomingDeadlinesCount}
          href="/admin/applications"
          tone={summary.upcomingDeadlinesCount > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          icon={Wallet}
          label="Pending payments"
          value={summary.pendingPaymentsCount}
          href="/admin/payments?status=pending"
          tone={summary.pendingPaymentsCount > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Recorded revenue (paid)"
          value={formatMoney(summary.recordedRevenueMinorUnits, summary.recordedRevenueCurrency)}
          href="/admin/payments?status=paid"
          tone="success"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Lead funnel</h2>
          <p className="mt-1 text-sm text-muted">Share of all leads currently in each stage.</p>
          <div className="mt-4 space-y-3">
            {funnelWithShare.every((s) => s.count === 0) ? (
              <p className="text-sm text-muted">No leads yet.</p>
            ) : (
              funnelWithShare.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-text">{LEAD_STAGE_LABELS[s.stage as LeadStage] ?? s.stage}</span>
                    <span className="text-muted">
                      {s.count} {s.sharePercent !== null ? `(${s.sharePercent}%)` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
                    <div className="h-full rounded-full bg-secondary" style={{ width: `${s.sharePercent ?? 0}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/admin/leads" className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
            View all leads →
          </Link>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <UserCog aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
            <h2 className="text-lg font-semibold text-primary">Counsellor workload</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Active students, open leads, and active applications currently assigned.</p>
          <div className="mt-4 space-y-3">
            {summary.counsellorWorkload.length === 0 ? (
              <p className="text-sm text-muted">No active counsellors yet.</p>
            ) : (
              summary.counsellorWorkload.map((c) => (
                <div key={c.counsellorId} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-text">{c.displayName}</span>
                  <span className="flex gap-3 text-muted">
                    <Badge tone="neutral">{c.assignedStudents} students</Badge>
                    <Badge tone="neutral">{c.assignedLeads} leads</Badge>
                    <Badge tone="neutral">{c.assignedApplications} apps</Badge>
                  </span>
                </div>
              ))
            )}
          </div>
          <Link href="/admin/counsellors" className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
            View all counsellors →
          </Link>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center gap-2">
          <ScrollText aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-lg font-semibold text-primary">Recent admin activity</h2>
        </div>
        <div className="mt-4 space-y-2">
          {summary.recentAuditEntries.length === 0 ? (
            <p className="text-sm text-muted">No admin actions recorded yet.</p>
          ) : (
            summary.recentAuditEntries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-0.5 border-b border-border pb-2 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="text-text-soft">{entry.summary}</span>
                <span className="shrink-0 text-xs text-muted">{new Date(entry.createdAt).toLocaleString("en-IN")}</span>
              </div>
            ))
          )}
        </div>
        <Link href="/admin/audit-log" className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
          View full audit log →
        </Link>
      </Card>
    </div>
  );
}
