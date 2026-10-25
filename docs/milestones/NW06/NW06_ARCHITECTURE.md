# NW06 Architecture — Abroad Application Experience

## 1. Summary

NW06.1's audit found Milestones 16–19 had already built almost the entirety of what the brief describes — a real, server-enforced application lifecycle, a secure private document store, submission tracking with a database-level authoritative-submission invariant, and a mature counsellor/admin processing workspace. This fundamentally narrowed NW06's real, non-redundant scope to four things: a new Abroad-scoped dashboard (NW06.2, reusing 100% existing reads plus one new cross-application read), a new task system (NW06.6, one new table + four RPCs), external payment as a task subtype of that same system (also NW06.6, not a second feature), and a minimal staff task-management UI (NW06.7). NW06.3/.4/.5 required confirmation only — no code change.

## 2. New files

```
docs/milestones/NW06/*.md                                       — this milestone's full documentation set
supabase/migrations-proposed/NW06_application_tasks.sql          — PROPOSED, NOT applied
src/lib/applications/application-tasks.ts                        — pure task taxonomy/classification logic
src/lib/applications/application-tasks.test.ts                   — 17 tests
src/lib/applications/application-tasks-migration-security.test.ts — 45 tests
src/lib/applications/application-dashboard.ts                    — pure dashboard composition logic (sort/filter/limit)
src/lib/applications/application-dashboard.test.ts                — 10 tests
src/lib/supabase/education/application-tasks.ts                  — student-facing task I/O (RPC-only)
src/lib/supabase/admin/application-tasks.ts                       — staff-facing task I/O (RLS read, RPC write)
src/components/applications/ApplicationTasks.tsx                 — student "Action required" card (/applications/[id])
src/components/admin/applications/AdminApplicationTasks.tsx       — staff "Tasks" card (/admin/applications/[id])
src/components/abroad/AbroadApplicationsSummaryTiles.tsx          — dashboard summary tiles
src/components/abroad/UpcomingAbroadDeadlinesCard.tsx             — dashboard upcoming-deadlines panel
src/components/abroad/AbroadActionRequiredCard.tsx                — dashboard cross-application action-required panel
src/components/abroad/RecentAbroadActivityCard.tsx                — dashboard recent-activity feed
src/components/abroad/AbroadApplicationsTable.tsx                 — dashboard status-filterable table (client component)
src/app/studio/abroad/applications/page.tsx                       — the Abroad Application Dashboard route
src/app/studio/abroad/applications/loading.tsx                    — route-level loading skeleton
src/app/studio/abroad/applications/error.tsx                      — route-level error boundary
```

## 3. Modified files

```
src/types/database.ts                      — 5 new Functions entries + 1 new Tables entry, all commented PROPOSED/NOT YET APPLIED
src/lib/admin/permissions.ts                — new application-tasks:read/write pair, granted to admin/counsellor only
src/app/(site)/applications/actions.ts      — completeApplicationTaskAction()
src/app/admin/applications/actions.ts       — createApplicationTaskAction()/updateApplicationTaskStatusAction()
src/app/(site)/applications/[id]/page.tsx   — new "Action required" card, wired to ApplicationTasks.tsx
src/app/admin/applications/[id]/page.tsx    — new "Tasks" card, wired to AdminApplicationTasks.tsx, gated by application-tasks:read
src/components/dashboard/ApplicationsCard.tsx — additive viewAllHref prop (default unchanged)
src/app/studio/abroad/page.tsx              — passes viewAllHref="/studio/abroad/applications" to ApplicationsCard
```

## 4. Data flow

No NW06 component introduces a new way to read student or staff data beyond the one genuinely new table. Every read is one of:

- A function already used elsewhere, reused verbatim: `listMyApplications()`, `getMyApplicationHistory()` (both Milestone 16), `isAbroadDestinationName()` (NW05.5).
- A new, narrow RPC built specifically because no equivalent existed: `get_my_application_tasks()`/`get_my_open_application_tasks()` (student), a plain RLS-scoped `.select()` for staff (`listApplicationTasks()`).
- Pure, zero-I/O composition on top of those: `application-dashboard.ts`'s sort/filter/limit helpers, `application-tasks.ts`'s classification helpers.

## 5. Dependency graph (new/changed only)

```
src/app/studio/abroad/applications/page.tsx
 ├─ listMyApplications(), getMyApplicationHistory() (pre-existing, unchanged)
 ├─ listMyOpenApplicationTasks() ──calls──> get_my_open_application_tasks() [PROPOSED RPC]
 ├─ application-dashboard.ts (getUpcomingApplicationDeadlines/mergeRecentApplicationActivity)
 └─ AbroadApplicationsSummaryTiles / UpcomingAbroadDeadlinesCard / AbroadActionRequiredCard /
    RecentAbroadActivityCard / AbroadApplicationsTable (new components)

src/app/(site)/applications/[id]/page.tsx
 └─ listMyApplicationTasks() ──calls──> get_my_application_tasks() [PROPOSED RPC]
    └─ ApplicationTasks.tsx ──action──> completeApplicationTaskAction() ──calls──> student_complete_application_task() [PROPOSED RPC]

src/app/admin/applications/[id]/page.tsx
 └─ listApplicationTasks() ──reads (RLS)──> application_tasks [PROPOSED TABLE]
    └─ AdminApplicationTasks.tsx ──actions──> createApplicationTaskAction()/updateApplicationTaskStatusAction()
       ──calls──> staff_create_application_task()/staff_update_application_task_status() [PROPOSED RPCs]
```

## 6. Architectural decisions and why

1. **RPC-only, not plain RLS, for `application_tasks`.** This codebase has two precedents for a staff-writable sub-resource of an application; `application_tasks` matches the heavier one (`application_documents`/`application_submissions`) because task status is a genuine multi-state machine, not a trivial toggle. See `NW06_06_STUDENT_ACTION_REQUIRED.md` §3.
2. **External payment is a task *type*, never a second feature.** One table, one fixed `task_type` vocabulary with `external_payment` as one of seven values — never a parallel `payments`-adjacent table, and schema-level-constrained so its five payment-descriptive columns can never populate for any other type.
3. **The dashboard adds one new cross-application RPC rather than one round trip per application.** `get_my_open_application_tasks()` exists specifically so `/studio/abroad/applications` doesn't need N calls to `get_my_application_tasks()` for N applications.
4. **No entitlement/paywall gate was added anywhere.** NW06.1's audit (§2.8/§8) found no numeric "application allowance" concept exists in this product's current commercial configuration; inventing one here would be exactly the kind of fabricated business rule this codebase's repeated discipline forbids. Flagged as an open founder/admin decision, not silently resolved.
5. **The Abroad dashboard is additive to, never a replacement for, `/applications`.** The generic, product-agnostic list/detail pages remain the actual read/write surface for any one application; `/studio/abroad/applications` is a scoped summary layer that links back to them for everything actionable.

## 7. What NW06 explicitly did not touch

- Any payment, checkout, pricing-calculation, or Razorpay-related code — paid checkout for anything in this milestone was never enabled, per the brief's own explicit instruction.
- Any migration file under `supabase/migrations/` (only `supabase/migrations-proposed/` gained one new, unapplied file).
- The existing application lifecycle, document store, submission-tracking, or counsellor/admin workspace logic itself — all confirmed `EXISTING_AND_FUNCTIONAL` and left unmodified (`NW06_04_APPLICATION_WORKFLOW.md`, `NW06_05_SECURE_DOCUMENT_CENTRE.md`).
