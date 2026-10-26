# NW08.4 — Counsellor & Team Management

## 1. Finding: the mockup's team panel already mostly existed

`/admin/counsellors?view=workload` already showed per-counsellor active-status, capacity, and assigned student/lead/application counts — the brief's audit (`NW08_01_ADMIN_AUDIT.md` §4) correctly identified this as `FULLY_FUNCTIONAL` for the underlying data and only `NEEDS_UI_INTEGRATION` for presenting specialization + capacity utilization together. This stage is therefore a targeted enhancement of one existing view plus two small, reusable filter additions — not a new page.

## 2. What changed

**`src/app/admin/counsellors/page.tsx`** workload table: added a Specializations column (reusing `CounsellorWorkload.specializations`, already fetched by `listCounsellorWorkload()` but never rendered), a capacity-utilization flag (`assignedStudentCount + assignedLeadCount + assignedApplicationCount` vs `capacity`, flagged "over capacity" in the Capacity cell and a badge column), an "Idle" badge for a counsellor with zero assignments across all three categories, and two new cross-links: the Leads and Applications counts are now links into `/admin/leads?assignedCounsellorId=<id>` and `/admin/applications?assignedCounsellorId=<id>`.

**`src/lib/supabase/admin/applications.ts`**: `ApplicationFilters` gained `assignedCounsellorId` (one `.eq("assigned_counsellor_id", ...)`, same pattern `leads.ts`'s `listLeads()` already had for the identical filter — `applications.ts` simply hadn't exposed it yet).

**`src/app/admin/applications/page.tsx`** / **`src/app/admin/leads/page.tsx`**: both now read `assignedCounsellorId` from their querystring and pass it through to their respective list functions (leads.ts already accepted this filter; applications.ts gained it this milestone — see above). Neither page gained a new filter *control* in its own `FilterBar` — the parameter is reachable only via the new cross-links, consistent with "don't duplicate a counsellor picker that doesn't otherwise exist on these pages."

## 3. Deliberately not built: a separate counsellor task queue

Per `NW08_01_ADMIN_AUDIT.md` §4, `application_tasks` (NW06) remains the one real task table and is scoped to `application_id`, not to a counsellor directly; NW07's own handoff explicitly disclosed that case-scoped (no-application) operational tasks don't exist. Building a cross-cutting "counsellor task queue" this milestone would require either a new table (outside NW08's reuse-first, non-destructive mandate) or silently treating "applications assigned to this counsellor" as "this counsellor's task queue" (a conflation the brief's accuracy rules would flag). Instead, the new `?assignedCounsellorId=` cross-links give a team lead the equivalent view — "every lead/application this counsellor owns" — using the real, existing filters, honestly labeled as what they are.

## 4. Verification

`npx tsc --noEmit` — clean. `npx eslint` on every changed file — clean. `npx vitest run` — 139/2318, unchanged (no new pure-logic function was introduced this stage; the one new query filter mirrors an already-tested pattern). `npm run build` — succeeds.

## 5. What NW08.4 did not do

No new table, column, or migration. No new permission. No change to how a counsellor is assigned to a student/lead/application (that logic, and its own authorization checks, is untouched). No mockup number used.
