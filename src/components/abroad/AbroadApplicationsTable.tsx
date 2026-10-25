"use client";

import { useState } from "react";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import {
  APPLICATION_BUCKET_LABELS,
  APPLICATION_BUCKET_ORDER,
  getApplicationBucket,
  type ApplicationBucket,
} from "@/lib/applications/application-lifecycle";
import type { MyApplicationSummary } from "@/lib/supabase/education/applications";
import { cn } from "@/lib/utils";

type FilterValue = "all" | ApplicationBucket;

/**
 * NW06.2 — the status-filterable table at the bottom of the Abroad
 * Application Dashboard. `applications` is already the page's own
 * Abroad-filtered listMyApplications() result — this component introduces
 * no new data, it only filters CLIENT-SIDE by the same getApplicationBucket()
 * every other application surface in this codebase uses, and reuses
 * ApplicationCard.tsx as-is (never a second card design) for each row.
 */
export function AbroadApplicationsTable({ applications }: { applications: MyApplicationSummary[] }) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const counts = new Map<ApplicationBucket, number>();
  for (const bucket of APPLICATION_BUCKET_ORDER) counts.set(bucket, 0);
  for (const application of applications) {
    const bucket = getApplicationBucket(application.stage);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const shown = filter === "all" ? applications : applications.filter((a) => getApplicationBucket(a.stage) === filter);

  return (
    <section aria-labelledby="all-applications-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="all-applications-heading" className="text-base font-semibold text-primary">
          All Abroad applications
        </h2>
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === "all" ? "border-primary bg-primary text-on-primary" : "border-border-strong text-text-soft hover:bg-surface-alt"
            )}
          >
            All ({applications.length})
          </button>
          {APPLICATION_BUCKET_ORDER.map((bucket) => (
            <button
              key={bucket}
              type="button"
              role="tab"
              aria-selected={filter === bucket}
              onClick={() => setFilter(bucket)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === bucket ? "border-primary bg-primary text-on-primary" : "border-border-strong text-text-soft hover:bg-surface-alt"
              )}
            >
              {APPLICATION_BUCKET_LABELS[bucket]} ({counts.get(bucket) ?? 0})
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No applications in this status.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {shown.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </section>
  );
}
