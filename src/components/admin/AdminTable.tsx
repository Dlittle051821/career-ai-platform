import type { ReactNode } from "react";

/**
 * Shared table chrome for every admin list page. The `overflow-x-auto`
 * wrapper is the same load-bearing pattern used by the Milestone 6
 * comparison table (src/components/sections/compare/ComparisonTable.tsx):
 * the TABLE scrolls horizontally within its own bordered container on a
 * narrow viewport, the page body itself never does (spec: "avoid
 * horizontal page overflow", "make tables usable on smaller screens").
 *
 * NW08.5 FIX — duplicate React key regression. This component used to key
 * each `<th>` by its own label (`key={h}`). Most call sites pass exactly
 * one empty-string header (a trailing, unlabeled action column), which was
 * harmless on its own — but `/admin/pricing` (src/app/admin/pricing/
 * page.tsx) conditionally renders a SECOND empty-string header
 * (`canReorder ? "Order" : ""`) alongside its own trailing action column,
 * so whenever `canReorder` is false that page passed `["", "Plan",
 * "Category", "Price", "Status", "Offers", ""]` — two headers both keyed
 * `""`, which is exactly the reported "duplicate-key warning involving
 * empty table-header keys." Headers are a static, order-fixed array for
 * any given render (never filtered/reordered/animated independently of
 * the table itself), so the array's own position is a perfectly safe,
 * always-unique key here — unlike a list of rows, where an index key
 * would be wrong. Keying by `index` instead of by label fixes every
 * call site generically, including any future table that passes two
 * same-labelled (or two empty) headers, without that page needing its own
 * workaround.
 */
export function AdminTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-muted">
            {headers.map((h, index) => (
              <th key={index} scope="col" className="px-4 py-3 whitespace-nowrap">
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
