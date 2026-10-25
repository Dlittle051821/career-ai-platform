# NW05.2 — Unified Student Studio (`/studio`)

Status: **COMPLETE**

## 1. What changed

`src/app/studio/page.tsx` (modified), plus two new files:

- `src/components/dashboard/StudentJourneyOverview.tsx` (new)
- `src/app/studio/loading.tsx` (new)
- `src/app/studio/error.tsx` (new)

No database change, no new Supabase table or column, no new RLS policy. Every new data point on this page is read through a function that already existed and was already reviewed in NW05.1 (`src/app/dashboard/page.tsx`'s own data layer) or in earlier milestones.

## 2. Section-by-section mapping to the brief

| Brief requirement | Implementation |
|---|---|
| Welcome Area (real name, no fictitious data) | Unchanged from NW03.3 — `firstNameFrom(profile)`, never a hardcoded name |
| Two Workspace Cards (equal prominence) | Unchanged from NW03.3/NW04 — identical card treatment, neither gated nor reordered by entitlement or activity |
| Student Journey Overview | **New** `StudentJourneyOverview` component — 4 real indicators: profile completion %/status, saved item count, application count, career-recommendation readiness level |
| Next Best Actions | `getNextBestAction()` reused unchanged (same function, same input shape, as `/dashboard`) |
| Saved Items Preview | `SavedShortlistCard` reused unchanged (same component as `/dashboard`) |
| Optional Counselling Entry | `DiscoverySessionCard` reused unchanged (same component as `/dashboard`) |
| Empty States (new/partial/returning account) | No special-cased empty-state component — every tile and card already renders an honest zero/absent state ("Not started", "None yet", "No saved items yet", no active session) because each is driven by a real empty query result, not a placeholder branch that needed to be separately built |
| Loading State | New `loading.tsx` — accessible skeleton (`role="status" aria-live="polite"` text for screen readers, `aria-hidden` decorative skeleton blocks) |
| Error State | New `error.tsx` — generic, recoverable message; never renders `error.message` or `error.digest` (which could otherwise leak which internal query failed); logs the real error server-side via `console.error` only |

## 3. Why `StudentJourneyOverview` is new, not a reuse of `JourneyTracker`

`computeJourneyProgress()`/`JourneyTracker` (used on `/dashboard`) models a **Career-specific** Explore→Build Profile→Recommendations→Saved→Decide→Apply funnel — "Recommendations" there means *career* recommendations, and "Apply" means a *career* application. Rendering that funnel on `/studio`, a page whose entire point is that Career and Abroad are independent, would misrepresent an Abroad-only student as perpetually stuck at "Build Profile" in a pipeline they never entered. `StudentJourneyOverview` instead reports four plain, real facts that are true regardless of which product(s) a student actually uses, each linking to the page that explains it further. See the component's own docblock for the full reasoning.

## 4. Data flow and query cost

All seven top-level queries (`getStudentProfileSnapshot`, `listMyInvoices`, `listMyAgreements`, `listSavedItems`, `listMyApplications`, `getMyActiveDiscoverySession`, `getMyRecommendationReadiness`) run concurrently via `Promise.all`, same as the saved-item university/course resolution step. The one conditionally-run, heavier step — `getRecommendations()` against the full careers catalogue — only runs when `hasMinimumProfileDataForRecommendations()` is true, exactly mirroring `/dashboard`'s own guard, so a brand-new account never pays that query's cost.

## 5. What this stage did not touch

- `/studio/career` (still redirects to `/dashboard` — NW05.4's scope)
- `/studio/abroad` (NW05.5's scope)
- Any entitlement, payment, or checkout logic (NW05.6's scope — the P0 fix is unrelated to this page)
- Any Supabase schema or RLS policy

## 6. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean — 0 errors |
| `npx vitest run` | 130 files / 2137 tests — all passing, no test removed or weakened |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged, none introduced) |
| `npm run build` | Succeeds — `/studio` compiles as a dynamic (server-rendered) route |
