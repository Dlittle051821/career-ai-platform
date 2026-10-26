# NW08.5 — Application Operations

## 1. What already existed

`/admin/applications`'s list page already does far more than a plain CRUD table: it reuses `getNextOperationalAction()` (Milestone 18/19's rules engine) and `application-work-queue.ts`'s bucket re-grouping to show a per-row "next step" badge, a sticky work-queue summary bar, and bucket-priority sorting — but **deliberately scoped to the current paginated page only** ("never an unbounded scan of every application" — the page's own UX09 comment). The admin dashboard's "Applications needing your attention" widget (`getApplicationsNeedingAttention()`) already does a bounded, disclosed scan (`scanLimit = 40`, most-recently-updated-first) but only surfaces the top 5 `needs_action` items — a dashboard widget, not an operations view.

## 2. What was built

**`getApplicationOperationsOverview()`** (new, `src/lib/supabase/admin/dashboard-work-queue.ts`) — a bounded scan (`scanLimit = 200`, disclosed on the returned object) of open applications, ordered **oldest-updated first** (the opposite order from the dashboard widget, which is newest-first — an operations/exception view's job is to surface what's been sitting longest, which the dashboard already doesn't cover). Reuses `getNextOperationalAction()`/`getWorkQueueBucket()`/`getWorkQueueSummary()` exactly as-is — no second rules engine. Returns a full bucket distribution (`bucketSummary`) across the scanned set, plus up to 10 of the stalest cases (`staleItems`, not updated in 14+ days), each with `daysSinceUpdate` computed server-side in this data function (not in the page component — see §3).

**New page:** `/admin/applications/operations` ("Application Operations") — shows the exception distribution and the stale-case list, each row linking to the existing `/admin/applications/[id]` detail page. Gated by `application-documents:read` (the same permission the dashboard widget and the list page's work-queue features already require) — a role without it sees an empty state, not an error. Added to the sidebar's "Applications" group.

## 3. A React Server Component purity fix made along the way

The first draft computed `Date.now()` directly inside the page component's render (both at the top level and inside a `.map`), which ESLint's `react-hooks/purity` rule flags (components must be deterministic given their props/data — reading the current clock during render is exactly the kind of impurity that rule exists to catch, even though this particular component is server-only and runs once per request). Fixed by moving the "days since last update" computation into `getApplicationOperationsOverview()` itself (a plain async data function, not a component, where calling `Date.now()` is unremarkable) and returning the already-computed `daysSinceUpdate` field on each `StaleApplication`. The page component now does no date arithmetic at all.

## 4. Verification

`npx tsc --noEmit` — clean. `npx eslint` on every new/changed file — clean (including the purity fix above). `npx vitest run` — 139/2318, unchanged (no new pure-logic function introduced — `getApplicationOperationsOverview()` is a thin Supabase-calling wrapper around already-tested pure logic, consistent with this codebase's existing convention for that category of function). `npm run build` — succeeds; `/admin/applications/operations` registered as a new dynamic route.

## 5. What NW08.5 did not do

No change to how submission is recorded (`submittedAt`/`ApplicationSubmission` remain the only source of truth — never inferred from a shortlist or a student's own say-so). No change to the external-payment boundary (Nextwise still never collects a university/visa/government fee directly — untouched by this stage). No new table or migration. No mockup number used — the "200" scan limit and "14 days" staleness threshold are this milestone's own documented, disclosed constants, not platform statistics.
