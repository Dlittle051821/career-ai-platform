import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonMatrix } from "@/lib/careers/compare";

interface ComparisonTableProps {
  matrix: ComparisonMatrix;
  /** One href per career, same order as `matrix.careers` — navigating there removes just that career from the comparison. */
  removeHrefs: string[];
}

/**
 * Renders the full comparison matrix as one scrollable table. The outer
 * `overflow-x-auto` wrapper is intentional and load-bearing: on a narrow
 * viewport the table itself scrolls horizontally within its own bounded
 * container, while the page body does not — this is what keeps a 2-3
 * column comparison usable on mobile without the page ever overflowing
 * horizontally (see the M6 manual-verification checklist in
 * docs/career-comparison-guide.md).
 */
export function ComparisonTable({ matrix, removeHrefs }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-48 px-4 py-3 text-left align-bottom text-xs font-medium uppercase tracking-wide text-muted">
              Comparing
            </th>
            {matrix.careers.map((career, i) => (
              <th key={career.id} scope="col" className="px-4 py-3 text-left align-bottom">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/careers/${career.slug}`} className="font-semibold text-primary hover:text-secondary-dark">
                      {career.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">{career.familyName}</p>
                  </div>
                  {matrix.careers.length > 2 ? (
                    <Link
                      href={removeHrefs[i]}
                      aria-label={`Remove ${career.title} from comparison`}
                      className="mt-0.5 shrink-0 rounded-full p-1 text-muted hover:bg-surface-alt hover:text-error"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.sections.map((section) =>
            section.rows.length === 0 ? null : (
              <SectionRows key={section.key} sectionLabel={section.label} rows={section.rows} columnCount={matrix.careers.length} />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({
  sectionLabel,
  rows,
  columnCount,
}: {
  sectionLabel: string;
  rows: ComparisonMatrix["sections"][number]["rows"];
  columnCount: number;
}) {
  return (
    <>
      <tr className="bg-surface-alt">
        <th scope="colgroup" colSpan={columnCount + 1} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary-dark">
          {sectionLabel}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="border-t border-border">
          <td className="px-4 py-2.5 text-text-soft">{row.label}</td>
          {row.cells.map((cell, i) => {
            const highlighted = row.highlightIndexes.includes(i);
            return (
              <td key={i} className={cn("px-4 py-2.5", highlighted && "bg-accent-light font-semibold text-accent-dark")}>
                {cell || <span className="text-muted">—</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
