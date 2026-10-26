# NW08.7 — Analytics & Operational Reporting

## 1. What changed

**`src/lib/supabase/admin/analytics.ts`**: every date-bounded query (`countWhere`, `totalCount`, `topLeadSources`, `topUniversitiesByApplicationCount`, the revenue-rows select, and all 4 of `getProductAnalyticsSummary()`'s own date-bounded queries) was widened from a one-sided `sinceIso: string | null` floor to a new two-sided `DateWindow { sinceIso, untilIso }` shape — the pre-NW08 code could only ever express "trailing N days" (a floor with an implicit "now" ceiling); it had no way to express a closed range like a calendar month. `AnalyticsFilters` gained `sinceIso`/`untilIso` (an explicit window, taking precedence over the legacy `sinceDays`), and `AnalyticsSummary` gained `effectiveWindow` so a caller can see exactly what window was actually applied.

**`src/lib/admin/analytics.ts`** (pure module) gained `resolveAnalyticsWindow(params, now)` — resolves the analytics page's querystring (`range`, or an explicit `from`/`to` date pair) into a `{sinceIso, untilIso, rangeLabel}` window, pure and deterministic given `now` (8 new tests covering "this month", "last month" including a year-boundary rollover, a trailing-days range, an explicit from/to pair with inclusive "to", an open-ended "from", and a malformed-date fallback to "all time"). This was deliberately written as a pure, unit-tested function in `src/lib/admin/` rather than inline in the page component — matching this codebase's established "pure logic here, thin page/DB-calling code elsewhere" split, and making it possible to test the date-boundary math (the part most likely to have an off-by-one bug) without a Supabase mock.

**`src/app/admin/analytics/page.tsx`**: the time-range filter gained "This month" and "Last month" (UTC calendar months) alongside the existing "All time"/"7"/"30"/"90 days", plus two `type="date"` custom-range inputs (`from`/`to`) that take precedence over the dropdown when set. The page now states the resolved window in plain language ("Showing: this month" / "Showing: 2026-03-01 to 2026-03-10").

**New document:** `NW08_METRIC_DICTIONARY.md` — every metric NW08 introduced or touched, across all 6 new/changed surfaces, with its exact definition, source function, and (for Commercial & Finance) what it's explicitly distinct from. States the UTC timezone convention explicitly, since this milestone is the first to introduce a real calendar-boundary concept (a "month") rather than only relative windows.

## 2. Verification

`npx tsc --noEmit` — clean. `npx eslint` on every changed file — clean. `npx vitest run` — 139 files / 2326 tests (2318 + 8 new `resolveAnalyticsWindow` tests). `npm run build` — succeeds.

## 3. What NW08.7 did not do

No change to any metric's underlying *definition* (what counts as revenue, a reliable sample, a conversion, etc.) — only the time-window mechanism around them. No new chart library. No business-timezone setting (explicitly deferred — see the Metric Dictionary's own timezone section for why, and how the new functions were written to make that change localized if it's ever made). No mockup number used.
