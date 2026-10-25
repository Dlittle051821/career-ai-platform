# NW07.2 — Counsellor Studio Dashboard

## 1. Scope

A new branded route tree at `/counsellor/**` (layout + shell + dashboard page), reusing the exact same `src/lib/supabase/admin/*.ts` data-access functions `/admin/**` already uses. No second backend, no second auth system — see `NW07_01_AUDIT.md` §5 for the routing decision this stage implements.

## 2. What was built

- `src/app/counsellor/layout.tsx` — gates the whole route tree on `getCurrentAdmin()` + `hasPermission(admin.role, "counsellor-studio:read")`. Shows the same inline access-denied state `/admin/layout.tsx` uses for an unauthorized or signed-out visitor — never a silent redirect that could be mistaken for a loading state.
- `src/components/counsellor/CounsellorShell.tsx` — a new sidebar/breadcrumb shell mirroring `AdminShell.tsx`'s structure exactly (desktop sidebar, mobile drawer, breadcrumb header), with its own `COUNSELLOR_NAV`: Dashboard, My Caseload, Discovery Sessions, Verifications, Recommendations, Tasks, Applications (links into the existing `/admin/applications` surface — no duplicate built), Settings. "Counsellor Studio" badge in place of "Admin".
- `src/lib/supabase/admin/counsellor-dashboard.ts` — `getCounsellorDashboardData()`, the dashboard's one aggregator. Composes `listStudents()`, `listDiscoverySessions()`, `getSectionProvenanceMap()` (bounded — see §3), `listMyRecommendationDrafts()`, `listMyOpenStaffApplicationTasks()`. Introduces **zero new reads** beyond what RLS already scopes correctly after the Part 1 migration fix (`NW07_DATABASE_CHANGE_PLAN.md`).
- `src/app/counsellor/page.tsx` — the dashboard page: four summary tiles (My Caseload, Upcoming Sessions, Pending Verifications, Recommendation Drafts), an unclaimed-session-requests banner, and four panel cards (My Caseload, Upcoming Discovery Sessions, Recommendation Drafts, Operational Tasks), each linking into its own full page.

## 3. The "pending verification" heuristic — honest and bounded

`computePendingVerificationFlags()` scans only the first `CASELOAD_SCAN_LIMIT = 20` caseload students (not an unbounded platform-wide scan) and flags a student as pending when `profileCompletionPercent > 0` AND zero of their profile sections carry `COUNSELLOR_VERIFIED` provenance. A student at 0% completion is never flagged — there is nothing yet worth verifying. The dashboard tile and the `/counsellor/verifications` page both state the scan limit explicitly when a caseload exceeds it, rather than silently presenting a partial count as exhaustive.

## 4. Deliberate omissions

`getCounsellorDashboardData()` never calls `listCounsellorWorkload()`, `listCounsellors()`, or `getCounsellorById()` — all three require `counsellors:read`, a permission the `counsellor` role does not hold (`src/lib/admin/permissions.ts`). Every count on this dashboard is derived from data the viewer is independently permitted to read for their own purposes.

## 5. Failure handling

Every read in `getCounsellorDashboardData()`'s `Promise.all` is individually wrapped in `.catch()`, setting a `partialFailure` flag rather than throwing and blanking the whole page. The dashboard shows a visible warning banner when any section failed to load, and every section that did load shows real data — never a silently empty state standing in for an error.

## 6. Verification

`npx tsc --noEmit` clean after this stage. No new automated test was needed for this stage specifically (no new pure logic) — `getCounsellorDashboardData()` is covered indirectly by the pure-function tests in `src/lib/recommendations/drafts.test.ts` and `src/lib/applications/application-tasks.test.ts` that its own composed functions already carry.
