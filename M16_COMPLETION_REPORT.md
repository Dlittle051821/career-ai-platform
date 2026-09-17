# Milestone 16 — Student Application Workflow: Completion Report

This file was originally delivered only inside M16's own update ZIP and was never committed to the
repository tree. It is added here now, with a "Post-review security patch" (v2) section and a "v3 patch"
(final student database-boundary hardening) section, because both of this milestone's security patches
modify `0017_student_application_workflow.sql` and the surrounding application code directly — migration
`0017` had not yet been applied to any database at either point, so both were patched in place rather than
superseded by a new `0018` migration, per each patch's own explicit instruction.

## 1. Baseline

- Repository: `https://github.com/Dlittle051821/career-ai-platform`
- Branch: `release/m10`
- Exact baseline commit: `c4bf5a605aaa54c68d1fa4f27e18a6a845fc9f59` ("Fix Razorpay receipt length for checkout")
- Latest migration at baseline: `0016_refund_operations.sql`.
- Milestones already present at baseline (confirmed by reading their migrations/docs directly, not assumed): M7 (admin system + the original `applications` table), M9 (global education data, student saved items/applications), M10 (electronic signature), M11A (stamping), M11B (assisted onboarding), M11C (recommendation readiness), UX01–04, M12 (pricing catalogue), M13 (refund operations, financial-safety-patched).

Full audit trail — every file read before any code was written — is in `MANIFEST.md`'s AUDIT FINDINGS section; it is not repeated here.

## 2. Audit summary

Eleven questions answered before writing any code (see `MANIFEST.md` for the full findings):

1. **Does an applications table exist?** Yes — Milestone 7, `public.applications`.
2. **Does `/applications` render real data?** Yes, already — a read-only list. This milestone adds grouping, real actions, and a detail page.
3. **Does `/admin/applications` exist?** Yes, already a mature CRUD surface.
4. **What statuses exist?** 10 values in `applications_stage_check`; this milestone adds exactly one (`ready_to_submit`).
5. **What fields exist?** See `MANIFEST.md`'s domain model table.
6. **Is university/course linkage modeled?** Yes, via `university_id`/`course_id` FKs — reused, never duplicated.
7. **Is intake/deadline data available?** Yes — `course_intakes` (Milestone 9) has `priority_deadline`/`final_deadline`/`international_deadline`. Not previously linked to `applications`; this milestone adds the optional `course_intake_id` FK.
8. **Is ownership RLS-enforced?** Partially — `applications` itself, yes (Milestone 9); `application_status_history` had a real gap, closed in this milestone (see §4 below) and tightened further by the post-review patch.
9. **Is there audit history?** Yes — `application_status_history`, reused and extended (not duplicated).
10. **Are there duplicate/placeholder structures?** No second applications model was found or created.
11. **What genuine gaps remain?** Listed in full in `MANIFEST.md`; the two most consequential were the missing student self-service write path and the admin update path's stale-write race.

## 3. What was built

- One new migration, `0017_student_application_workflow.sql` — additive only, 0001–0016 untouched.
- A `ready_to_submit` stage inserted into the existing 10-value lifecycle.
- Five new `applications` columns (`course_intake_id`, `student_note`, `submitted_at`, `decision_at`, `withdrawn_at`) and two new `application_status_history` columns (`actor_type`, `student_visible_message`).
- Two `SECURITY DEFINER` RPCs — `student_advance_application()`, `student_update_application_note()` — the only way a student can ever mutate their own application.
- A closed IDOR gap on `application_status_history`'s RLS, further tightened by the post-review patch (below).
- Two partial unique indexes enforcing "at most one active application per (student, course[, intake])".
- A fixed, atomic-conditional-update rewrite of the admin `updateApplication()` path, closing a stale-write race.
- A rebuilt student `/applications` dashboard (grouped, real counts, empty state) and a new `/applications/[id]` detail page (timeline, note editor, actions, safe history).
- Small, additive changes to the existing admin applications pages (new stage in filters, a read-only student-details card).
- Three new analytics events and three new notification templates, wired through the existing abstractions.
- `docs/applications-guide.md`.

Full file-by-file detail is in `MANIFEST.md`.

## Post-review security patch (this update)

An internal security review of the first version of this milestone found four concrete issues plus one
defense-in-depth gap, all inside `0017_student_application_workflow.sql` and its surrounding application
code. Because migration `0017` had not yet been applied to any database, it was **patched in place** —
no `0018` migration was created. Full reasoning for each fix is in
`docs/applications-guide.md` §4's "Post-review security patch" subsection and in
`src/lib/applications/application-workflow-migration-security.test.ts`'s new static-SQL regression tests.
Summary:

1. **Students could directly INSERT lifecycle history.** The `application_status_history` INSERT RLS
   policy had a `student_user_id = auth.uid()` branch, letting a student forge an arbitrary history row
   (any from/to status, any message) without the application itself changing — completely bypassing
   `student_advance_application()`. **Fixed**: that branch is removed; the INSERT policy is now
   admin/counsellor-only. A student's own history rows are written exclusively by the `SECURITY DEFINER`
   RPC, which is unaffected by RLS narrowing.

2. **A student could read the internal `note`/`changed_by` columns via direct table access.** RLS
   restricts rows, not columns — the old SELECT policy's "is this my application" row check did not stop
   a student's own session from requesting the internal columns directly. **Fixed**: the SELECT policy
   lost its student branch too (a student now gets zero rows on a direct table query), and a new function,
   `get_my_application_status_history()`, is the only way a student reads their own history — its
   `RETURNS TABLE` shape structurally excludes `note`/`changed_by`. `getMyApplicationHistory()` now calls
   this RPC instead of querying the table.

3. **Reapplication after `rejected`/`withdrawn` was broken.** `startApplicationFromCourse()`'s pre-check
   matched on `student_user_id` + `course_id` alone, so an old rejected/withdrawn application was returned
   as "the existing application" forever, blocking the legitimate reapplication the database's own partial
   unique indexes were designed to allow. **Fixed**: the pre-check now excludes `rejected`/`withdrawn`
   explicitly and caps itself at one row, matching the database's own definition of "active" exactly.

4. **`course_intake_id`/`course_id` validation could be bypassed.** The trigger only validated when both
   `course_intake_id` and `course_id` were non-null, so `course_intake_id != null, course_id = null`
   silently skipped validation. **Fixed**: the guard now triggers on `course_intake_id is not null` alone,
   with an explicit rejection when `course_id` is null.

5. **Defense-in-depth**: `student_advance_application()`'s final `UPDATE` now re-asserts `student_user_id =
   auth.uid() and stage = v_old_stage` in its own `WHERE` clause, rather than relying solely on the
   preceding `SELECT ... FOR UPDATE`. A zero-row result now raises the same safe, generic error instead of
   being silently possible.

**Not changed by this patch**: no new migration, no change to `applications`'/`application_status_history`'s
table shape, no change to `ready_to_submit`, the duplicate-application partial unique indexes (the rule
itself is unchanged — only the JS pre-check's own matching logic was fixed), the student note model, status
timestamps, the admin conditional-update path, UI, analytics, notifications, or application routes. No
payment/refund/pricing/Razorpay code was read or touched. No migration 0001–0016 was touched.

## v3 patch (final student database-boundary hardening) — this update

A second, deeper security review found that the v2 patch above still left database-authoritative gaps on
`applications` itself (as opposed to `application_status_history`, which v2 already closed): the two
mutation RPCs returned the full row; an ordinary student still had direct table SELECT/INSERT access; and
application creation went through a direct `INSERT` guarded only by `student_user_id = auth.uid()`, with no
restriction on any other column. Again, migration `0017` had not yet been applied to any database, so it
was **patched in place again** — still no `0018`. Full reasoning for each fix is in
`docs/applications-guide.md` §4's "v3 patch" subsection and in
`src/lib/applications/application-workflow-migration-security.test.ts`'s new static-SQL regression tests
(45 new tests) plus `src/lib/supabase/education/applications.test.ts`'s rewritten orchestration tests (8
new tests). Summary:

1. **Mutation RPCs leaked staff-only columns via their return type.** `student_advance_application()` and
   `student_update_application_note()` both `returned public.applications` — the full row, including
   `internal_notes`/`assigned_counsellor_id`/`last_contact_date` — even though both TypeScript callers
   already discarded the result. **Fixed**: both now `RETURNS TABLE` of only the columns a caller has any
   legitimate reason to see (`(id, stage, submitted_at, withdrawn_at, updated_at)` and `(id, student_note,
   updated_at)` respectively) — structurally, not by convention.

2. **An ordinary student had direct SELECT/INSERT access to `applications`.** The Milestone 9 policies
   ("Students can read their own applications", "Students can start their own application from a course")
   restricted rows only — a direct SELECT could still request staff-only columns, and the INSERT's `WITH
   CHECK` placed no restriction on `stage`/`decision_status`/`internal_notes`/`assigned_counsellor_id` at
   all. **Fixed**: both policies are dropped (defined in `0006`, dropped from within `0017` — the same
   drop-from-a-later-migration pattern v2 already used for `application_status_history`). An ordinary
   student now has zero direct SELECT/INSERT capability on `applications`. The three original
   admin/counsellor policies are completely unaffected.

3. **New student-safe read RPCs.** `get_my_applications()`/`get_my_application(p_application_id)` replace
   the direct-table reads in `listMyApplications()`/`getMyApplicationById()` — `SECURITY DEFINER`, identity
   from `auth.uid()` only, `RETURNS TABLE` structurally excluding the same three staff-only columns, zero
   rows (never an error) for another student's application.

4. **Application creation made database-authoritative.** `student_start_application(p_course_id,
   p_university_id)` replaces `startApplicationFromCourse()`'s direct `INSERT` — every protected field
   (`student_user_id`, `stage`, `decision_status`, `assigned_counsellor_id`, `internal_notes`,
   `last_contact_date`) is set by the function itself, never by the caller. Reuses an existing non-terminal
   application for the same course (rejected/withdrawn excluded, so reapplication still works); a
   `unique_violation` exception handler resolves a genuine concurrent race by re-selecting the winning row.
   Returns only the new/existing application id.

5. **Course/university pairing verified server-side, for both paths.** Audited (not guessed):
   `courses.university_id` is the sole, direct, `NOT NULL` FK — no campus indirection anywhere in this
   schema. `student_start_application()` verifies the pair against that FK plus the exact same
   published+active gate the pre-existing public course-browsing policy already uses, with one generic
   anti-enumeration error for every failure reason. A new trigger,
   `validate_application_course_university()`, gives the pre-existing admin create/update path the same
   protection — auditing `src/lib/supabase/admin/applications.ts` found `university_id`/`course_id` are
   taken independently with no correlation enforced today, so the trigger validates the pairing only when
   both are non-null, never narrowing the admin form's existing capability.

`startApplicationFromCourse()`/`listMyApplications()`/`getMyApplicationById()` were rewritten to call the
new RPCs via `supabase.rpc(...)`. `application_started` analytics still fire only on a genuine new
creation — a best-effort `get_my_applications()` pre-check decides whether to call
`student_start_application()` at all, purely for analytics accuracy, never as a security boundary.

**Not changed by this v3 patch**: no new migration, no change to any v1/v2 fix or table/column shape, the
duplicate-application partial unique indexes (unchanged — `student_start_application()` mirrors the same
rule at the RPC layer), the student note model, status timestamps, the admin conditional-update path's own
`UPDATE` logic (only gains the new shared trigger), UI, analytics event names, notifications, or
application routes. No payment/refund/pricing/Razorpay code was read or touched. No migration 0001–0016
was touched; no `0018` was created.

## 4. Reused infrastructure vs. new implementation

Reused verbatim/unchanged: `applications`/`application_status_history` tables, `applications:read`/`applications:write` permissions, `APPLICATION_STAGE_TRANSITIONS`'s existing 10 edges, `Notifier`/`LoggingNotifier`, `product_events`, `StatusBadge`/tone system, the admin applications CRUD pages' overall structure, `journey-progress.ts`'s Apply-stage gate.

New (this milestone): the `ready_to_submit` stage and its one new edge; every student-mutable column; the two student RPCs; the closed `application_status_history` RLS gap; the two duplicate-protection indexes; the atomic-conditional-update fix to `updateApplication()`; the rebuilt student dashboard and new detail page; the pure `application-lifecycle.ts` helper module; the three new analytics events/notification templates.

New (v2 patch): the narrowed `application_status_history` RLS policies (no student branch at all); `get_my_application_status_history()`; the reapplication-safe pre-check in `startApplicationFromCourse()`; the hardened `validate_application_course_intake()`; the defense-in-depth `WHERE` clause in `student_advance_application()`.

New (v3 patch): narrowed `RETURNS TABLE` shapes on both mutation RPCs; the two Milestone-9 student policies on `applications` dropped entirely; `get_my_applications()`/`get_my_application()`; `student_start_application()`; `validate_application_course_university()` and its trigger, shared by both the student RPC and the admin path.

## 5. Status lifecycle

11 stages, one controlled graph (`APPLICATION_STAGE_TRANSITIONS`), two enforcement paths kept in a verified subset relationship (admin path reads the graph directly; the student RPC's fixed action vocabulary is a strict subset of it). Students structurally cannot reach any post-submission decision stage — the RPC's `case` statement has no branch producing one. Unchanged by this patch.

## 6. Duplicate protection

Documented rule (see `docs/applications-guide.md` §7): at most one non-terminal application per (student, course[, intake]); `rejected`/`withdrawn` are re-appliable. Enforced by two partial unique indexes (unchanged) plus, as of v3, the authoritative reuse-or-insert logic inside `student_start_application()` itself (the JS-side pre-check in `startApplicationFromCourse()` — fixed by v2 to honor "rejected/withdrawn are re-appliable" — now exists only to decide whether to fire analytics, not as the correctness boundary).

## 7. Application history

One table, two audiences, distinguished at the column level: `note`/`changed_by` stay admin/counsellor-internal; `actor_type`/`student_visible_message` are the only fields the student-facing timeline ever reads. **The v2 patch made that distinction database-authoritative** — see the "Post-review security patch" section above — rather than resting on RLS row-scoping plus a hand-picked TypeScript select list. **The v3 patch extends the exact same discipline to `applications` itself** — see the "v3 patch" section above.

## 8. Student UX

Unchanged by this patch. `/applications` — four honest buckets (Active/Submitted/Decision/Closed), real counts, clear empty state. `/applications/[id]` — real linked data, a five-stage honest progress timeline, the student's own note, a safe history feed (now backed by the RPC), and the available actions for the current stage.

## 9. Admin visibility

Unchanged by this patch. No new admin route was needed — `/admin/applications` and `/admin/applications/[id]` already covered list/search/filter/create/edit/history.

## 10. Permissions

Unchanged by this patch. No new permission scope was added.

## 11. RLS / IDOR

Three independent ownership layers (RLS, server-side query scoping, RPC-internal `WHERE`/return-shape scoping). The v2 patch strengthened all three for `application_status_history`: RLS no longer grants a student any direct access at all; `getMyApplicationHistory()` delegates to a SECURITY DEFINER RPC; `student_advance_application()`'s own `UPDATE` re-scopes itself. **The v3 patch extends the same three-layer discipline to `applications` itself**: RLS now grants an ordinary student zero direct SELECT/INSERT (the two Milestone 9 policies are dropped); `listMyApplications()`/`getMyApplicationById()`/`startApplicationFromCourse()` all delegate to SECURITY DEFINER RPCs whose return/insert shapes structurally exclude staff-only columns and set every protected field server-side; and a shared trigger gives the admin path the same course/university consistency guarantee the student RPC enforces. See `docs/applications-guide.md` §4/§5.

## 12. Concurrency handling

Every state-changing write (all four student RPCs, and the admin `updateApplication()`) is a single, database-authoritative conditional operation. The v2 patch added one layer of defense-in-depth to `student_advance_application()`'s own `UPDATE` (Post-review security patch #5). The v3 patch adds `student_start_application()`'s own `unique_violation` exception handler, which resolves a genuine concurrent creation race by re-selecting the winning row rather than surfacing the raw constraint violation — neither change alters externally observable behavior for any legitimate caller.

## 13. Accessibility / 14. Responsive behavior

Unchanged by this patch (no UI was modified).

## 15. Analytics / 16. Notifications

Unchanged by this patch.

## 17. Tests

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm test` — **1165 / 1165 passing**, 66 files, 0 failures. Baseline before this v3 patch: **1112/1112**
  (v2's own baseline was 1088/1088, which was itself the baseline before this milestone existed: 1003/1003).
  This v3 patch adds **53 new tests** across the same 2 files v2 already touched, with 0 existing tests
  removed:
  - `src/lib/applications/application-workflow-migration-security.test.ts`: **96/96** (51 pre-v3 + 45 new —
    both mutation RPCs' narrowed `RETURNS TABLE` shapes; `get_my_applications()`/`get_my_application()`'s
    safe-column shape and identity derivation; confirmation the two Milestone-9 student policies are
    genuinely dropped with no recreate; every protected field `student_start_application()` sets itself;
    the course/university verification query and `validate_application_course_university()` trigger; the
    `unique_violation` exception handler; regression checks that the admin policies and all five v2
    protections remain untouched; and a payment-isolation check).
  - `src/lib/supabase/education/applications.test.ts`: **31/31** (23 pre-v3 + 8 new — `getMyApplicationById`/
    `listMyApplications`'s RPC-boundary behavior including the structural-exclusion regression test, and
    `startApplicationFromCourse`'s full rewrite around `student_start_application()`/`get_my_applications()`).
  - Every other pre-existing suite (application lifecycle, admin applications, status transitions, M10–M13, UX03-04) still passes unchanged.
- `npm run build` — succeeds; all 77 routes generate, unchanged from before this patch.

## 18. Known limitations / deferred work

Unchanged by this patch — see `docs/applications-guide.md` §12 for the full list.

## 19. Final acceptance checklist (v2 patch-specific additions)

- [x] Migration `0017` patched in place — no `0018` created, per this patch's own explicit instruction.
- [x] A student can no longer directly INSERT into `application_status_history` under any circumstance.
- [x] A student can no longer directly SELECT `note`/`changed_by` from `application_status_history` under any circumstance — verified structurally (the RPC's return shape excludes them), not just by convention.
- [x] `student_advance_application()` remains the only path by which a student's own history row is created.
- [x] Admin and assigned-counsellor direct INSERT/SELECT on `application_status_history` continue to work unchanged.
- [x] An unrelated counsellor still cannot insert/read history for a case that is not assigned to them.
- [x] A rejected or withdrawn application no longer blocks a legitimate reapplication to the same course.
- [x] Multiple historical terminal applications for the same course cannot cause a runtime error in the pre-check.
- [x] A non-null `course_intake_id` with a null `course_id` is now rejected by the trigger.
- [x] `student_advance_application()`'s final `UPDATE` is scoped to `student_user_id = auth.uid() and stage = v_old_stage`, not `id` alone.
- [x] No payment/refund/pricing/Razorpay file was read or touched.
- [x] No migration 0001–0016 was touched; no new migration (`0018`) was created.
- [x] Update ZIP generated: `nextwise-m16-student-application-workflow-v2.zip`, a full copy of the runnable application.

## 20. Final acceptance checklist (v3 patch-specific additions)

- [x] Migration `0017` patched in place again — still no `0018` created.
- [x] `student_advance_application()`/`student_update_application_note()` no longer `returns public.applications` — both `RETURNS TABLE` a narrow, structurally-safe shape.
- [x] An ordinary student has zero direct SELECT access to `applications` — the Milestone 9 read policy is dropped with no recreate.
- [x] An ordinary student has zero direct INSERT access to `applications` — the Milestone 9 insert policy is dropped with no recreate.
- [x] `get_my_applications()`/`get_my_application()` exist, are `SECURITY DEFINER`, derive identity from `auth.uid()` only, and structurally exclude `internal_notes`/`assigned_counsellor_id`/`last_contact_date`.
- [x] Another student's application is unreachable via `get_my_application()` — zero rows, not an error, not a distinguishable signal.
- [x] `student_start_application()` derives the owner from `auth.uid()` — the function signature has no owner/student-id parameter at all.
- [x] The caller cannot supply `stage`, `internal_notes`, or `assigned_counsellor_id` to `student_start_application()` — none of these are parameters; all are hardcoded/nulled inside the function.
- [x] A valid course/university pair is accepted; a mismatched pair is rejected with a safe, generic, anti-enumeration error.
- [x] A rejected or withdrawn application still permits reapplication (now enforced inside `student_start_application()` itself, not only the JS pre-check).
- [x] A genuine concurrent creation race is resolved database-side (`unique_violation` handler re-selects) rather than surfacing a raw constraint error.
- [x] The admin application create/update flow continues to work unchanged; a new shared trigger gives it the same course/university consistency guarantee without narrowing its existing capability to submit one of the two fields alone.
- [x] All five v2 protections (narrowed history RLS, `get_my_application_status_history()`, the reapplication fix, the hardened intake trigger, the defense-in-depth `UPDATE`) remain completely intact.
- [x] No payment/refund/pricing/Razorpay file was read or touched.
- [x] No migration 0001–0016 was touched; no new migration (`0018`) was created.
- [x] `typecheck`/`lint`/`test`/`build` all green — exact numbers in §17.
- [x] `docs/applications-guide.md`, `MANIFEST.md`, `M16_INSTALL_INSTRUCTIONS.md`, and this file all updated.
- [x] Actual implementation delivered and tested — not a design plan.
- [x] Update package generated: `nextwise-m16-student-application-workflow-v3.zip`, a delta/update package (only new/changed files), per this patch's own explicit packaging instruction.

## Manual QA — Student (13 steps)

Unchanged by this patch — see the original 13-step plan below; none of these steps' expected outcomes changed.

1. Log in as a student with no existing applications. Visit `/applications` — confirm the empty state renders with a "Start your first application" link to `/courses`.
2. From a course detail page, click "Start application". Confirm it succeeds and the application appears on `/applications` under **Active**, stage "Inquiry".
3. Click into the application's detail page. Confirm the progress timeline shows "Started" complete, "Preparing" current, everything after "Upcoming".
4. Click "Start preparing". Confirm the stage badge updates and the timeline advances.
5. Add a note and click "Save note". Refresh — confirm the note persisted.
6. Click "Mark ready to submit". Confirm the stage becomes "Ready to submit".
7. Click "Mark as submitted" — confirm it requires a second confirming click.
8. After submitting, confirm the "Submitted" date shows and the application moved to **Submitted**.
9. Confirm only "Withdraw application" remains available once submitted.
10. As a different student, try navigating directly to the first student's `/applications/[id]` URL — confirm 404/not-found, never the other student's data.
11. Withdraw an early-stage application — confirm it moves to **Closed** with "Withdrawn" shown.
12. Try to start a second application for the exact same course while the first is still active — confirm a friendly duplicate-application message.
13. **[Patch-specific — new step]** After the application from step 11 (now withdrawn) or an application you've had rejected by an admin, start a NEW application for that same course. Confirm a brand-new application is created (not the old withdrawn/rejected one silently reused) and it starts at stage "Inquiry".

## Manual QA — Admin (10 steps)

Unchanged by this patch — see `docs/applications-guide.md` and the original M16 delivery for the full 10-step plan (stage filter, transition options, history `(admin)` tagging, notifications, concurrent-edit conflict, student-note read-only display, `internal_notes` isolation, permission gating, search/filter).

## Manual QA — Patch-specific (RLS/IDOR verification)

1. As a logged-in student, using the browser devtools/network tab or a raw `curl` against your Supabase REST endpoint with the student's own access token, attempt `GET /rest/v1/application_status_history?application_id=eq.<their-own-application-id>&select=*`. Confirm this returns **zero rows** (not an error, not their own history) — direct table SELECT is now admin/counsellor-only.
2. With the same token, attempt `POST /rest/v1/application_status_history` with a body claiming a fabricated transition for their own application. Confirm this is **rejected** by RLS.
3. Confirm the application detail page's history timeline still renders correctly for that same student when loaded normally through the app (i.e. via `get_my_application_status_history()`).
4. As an admin, confirm `/admin/applications/[id]`'s history list still renders and still allows adding a new status entry — unaffected by the narrowed student-facing policies.
5. As a counsellor, confirm you can still see/add history entries for an application assigned to you, and confirm (via a second counsellor account, or by editing `assigned_counsellor_id` in a test row) that you cannot for one assigned to a different counsellor.
6. As a student, attempt to reapply to a course you were previously rejected from or withdrew from. Confirm a new application is created rather than the old one being silently reused or blocked.

## Manual QA — v3 patch-specific (database-boundary verification)

1. As a logged-in student, using the browser devtools/network tab or a raw `curl` against your Supabase REST endpoint with the student's own access token, attempt `GET /rest/v1/applications?student_user_id=eq.<their-own-id>&select=*`. Confirm this returns **zero rows** — direct table SELECT is now fully removed.
2. With the same token, attempt `POST /rest/v1/applications` with a body claiming `student_user_id` equal to their own id but `stage=enrolled` (or any other caller-chosen value). Confirm this is **rejected** by RLS (no INSERT policy remains).
3. Confirm `/applications` and `/applications/[id]` still render correctly for that same student when loaded normally through the app (i.e. via `get_my_applications()`/`get_my_application()`).
4. As a student, start a new application from a real, published course's page. Confirm it succeeds and appears immediately on `/applications`.
5. Using `curl`/devtools with the student's own token, call `rpc/student_start_application` directly with a `p_course_id` that is real but a `p_university_id` that belongs to a *different* real university. Confirm the call fails with a generic "could not be found" style message, never a raw constraint error, and confirm no row was inserted.
6. As an admin, confirm `/admin/applications`'s create and edit flows still work exactly as before — creating an application, changing its stage, and (if your admin UI allows submitting a course without its matching university, or vice versa) confirm the new trigger only rejects a genuinely mismatched *pair*, never a legitimate single-field submission.
7. As a student who was previously rejected/withdrawn from a course, start a new application for that same course again. Confirm a brand-new application is created.

## Manual QA — Database (SQL verification)

Run against a staging database after applying `0017_student_application_workflow.sql` (the patched version):

```sql
-- Confirm the narrowed policies (no student_user_id branch)
select polname, qual, with_check from pg_policies where tablename = 'application_status_history';

-- Confirm the new function exists and is SECURITY DEFINER, granted only to authenticated
select proname, prosecdef from pg_proc where proname = 'get_my_application_status_history';
select has_function_privilege('authenticated', 'public.get_my_application_status_history(uuid)', 'execute') as authenticated_can_call,
       has_function_privilege('anon', 'public.get_my_application_status_history(uuid)', 'execute') as anon_can_call; -- expect true, false

-- Confirm the trigger rejects a non-null intake with a null course (run inside a transaction you roll back)
begin;
  insert into public.applications (student_user_id, university_id, course_id, course_intake_id, stage, decision_status)
  values (auth.uid(), null, null, '00000000-0000-0000-0000-000000000000', 'inquiry', 'pending'); -- expect: raises an exception
rollback;

-- v3: confirm the two Milestone 9 student policies are genuinely gone
select polname from pg_policies where tablename = 'applications' and polname like 'Students %'; -- expect: zero rows

-- v3: confirm the three original admin/counsellor policies on applications are untouched
select polname from pg_policies where tablename = 'applications'; -- expect: exactly the three admin/counsellor policy names, nothing student-named

-- v3: confirm the new functions exist, are SECURITY DEFINER, and are granted only to authenticated
select proname, prosecdef from pg_proc where proname in ('get_my_applications', 'get_my_application', 'student_start_application');
select has_function_privilege('authenticated', 'public.student_start_application(uuid, uuid)', 'execute') as authenticated_can_call,
       has_function_privilege('anon', 'public.student_start_application(uuid, uuid)', 'execute') as anon_can_call; -- expect true, false

-- v3: confirm the mutation RPCs' new narrow return shape (run as a real authenticated student with a real owned application)
select * from public.student_advance_application('<their-own-application-id>', 'start_preparing'); -- expect: only id/stage/submitted_at/withdrawn_at/updated_at columns, never internal_notes

-- v3: confirm the course/university trigger rejects a mismatched pair (run inside a transaction you roll back, using two real, different universities' ids and a course that belongs to only one of them)
begin;
  insert into public.applications (student_user_id, university_id, course_id, stage, decision_status)
  values (auth.uid(), '<university-B-id>', '<a-course-belonging-to-university-A>', 'inquiry', 'pending'); -- expect: raises an exception
rollback;
```

All of the above were reasoned through against the migration's actual SQL text (this environment has no live Postgres to execute against) — see `src/lib/applications/application-workflow-migration-security.test.ts` for the equivalent automated static assertions.
