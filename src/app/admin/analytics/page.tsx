import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { getAnalyticsSummary } from "@/lib/supabase/admin/analytics";
import { withShareOfTotal } from "@/lib/admin/analytics";
import { formatMoney } from "@/lib/admin/money";
import { APPLICATION_STAGE_LABELS, LEAD_STAGE_LABELS, OUTCOME_STAGE_LABELS, PAYMENT_STATUS_LABELS, type ApplicationStage, type LeadStage, type OutcomeStage, type PaymentStatus } from "@/types/admin";
import { PRODUCT_EVENTS, type ImplementedEventName } from "@/lib/analytics/events";

export const metadata: Metadata = { title: "Analytics" };

interface AnalyticsPageProps {
  searchParams: Promise<{ range?: string }>;
}

const RANGE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function RateBlock({ label, percent, numerator, denominator, isReliable }: { label: string; percent: number | null; numerator: number; denominator: number; isReliable: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-text">{label}</p>
      {percent === null ? (
        <p className="mt-1 text-2xl font-semibold text-muted">No data yet</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold text-primary">
          {percent}%{" "}
          {!isReliable ? <span className="text-sm font-normal text-warning">(small sample — {denominator} total)</span> : null}
        </p>
      )}
      <p className="mt-0.5 text-xs text-muted">
        {numerator} of {denominator}
      </p>
    </div>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const rangeParam = params.range ?? "";
  const sinceDays = rangeParam ? Number.parseInt(rangeParam, 10) : undefined;

  const summary = await getAnalyticsSummary({ sinceDays: Number.isInteger(sinceDays) && sinceDays! > 0 ? sinceDays : undefined });
  const leadFunnelWithShare = withShareOfTotal(summary.leadFunnel);
  const applicationFunnelWithShare = withShareOfTotal(summary.applicationStageDistribution);
  const paymentStatusWithShare = withShareOfTotal(summary.paymentStatusDistribution);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Analytics</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every figure is a live server-side aggregate — never a full-table load. Percentages built from fewer than
          5 records are flagged as a small sample rather than shown as confident numbers. Metric definitions:
          docs/admin-system-guide.md §11.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/analytics" hasActiveFilters={Boolean(rangeParam)}>
          <FormField id="range" label="Time range">
            <Select id="range" name="range" defaultValue={rangeParam}>
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <RateBlock
            label="Lead-to-student conversion"
            percent={summary.leadToStudentConversion.percent}
            numerator={summary.leadToStudentConversion.numerator}
            denominator={summary.leadToStudentConversion.denominator}
            isReliable={summary.leadToStudentConversion.isReliable}
          />
          <p className="mt-2 text-xs text-muted">Leads whose stage is &quot;converted&quot;, over all leads in range.</p>
        </Card>
        <Card>
          <RateBlock
            label="Application offer rate"
            percent={summary.applicationOfferRate.percent}
            numerator={summary.applicationOfferRate.numerator}
            denominator={summary.applicationOfferRate.denominator}
            isReliable={summary.applicationOfferRate.isReliable}
          />
          <p className="mt-2 text-xs text-muted">Applications currently at &quot;offer received&quot; or &quot;enrolled&quot;, over all applications in range.</p>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Lead funnel</h2>
          <div className="mt-4 space-y-3">
            {leadFunnelWithShare.every((s) => s.count === 0) ? (
              <p className="text-sm text-muted">No leads in this range.</p>
            ) : (
              leadFunnelWithShare.map((s) => (
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
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-primary">Application stage distribution</h2>
          <div className="mt-4 space-y-3">
            {applicationFunnelWithShare.every((s) => s.count === 0) ? (
              <p className="text-sm text-muted">No applications in this range.</p>
            ) : (
              applicationFunnelWithShare.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-text">{APPLICATION_STAGE_LABELS[s.stage as ApplicationStage] ?? s.stage}</span>
                    <span className="text-muted">
                      {s.count} {s.sharePercent !== null ? `(${s.sharePercent}%)` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${s.sharePercent ?? 0}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Payment status</h2>
          <p className="mt-1 text-sm text-muted">Recorded revenue (status = paid): {summary.recordedRevenueByCurrency.length === 0 ? "—" : null}</p>
          {summary.recordedRevenueByCurrency.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-3 text-sm font-semibold text-primary">
              {summary.recordedRevenueByCurrency.map((r) => (
                <li key={r.currency}>{formatMoney(r.amountMinorUnits, r.currency)}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 space-y-3">
            {paymentStatusWithShare.every((s) => s.count === 0) ? (
              <p className="text-sm text-muted">No payment records in this range.</p>
            ) : (
              paymentStatusWithShare.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-text">{PAYMENT_STATUS_LABELS[s.stage as PaymentStatus] ?? s.stage}</span>
                    <span className="text-muted">
                      {s.count} {s.sharePercent !== null ? `(${s.sharePercent}%)` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
                    <div className="h-full rounded-full bg-success" style={{ width: `${s.sharePercent ?? 0}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-primary">Counsellor workload</h2>
          <div className="mt-4 space-y-3">
            {summary.counsellorWorkload.length === 0 ? (
              <p className="text-sm text-muted">No active counsellors yet.</p>
            ) : (
              summary.counsellorWorkload.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-text">{c.displayName}</span>
                  <span className="text-muted">
                    {c.assignedStudentCount} students · {c.assignedLeadCount} leads · {c.assignedApplicationCount} apps
                  </span>
                </div>
              ))
            )}
          </div>
          <Link href="/admin/counsellors?view=workload" className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
            View full workload →
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Top lead sources</h2>
          {summary.topLeadSources.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No leads with a recorded source in this range.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {summary.topLeadSources.map((s) => (
                <li key={s.key} className="flex items-center justify-between border-t border-border pt-2 first:border-0 first:pt-0">
                  <span className="text-text-soft">{s.key}</span>
                  <span className="font-medium text-text">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <ChartColumn aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
            <h2 className="text-lg font-semibold text-primary">Top universities by application interest</h2>
          </div>
          {summary.topUniversitiesByInterest.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No applications with a linked university in this range.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {summary.topUniversitiesByInterest.map((u) => (
                <li key={u.universityId} className="flex items-center justify-between border-t border-border pt-2 first:border-0 first:pt-0">
                  <Link href={`/admin/universities/${u.universityId}`} className="text-text-soft hover:text-primary hover:underline">
                    {u.universityName}
                  </Link>
                  <span className="font-medium text-text">{u.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-primary">Product &amp; outcome metrics (Milestone 9)</h2>
        <p className="mt-1 text-sm text-muted">
          Event counts below cover only the events this application actually fires — see docs/M9_EVENT_TAXONOMY.md
          for the full registry, including names reserved for functionality (like a live assessment) that does not
          exist yet. Richer time-series charts are deferred — see docs/M9_IMPLEMENTATION.md.
        </p>

        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          <Card>
            <p className="text-sm font-medium text-text">Total student accounts</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{summary.product.totalStudentUsers}</p>
            <p className="mt-0.5 text-xs text-muted">{summary.product.newRegistrations} new in range</p>
          </Card>
          <Card>
            <RateBlock
              label="Profile completion rate"
              percent={summary.product.profileCompletionRate.percent}
              numerator={summary.product.profileCompletionRate.numerator}
              denominator={summary.product.profileCompletionRate.denominator}
              isReliable={summary.product.profileCompletionRate.isReliable}
            />
          </Card>
          <Card>
            <p className="text-sm font-medium text-text">Invoices paid</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{summary.product.invoicesPaid}</p>
            <p className="mt-0.5 text-xs text-muted">status = &quot;paid&quot;, existing Milestone 8 ledger</p>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="text-base font-semibold text-primary">Event counts</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {(Object.keys(summary.product.eventCounts) as ImplementedEventName[])
                .sort((a, b) => summary.product.eventCounts[b] - summary.product.eventCounts[a])
                .map((name) => (
                  <li key={name} className="flex items-center justify-between border-t border-border pt-2 first:border-0 first:pt-0">
                    <span className="text-text-soft" title={PRODUCT_EVENTS[name].reason}>
                      {name}
                    </span>
                    <span className="font-medium text-text">{summary.product.eventCounts[name]}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              counselling_requested and the four assessment_* events are not shown here — they are reserved names
              with no real code path firing them yet (see docs/M9_EVENT_TAXONOMY.md).
            </p>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-primary">Student outcome distribution</h3>
            {summary.product.outcomeStatusDistribution.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No student_outcomes rows yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {summary.product.outcomeStatusDistribution.map((o) => (
                  <li key={o.status} className="flex items-center justify-between border-t border-border pt-2 first:border-0 first:pt-0">
                    <span className="text-text-soft">{OUTCOME_STAGE_LABELS[o.status as OutcomeStage] ?? o.status}</span>
                    <span className="font-medium text-text">{o.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">
              Not time-scoped by the range filter above — student_outcomes holds current state, not a per-period
              count. See docs/OUT-001_OUTCOME_DATA_FOUNDATION.md.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
