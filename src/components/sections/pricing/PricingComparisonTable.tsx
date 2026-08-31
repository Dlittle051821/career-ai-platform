import { buildComparisonRow, formatComparisonCell } from "@/lib/pricing/plan-versions";
import type { PricingPlan, PricingPlanVersion } from "@/types/pricing";

/**
 * Accessible comparison table for one category group (Bachelor Abroad or
 * Master Abroad) — a real `<table>` with `<caption>` and `<th scope>`, not a
 * div-grid faking a table (spec: "as an accessible <table>... not a
 * div-grid faking a table"). A null/not-configured field renders as an em
 * dash via formatComparisonCell — never a fabricated number.
 */
export function PricingComparisonTable({
  categoryLabel,
  items,
}: {
  categoryLabel: string;
  items: { plan: PricingPlan; version: PricingPlanVersion }[];
}) {
  if (items.length === 0) return null;
  const rows = items.map(({ plan, version }) => buildComparisonRow(plan.id, version));

  const metrics: { label: string; render: (row: (typeof rows)[number]) => string }[] = [
    { label: "Counselling sessions", render: (r) => formatComparisonCell(r.sessionCount) },
    { label: "University shortlisting limit", render: (r) => formatComparisonCell(r.universityShortlistLimit) },
    { label: "Application-support limit", render: (r) => formatComparisonCell(r.applicationSupportLimit) },
    { label: "SOP review rounds", render: (r) => formatComparisonCell(r.sopReviewRounds) },
    { label: "Scholarship support", render: (r) => formatComparisonCell(r.scholarshipSupportNote) },
    { label: "Mock interviews", render: (r) => formatComparisonCell(r.mockInterviewCount) },
    { label: "Dedicated or senior counsellor", render: (r) => formatComparisonCell(r.counsellorTier) },
    { label: "Support duration", render: (r) => formatComparisonCell(r.supportDurationNote) },
  ];

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-primary">
          Compare {categoryLabel} packages
        </caption>
        <thead>
          <tr className="border-b border-border bg-surface-alt">
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              Included
            </th>
            {rows.map((row) => (
              <th key={row.planId} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                {row.publicTitle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.label} className="border-t border-border">
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-text-soft">
                {metric.label}
              </th>
              {rows.map((row) => (
                <td key={row.planId} className="px-4 py-2.5 text-text">
                  {metric.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
