# NW08.3 — Student CRM & Lifecycle Management

## 1. Design decision: no merged "lifecycle" field

The brief's mockup suggests a single CRM pipeline spanning lead-through-student. Nextwise's data model has two real, separate status concepts — `Lead.stage` and `AdminStudentSummary.status` (sourced from `admin_student_meta`) — governed by separate RLS/transition rules and separate business meaning (a lead is someone not yet enrolled; a student already is). NW08.3 does **not** introduce a third, synthetic "lifecycle stage" column or table to unify them, because doing so would either duplicate the two real enums or blur a distinction the rest of the codebase (and the brief's own §16 accuracy rules) depends on. Instead it builds a presentation-layer overview that shows both real distributions side by side, each linking into the existing, already-filterable `/admin/leads`/`/admin/students` list pages via the query parameters those pages already support (`?stage=`, `?status=`).

## 2. What was built

**New page:** `/admin/crm` ("Student CRM & Lifecycle") — 4 headline counts (total leads, leads overdue for follow-up, leads converted to students, total students) and two side-by-side distributions (lead stage, student status), each bar linking to the matching filtered list page. Permission-gated per section: a role with only `leads:read` sees the lead section; a role with only `students:read` sees the student section; a role with neither sees a plain "no access" message rather than an error.

**New data functions**, each gated by the same single permission its corresponding list function already requires (never a broader one):
- `getStudentStatusDistribution()` (`src/lib/supabase/admin/students.ts`, `students:read`) — reuses the exact "prospect = explicit meta row saying so, OR no meta row at all" rule `listStudents()` already implements for its own `status=prospect` filter, so this distribution and the Students list's filter can never disagree about how many students are prospects. 2 queries total (one total-count, one per explicit status), never a full row load.
- `getLeadStageDistribution()` and `getLeadsNeedingFollowUpCount()` (`src/lib/supabase/admin/leads.ts`, `leads:read`) — the latter reuses the identical "overdue follow-up" definition `getAdminDashboardSummary()` already uses, exposed here under `leads:read` instead of the dashboard's `dashboard:read` so this page never needs a broader permission than the Leads list it summarizes.

**Nav:** a new "CRM Overview" item added to the "Students & CRM" sidebar group (`AdminShell.tsx`), gated by `students:read`, positioned above "Students".

## 3. Deferred proposal — "Student Relations" role

Per `NW08_01_ADMIN_AUDIT.md` §8, a narrower CRM-only staff role was considered and **not implemented** this milestone (no new migration, no new `ROLE_PERMISSIONS` entry). The proposal is documented there for a future milestone if a real operational need for it is identified.

## 4. Verification

`npx tsc --noEmit` — clean. `npx eslint` on every new/changed file — clean. `npx vitest run` — 139 files / 2318 tests (unchanged from NW08.2 — no new DB-mocking test was added for the two thin wrapper functions above, consistent with this codebase's existing, disclosed convention of unit-testing pure logic and leaving thin Supabase-calling wrappers like `getAdminDashboardSummary()`/`getAnalyticsSummary()` to structural review rather than a hand-rolled mock — see `NW08_01_ADMIN_AUDIT.md` §9). `npm run build` — succeeds; `/admin/crm` registered as a new dynamic route.

## 5. What NW08.3 did not do

No new database table, column, or migration. No change to `Lead.stage` or `AdminStudentStatus`'s allowed values or transitions. No change to `/admin/leads` or `/admin/students` themselves. No mockup number used anywhere.
