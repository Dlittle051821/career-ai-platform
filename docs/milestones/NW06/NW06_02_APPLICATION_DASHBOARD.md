# NW06.2 — Application Dashboard

**Route:** `/studio/abroad/applications` (new). **Status:** Complete.

## 1. What this is

A dedicated, Abroad-scoped dashboard sitting on top of the pre-existing, product-agnostic application system (Milestones 16–19) and the new NW06.6 task system. It introduces **no new read**: every number and row on this page comes from `listMyApplications()` and `getMyApplicationHistory()` (both Milestone 16, unchanged) and `listMyOpenApplicationTasks()` (NW06.6, already built for the per-application "Action required" card), Abroad-filtered with the same `isAbroadDestinationName()` (`src/lib/abroad/scope.ts`) `/studio/abroad` itself already uses.

## 2. Sections

1. **Summary tiles** (`AbroadApplicationsSummaryTiles.tsx`) — total Abroad applications, active count, action-required count, overdue count. Every number is a plain tally, never a percentage or score.
2. **Upcoming deadlines** (`UpcomingAbroadDeadlinesCard.tsx`) — the student's own Abroad applications with a real, intake-backed deadline (`resolveApplicationDeadline()` — never a guessed date), soonest first, closed-bucket applications excluded. An already-passed deadline on a still-active application is shown, flagged "Overdue", never hidden.
3. **Action required** (`AbroadActionRequiredCard.tsx`) — the student's own open/in-progress/awaiting-verification tasks across every Abroad application, read-only here; acting on one (marking it done, adding a note) happens on the owning application's own `/applications/[id]` page via `ApplicationTasks.tsx`, reached through this row's link.
4. **Recent activity** (`RecentAbroadActivityCard.tsx`) — each Abroad application's own `application_status_history` rows (already student-safe at the RPC layer), merged newest-first across all of them.
5. **Status-filterable table** (`AbroadApplicationsTable.tsx`, client component) — the same four buckets (`Active`/`Submitted`/`Decision`/`Closed`) `/applications` already groups by, as client-side filter tabs over the same `ApplicationCard.tsx` row component — no second card design.

## 3. New pure logic

`src/lib/applications/application-dashboard.ts` — `getUpcomingApplicationDeadlines()` (sort/filter/limit) and `mergeRecentApplicationActivity()` (sort/limit across applications), both pure and unit-tested (`application-dashboard.test.ts`, 10 tests). The database-authoritative data these sort was already fetched elsewhere; this module never queries anything itself.

## 4. Entry point

`/studio/abroad`'s existing `ApplicationsCard` now takes an optional `viewAllHref` prop (default `/applications`, unchanged everywhere else it's used — `/dashboard`); `/studio/abroad` passes `/studio/abroad/applications`, so its "View All Applications" link lands on this new dashboard instead of the unfiltered list.

## 5. What this explicitly does not do

- No new table, column, or RPC — the one proposed migration this milestone adds (`NW06_application_tasks.sql`) exists for NW06.6, not for this page.
- No entitlement/paywall gate — consistent with NW06.1's audit finding that no "application allowance" concept exists in this product today (§2.8/§8 of that audit); this page shows every Abroad application the student has, regardless of purchase.
- No duplicate of `/applications/[id]`'s own detail/action surface — this dashboard is a summary layer on top of it, every card/row links back to it for anything actionable.
