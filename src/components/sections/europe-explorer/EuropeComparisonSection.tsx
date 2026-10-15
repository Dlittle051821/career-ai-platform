import { Info, MoveHorizontal } from "lucide-react";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";

/**
 * UX10-EU01 — the reference's "Key factors at a glance" comparison table
 * (section 4). Every cell is a QUALITATIVE label from the real data in
 * `src/data/europe-explorer.ts` — no star ratings, no fabricated numeric
 * scores, per the brief's own explicit instruction.
 *
 * Mobile/responsive approach: rather than force a 7-column table down to
 * illegible tiny text (explicitly banned by the brief), this is ONE
 * horizontally-scrollable table at every width, with the factor-name
 * column pinned (`sticky left-0`) so a student scrolling right never
 * loses track of which row they're reading, plus a visible "swipe to
 * compare" affordance below `lg:`. This is one of the brief's own listed
 * preferred mobile patterns ("horizontally scrollable comparison with
 * strong affordance") — chosen over a separate stacked-card markup so
 * there is only one source of truth to keep in sync with the data file,
 * and over rebuilding this as per-country cards (which would duplicate
 * the Country Cards section above). The scroll happens INSIDE this
 * component's own container, never the page itself — the page-level
 * zero-horizontal-overflow requirement is unaffected.
 */
const ROWS: { label: string; get: (c: (typeof EUROPE_COUNTRIES)[number]) => string }[] = [
  { label: "Tuition profile", get: (c) => c.tuitionProfile },
  { label: "English-taught options", get: (c) => c.englishAvailability },
  { label: "Admission structure", get: (c) => c.admissionProfile },
  { label: "Living-cost profile", get: (c) => c.livingCostProfile },
  { label: "Post-study opportunities", get: (c) => c.postStudyProfile },
];

export function EuropeComparisonSection() {
  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted lg:hidden">
        <MoveHorizontal aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Swipe sideways to compare all 6 countries
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-[0_6px_18px_-10px_rgba(15,23,42,0.18)]">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <caption className="sr-only">Comparison of Germany, Ireland, Netherlands, France, Sweden, and Denmark across tuition, English-taught availability, admission structure, living cost, and post-study opportunities.</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-48 border-b border-r border-border/80 bg-surface-alt px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Factor
              </th>
              {EUROPE_COUNTRIES.map((country) => (
                <th
                  key={country.code}
                  scope="col"
                  className="border-b border-border/80 bg-surface-alt px-4 py-3 text-left text-sm font-semibold text-text"
                >
                  {country.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, rowIndex) => (
              <tr key={row.label} className={rowIndex % 2 === 1 ? "bg-surface-alt/40" : undefined}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-48 border-r border-border/80 bg-surface px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  style={{ backgroundColor: rowIndex % 2 === 1 ? "var(--color-surface-alt)" : "var(--color-surface)" }}
                >
                  {row.label}
                </th>
                {EUROPE_COUNTRIES.map((country) => (
                  <td key={country.code} className="px-4 py-3 align-top text-sm leading-relaxed text-text-soft">
                    {row.get(country)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Information is indicative and should be confirmed from official sources before applying.
      </p>
    </div>
  );
}
