import type { ReactNode } from "react";
import { MoveHorizontal } from "lucide-react";

export interface ComparisonRow {
  label: string;
  values: ReactNode[];
}

interface ComparisonTableProps {
  caption: string;
  columns: string[];
  rows: ComparisonRow[];
}

/**
 * Accessible comparison table with controlled horizontal scroll on narrow
 * screens (a real <table> stays screen-reader friendly; a visible "scroll"
 * affordance appears only where it's actually needed).
 */
export function ComparisonTable({ caption, columns, rows }: ComparisonTableProps) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted sm:hidden">
        <MoveHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
        Scroll sideways to see all columns
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-surface-alt text-left">
              <th scope="col" className="sticky left-0 z-10 bg-surface-alt px-4 py-3 font-semibold text-primary">
                Category
              </th>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 font-semibold text-primary">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.label} className="bg-surface">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-text-soft">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td key={`${row.label}-${index}`} className="px-4 py-3 align-top text-text-soft">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
