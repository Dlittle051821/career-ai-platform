import type { ReactNode } from "react";

/**
 * Shared table chrome for every admin list page. The `overflow-x-auto`
 * wrapper is the same load-bearing pattern used by the Milestone 6
 * comparison table (src/components/sections/compare/ComparisonTable.tsx):
 * the TABLE scrolls horizontally within its own bordered container on a
 * narrow viewport, the page body itself never does (spec: "avoid
 * horizontal page overflow", "make tables usable on smaller screens").
 */
export function AdminTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-muted">
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}
