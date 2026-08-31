import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CalendarClock, ClipboardCheck, GraduationCap, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { getDataQualityDashboard } from "@/lib/supabase/admin/education-data-quality";
import { EDUCATION_FRESHNESS_BANDS, EDUCATION_FRESHNESS_BAND_LABELS } from "@/types/education";

export const metadata: Metadata = { title: "Data Quality" };

function titleCase(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Entity types this dashboard flags that have a real admin edit page to link to. Intakes and admission requirements are sub-records with no standalone admin route, so they render as plain text. */
function entityHref(entityType: "university" | "course" | "course_intake" | "course_admission_requirement", entityId: string): string | null {
  if (entityType === "university") return `/admin/universities/${entityId}`;
  if (entityType === "course") return `/admin/courses/${entityId}`;
  return null;
}

/** Same visual pattern as the main dashboard's SummaryCard (src/app/admin/page.tsx) — not imported directly since that component isn't exported for reuse. */
function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Landmark;
  label: string;
  value: number | string;
  tone?: "neutral" | "warning" | "error";
}) {
  const toneClasses = {
    neutral: "bg-secondary-light text-secondary-dark",
    warning: "bg-warning-light text-warning",
    error: "bg-error-light text-error",
  }[tone];

  return (
    <Card className="flex items-start gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-primary">{value}</p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

export default async function AdminDataQualityPage() {
  const dashboard = await getDataQualityDashboard();

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Global Education Data</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Data quality</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Computed live from current records at {new Date(dashboard.generatedAt).toLocaleString("en-IN")} — this is a
          read-only snapshot, not a stored value, and nothing on this page deletes or auto-corrects a record.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Landmark} label="Universities" value={dashboard.totals.universities} />
        <StatCard icon={GraduationCap} label="Courses" value={dashboard.totals.courses} />
        <StatCard icon={CalendarClock} label="Course intakes" value={dashboard.totals.courseIntakes} />
        <StatCard icon={ClipboardCheck} label="Admission requirements" value={dashboard.totals.admissionRequirements} />
        <StatCard icon={AlertTriangle} label="Errors" value={dashboard.errorCount} tone={dashboard.errorCount > 0 ? "error" : "neutral"} />
        <StatCard icon={AlertCircle} label="Warnings" value={dashboard.warningCount} tone={dashboard.warningCount > 0 ? "warning" : "neutral"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-primary">Freshness</h2>
          <p className="mt-1 text-sm text-muted">Bands are computed from each record&apos;s last-verified date, not stored.</p>
          <div className="mt-4">
            <AdminTable headers={["Band", "Universities", "Courses"]}>
              {EDUCATION_FRESHNESS_BANDS.map((band) => (
                <tr key={band}>
                  <Td className="font-medium text-text">{EDUCATION_FRESHNESS_BAND_LABELS[band]}</Td>
                  <Td className="text-text-soft">{dashboard.freshnessBandCounts[band].universities}</Td>
                  <Td className="text-text-soft">{dashboard.freshnessBandCounts[band].courses}</Td>
                </tr>
              ))}
            </AdminTable>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-primary">Needs review</h2>
          <p className="mt-1 text-sm text-muted">Records with verification status &ldquo;Needs review&rdquo;.</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
              <span className="font-medium text-text">Universities</span>
              <Badge tone={dashboard.needsReviewCounts.universities > 0 ? "warning" : "neutral"}>{dashboard.needsReviewCounts.universities}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
              <span className="font-medium text-text">Courses</span>
              <Badge tone={dashboard.needsReviewCounts.courses > 0 ? "warning" : "neutral"}>{dashboard.needsReviewCounts.courses}</Badge>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-primary">Duplicate slugs</h3>
            {dashboard.duplicateSlugGroups.length === 0 ? (
              <p className="mt-2 text-sm text-muted">None found.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {dashboard.duplicateSlugGroups.map((group, i) => (
                  <li key={`${group.entityType}-${group.slug}-${i}`} className="flex flex-wrap items-center gap-2">
                    <Badge tone="error">{titleCase(group.entityType)}</Badge>
                    <span className="font-mono text-xs text-text-soft">{group.slug}</span>
                    <span className="text-muted">
                      {group.ids.map((id, idx) => {
                        const href = entityHref(group.entityType, id);
                        return (
                          <span key={id}>
                            {idx > 0 ? ", " : ""}
                            {href ? (
                              <Link href={href} className="text-secondary-dark hover:text-primary hover:underline">
                                {id.slice(0, 8)}
                              </Link>
                            ) : (
                              id.slice(0, 8)
                            )}
                          </span>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-primary">Flagged records</h2>
        <p className="mt-1 text-sm text-muted">
          {dashboard.flaggedRecords.length} record{dashboard.flaggedRecords.length === 1 ? "" : "s"} with at least one issue
          {dashboard.flaggedRecords.length >= 200 ? " — capped at 200; resolve some to see the rest" : ""}.
        </p>
        {dashboard.flaggedRecords.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No issues found.</p>
        ) : (
          <div className="mt-4">
            <AdminTable headers={["Record", "Type", "Issues"]}>
              {dashboard.flaggedRecords.map((rec) => {
                const href = entityHref(rec.entityType, rec.entityId);
                return (
                  <tr key={`${rec.entityType}-${rec.entityId}`} className="hover:bg-surface-alt/50">
                    <Td className="font-medium text-text">
                      {href ? (
                        <Link href={href} className="hover:text-primary hover:underline">
                          {rec.entityLabel}
                        </Link>
                      ) : (
                        rec.entityLabel
                      )}
                    </Td>
                    <Td className="text-text-soft">{titleCase(rec.entityType)}</Td>
                    <Td>
                      <ul className="space-y-1.5">
                        {rec.issues.map((issue, i) => (
                          <li key={`${issue.code}-${i}`} className="flex flex-wrap items-start gap-2">
                            <Badge tone={issue.severity === "error" ? "error" : "warning"}>{issue.code}</Badge>
                            <span className="text-text-soft">{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </Td>
                  </tr>
                );
              })}
            </AdminTable>
          </div>
        )}
      </Card>
    </div>
  );
}
