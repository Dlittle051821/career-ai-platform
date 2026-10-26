import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { WORK_QUEUE_BUCKET_ICON, WORK_QUEUE_BUCKET_ICON_CLASS, WORK_QUEUE_BUCKET_TONE } from "@/components/admin/applications/work-queue-visuals";
import { WORK_QUEUE_BUCKET_LABELS } from "@/lib/applications/application-work-queue";
import { getApplicationOperationsOverview } from "@/lib/supabase/admin/dashboard-work-queue";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { APPLICATION_STAGE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Application Operations" };

const SCAN_LIMIT = 200;

/**
 * NW08.5 — Application Operations overview: an exception/aging view that
 * sits ABOVE the existing /admin/applications list and /admin/applications/
 * [id] detail pages (never a replacement for either). Every number here is
 * computed by getApplicationOperationsOverview() — a bounded scan of the
 * SCAN_LIMIT oldest-updated, still-open applications, reusing
 * getNextOperationalAction()/getWorkQueueBucket() exactly as the
 * applications list and dashboard widget already do (never a second rules
 * engine). The scan bound is stated plainly on the page rather than implied
 * to be a platform-wide total, per the brief's accuracy rules.
 */
export default async function AdminApplicationOperationsPage() {
  const admin = await getCurrentAdmin();
  const overview = await getApplicationOperationsOverview(admin?.role, SCAN_LIMIT);

  if (overview.scannedCount === 0) {
    return (
      <div className="max-w-6xl">
        <PageHeader />
        <EmptyState icon={ClipboardList} title="Nothing to show" description="Either there are no open applications right now, or your role doesn't have access to this view (requires application-documents:read)." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <PageHeader />

      <p className="mb-4 text-sm text-muted">
        Based on the {overview.scannedCount} oldest-updated open application{overview.scannedCount === 1 ? "" : "s"} (scan bounded to {overview.scanLimit}) — not necessarily every
        open application on the platform.
      </p>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-primary">Exception distribution</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {overview.bucketSummary.map(({ bucket, count }) => {
            const Icon = WORK_QUEUE_BUCKET_ICON[bucket];
            return (
              <Badge key={bucket} tone={WORK_QUEUE_BUCKET_TONE[bucket]} className="gap-1.5">
                <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${WORK_QUEUE_BUCKET_ICON_CLASS[bucket]}`} />
                {count} {WORK_QUEUE_BUCKET_LABELS[bucket]}
              </Badge>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning" />
          <h2 className="text-lg font-semibold text-primary">Stalest open cases ({overview.staleCount} not updated in 14+ days)</h2>
        </div>
        <p className="mt-1 text-sm text-muted">The oldest-updated items within the scanned set — not a guarantee these are the absolute oldest platform-wide.</p>
        {overview.staleItems.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={ClipboardList} title="Nothing stale" description="No scanned application has gone 14+ days without an update." />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {overview.staleItems.map((a) => {
              const Icon = WORK_QUEUE_BUCKET_ICON[a.bucket];
              return (
                <li key={a.id}>
                  <Link
                    href={`/admin/applications/${a.id}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2.5 text-sm transition-colors hover:border-secondary hover:bg-surface-alt/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-text">{a.studentName ?? "Unnamed student"}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <Icon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${WORK_QUEUE_BUCKET_ICON_CLASS[a.bucket]}`} />
                        {a.actionLabel} · {a.daysSinceUpdate} days since last update
                      </span>
                    </span>
                    <Badge tone={WORK_QUEUE_BUCKET_TONE[a.bucket]} className="shrink-0">
                      {APPLICATION_STAGE_LABELS[a.stage]}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Applications</p>
      <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Application Operations</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Exceptions and aging across open cases — submission status is only ever recorded via a real submission event,
        never inferred from a shortlist or a student&rsquo;s own say-so alone.
      </p>
    </div>
  );
}
