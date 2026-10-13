import Link from "next/link";
import { ArrowRight, BarChart3, GraduationCap, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface CareerInsightsPanelProps {
  total: number;
  familyCount: number;
  industryCount: number;
  hasActiveFilters: boolean;
}

/**
 * UX10-C01 — the reference mockup's right-side "Your Career Insights"
 * panel. The real `/careers` page has an explicit, pre-existing rule
 * (see `src/app/(site)/careers/page.tsx`'s own docblock): "no match
 * percentages, no personalised ranking, nothing here reads or compares
 * against a student's profile" — this is a public, no-login-required
 * browsing tool, not a recommendation surface. The mockup's own example
 * content ("You match with 12 career paths", "92% match", specific
 * countries) would violate that real rule directly, so this panel shows
 * only real, already-fetched numbers (the career count, family count,
 * and industry count this exact page already queried for the filter bar
 * and results list — no second query), and the exact same honest
 * "sign in and complete your profile for personalised matches" message
 * `GuidanceNotice` already carries lower on the page, restyled to this
 * panel's card treatment rather than duplicated as new copy.
 */
export function CareerInsightsPanel({ total, familyCount, industryCount, hasActiveFilters }: CareerInsightsPanelProps) {
  return (
    // UX10-M01 — `sticky` had no breakpoint guard, so it stayed sticky on
    // mobile even though the panel is stacked BELOW the results list there
    // (see page.tsx's `grid gap-8 lg:grid-cols-[1fr_300px]` — single column
    // below `lg:`). A sticky element below other content just "catches" at
    // the top of the viewport as the user scrolls past it, which reads as
    // a layout glitch rather than the intentional "stays visible beside
    // results" behavior it only makes sense for in the real two-column
    // desktop layout. Scoped to `lg:` to match.
    <Card className="shadow-soft lg:sticky lg:top-24">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Career Library</p>
      <h2 className="mt-2 font-sans text-xl font-semibold text-text">Build career clarity</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Browse a structured library of real careers, then get personalised, explained matches once you&rsquo;re
        signed in.
      </p>

      <ul className="mt-5 space-y-3">
        <li className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-light text-info">
            <BarChart3 aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">
              {total} career{total === 1 ? "" : "s"} {hasActiveFilters ? "match your filters" : "in the library"}
            </p>
            <p className="text-xs text-muted">Across {familyCount} career families</p>
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-light text-success">
            <GraduationCap aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">{industryCount} industries covered</p>
            <p className="text-xs text-muted">Filter the library by industry above</p>
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent-dark">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Personalised matches</p>
            <p className="text-xs text-muted">Sign in and complete your profile to unlock explained matches</p>
          </div>
        </li>
      </ul>

      <Link
        href="/recommendations"
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-soft transition-colors hover:bg-primary-light"
      >
        View your personalised career report
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Card>
  );
}
