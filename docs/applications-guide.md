# Student Application Workflow Guide (Milestone 16)

This document covers the operational student application workflow: the
canonical `applications` data model, its status lifecycle, who can do what
to an application and how that is enforced, the student- and admin-facing
surfaces, and what is deliberately **not** built yet.

Milestone 16 does not introduce a new applications table. `public.applications`
and `public.application_status_history` were created in Milestone 7
(`0004_admin_system.sql`) and already had student read/insert access from
Milestone 9 (`0006_global_university_course_data.sql`). This milestone
extends that one canonical model — see §1 — rather than creating a second,
competing one.

## 1. Domain model

One row in `public.applications` per (student, university, course)
application attempt. Relevant columns, Milestone 7 unless noted:

| Column | Notes |
| --- | --- |
| `student_user_id` | Owner. Server-assigned on every write path — never trusted from client input. |
| `university_id` / `course_id` | Nullable FKs. University/course names and country are always resolved through these, never duplicated onto `applications`. |
| `course_intake_id` *(M16)* | Optional FK to `course_intakes`. Preferred over the free-text `intake` column when a real intake record exists (spec: "prefer a real course_intake_id over free text"). No UI currently sets it (see §8, known limitations) — it exists so a future intake-picker can link to it without a further migration. |
| `stage` | The controlled status field — see §2. |
| `intake` | Free-text intake label, admin-authored. Left exactly as Milestone 7 defined it. |
| `submission_date` | A plain, hand-typed date an admin may backfill. Distinct from `submitted_at` below. |
| `decision_status`, `offer_type`, `deadlines` (jsonb), `next_action`, `next_action_date`, `last_contact_date` | Admin-operational fields, unchanged by this milestone. |
| `internal_notes` | Admin/counsellor-only. **Never** shown to the student — see §5 for how that boundary is enforced. |
| `student_note` *(M16)* | The student's own note. Entirely separate column from `internal_notes` — the two are never conflated, in either direction. |
| `submitted_at` *(M16)* | Set atomically, server-side, the moment `stage` transitions to `submitted` — by either the student's own action or an admin update. Never hand-typed. |
| `decision_at` *(M16)* | Set atomically when `stage` reaches `offer_received` or `rejected`. |
| `withdrawn_at` *(M16)* | Set atomically when `stage` reaches `withdrawn`. |

`public.application_status_history` records one row per stage change:
`from_status`, `to_status`, `changed_by`, `created_at`, plus two Milestone 16
columns:

- `actor_type` — `'student' | 'admin' | 'counsellor' | 'system'`. Defaults to
  `'system'` so every pre-existing row keeps a sensible value.
- `student_visible_message` — the **only** free-text field on this table ever
  shown to a student. The pre-existing `note` column stays admin/counsellor-
  internal, exactly like `internal_notes` above — the two history text
  fields are never conflated.

This one table already serves both purposes the spec distinguishes: an
admin audit trail (Milestone 7) and a student-facing lifecycle timeline
(Milestone 16). The column-level split above is what keeps that distinction
honest without a second table.

## 2. Status lifecycle

`ApplicationStage` (`src/types/admin.ts`) — Milestone 7's ten values plus one
Milestone 16 addition, **`ready_to_submit`**, inserted between `preparing`
and `submitted`:

```
inquiry → preparing → ready_to_submit → submitted → under_review
        → interview → decision_pending → offer_received → enrolled
                                        → rejected
(any of inquiry/preparing/ready_to_submit/submitted/under_review/interview) → withdrawn
```

The full transition graph lives in one place —
`APPLICATION_STAGE_TRANSITIONS` in `src/lib/admin/status.ts` — and every
write path validates against it via `isValidTransition()`. `enrolled`,
`rejected`, and `withdrawn` are terminal: no edges leave them. Reopening a
terminal application is out of scope for this milestone.

Two independent enforcement layers exist and are kept in sync deliberately:

1. **The admin path** (`updateApplication()`) reads `APPLICATION_STAGE_TRANSITIONS`
   directly and rejects any transition it does not permit.
2. **The student path** (`student_advance_application()`, a SQL function —
   see §4) hardcodes a small, fixed action vocabulary, each with its own
   exact `(from stage set → to stage)` pair. Every edge that function
   implements is a strict subset of what `APPLICATION_STAGE_TRANSITIONS`
   already allows — `src/lib/admin/status.test.ts` asserts that subset
   relationship stays true.

Students can never directly reach `under_review`, `interview`,
`decision_pending`, `offer_received`, `enrolled`, or `rejected` — those
require admin/counsellor/system authority. This is enforced structurally
(the SQL function's `case` statement has no branch that produces any of
those six stage values), not just by convention.

## 3. Student self-service actions

`STUDENT_APPLICATION_ACTIONS` (`src/lib/applications/application-lifecycle.ts`)
is the single source of truth for the four actions a student may take:

| Action | From | To | Confirmation |
| --- | --- | --- | --- |
| `start_preparing` | `inquiry` | `preparing` | No |
| `mark_ready_to_submit` | `preparing` | `ready_to_submit` | No |
| `submit` | `ready_to_submit` | `submitted` | Yes |
| `withdraw` | `inquiry`, `preparing`, `ready_to_submit`, `submitted`, `under_review`, `interview` | `withdrawn` | Yes |

`getAvailableStudentActions(stage)` derives the buttons a UI should show —
never a raw stage string comparison duplicated per page.

**Withdrawal rule** (documented per the spec's "document the chosen rule"
requirement): a student may withdraw from any pre-decision stage, but not
from `decision_pending` — the one stage whose entire meaning is "a decision
is imminent". This mirrors the pre-existing Milestone 7 graph exactly; it is
not a new business rule invented for this milestone, only the first time a
student can trigger it themselves rather than an admin.

**Honesty about submission**: the `submit` action's button reads "Mark as
submitted", and its next-step copy never claims NextWise electronically
transmitted anything to the university. There is no real university
integration in this codebase — this system tracks the student's own
application *journey*, nothing more, until a real integration exists.

## 4. Security: RLS, ownership, and the two student RPCs

Ownership is enforced in three independent layers, so that "hiding a button
in the UI" is never the only thing standing between a student and another
student's data:

1. **RLS** on `applications` (Milestone 9) already scopes student SELECT/INSERT
   to `student_user_id = auth.uid()`.
2. **Server-side query scoping** — every student-facing read function
   (`getMyApplicationById`, `getMyApplicationHistory`, `listMyApplications`)
   adds its own `.eq("student_user_id", user.id)` filter rather than trusting
   RLS alone to reject a mismatched row. A request for another student's
   application id resolves to `null` — indistinguishable from "does not
   exist" — so changing the URL can never be used to enumerate or probe
   other students' applications.
3. **The two SECURITY DEFINER RPCs** for writes (below) re-validate
   `auth.uid()` and ownership *inside their own `UPDATE ... WHERE` clause*,
   never relying on an earlier, separate read.

### Why RPCs instead of a broader RLS UPDATE policy

A plain RLS `UPDATE` policy's `USING`/`WITH CHECK` clauses can restrict
*which rows* a student may touch, but cannot cheaply restrict *which
columns* an update may change, or *which stage values* it may set. Two
narrow, `SECURITY DEFINER`, `search_path`-pinned RPCs do that safely instead
— the same pattern Milestone 13's `claim_refund_for_processing()`/
`finalize_refund()` already established for refunds:

- **`student_advance_application(p_application_id, p_action)`** — locks the
  row `FOR UPDATE`, validates `auth.uid()` and ownership in the same
  `SELECT`, checks the current stage is in the action's fixed `from` set,
  performs the stage change and the timestamp stamping
  (`submitted_at`/`withdrawn_at`) atomically, and writes the matching
  `application_status_history` row (`actor_type = 'student'`) — all as one
  transaction. A caller that isn't the owner, or whose stage has already
  moved on, gets the exact same generic error either way (see §6), so the
  two cases can never be distinguished by probing.
- **`student_update_application_note(p_application_id, p_note)`** — the only
  path that ever writes `student_note`. Trims, blank-collapses, and caps
  length at 2000 characters (also enforced by
  `applications_student_note_length_check` as defense in depth). Touches no
  other column.

Both are `revoke all ... from public; grant execute ... to authenticated;` —
never callable by `anon`.

### Closing a pre-existing IDOR gap

The audit for this milestone found that `application_status_history`'s
original (Milestone 7) RLS policies checked only "does an application with
this id exist" — never "is it mine, or one I administer". That was
harmless while only admin/counsellor roles could reach `applications` at
all, but Milestone 9 gave students read access to their own applications,
and this milestone builds a student-facing timeline directly on this table
— at which point the gap becomes a real IDOR (any authenticated user could
read or insert a history row for *any* application by id). Migration
`0017_student_application_workflow.sql` PART 4 narrows both the SELECT and
INSERT policies to require the caller either administers the referenced
application or owns it.

### Post-review security patch (four fixes, same migration — 0017 was not yet applied to any database, so it was patched in place rather than superseded by 0018)

An internal security review of the first version of this milestone found
that the IDOR-gap fix above was still too permissive in two ways, plus two
smaller correctness gaps. All four are fixed directly in
`0017_student_application_workflow.sql` (see
`src/lib/applications/application-workflow-migration-security.test.ts` for
the automated static-SQL regression tests proving each one):

1. **Students cannot directly INSERT lifecycle history.** The first
   version's `application_status_history` INSERT policy still had an
   `a.student_user_id = auth.uid()` branch — meaning a student could insert
   a history row for their own application directly (e.g. via
   supabase-js/PostgREST), not only through `student_advance_application()`.
   That defeats the entire point of the RPC: a student could forge an
   arbitrary `from_status`/`to_status`/`student_visible_message` row without
   the application itself ever actually changing stage. **Fixed** by
   removing that branch entirely — the INSERT policy is now admin/counsellor
   only (`super_admin`/`admin` unconditionally; `counsellor` scoped to
   applications assigned to that specific counsellor via
   `current_counsellor_id()`). A student's own history rows are written
   exclusively by `student_advance_application()`, which is `SECURITY
   DEFINER` and therefore executes as the function owner — it is
   unaffected by this narrowing, and remains the *only* path by which a
   student's history row can ever be created.

2. **Student-safe history prevents internal-note leakage at the database
   boundary, not just in application code.** RLS restricts which *rows* a
   policy allows, never which *columns* a permitted row exposes. Even
   though this codebase's own TypeScript never selected `note`/`changed_by`
   for a student, a student's own supabase-js session could, in principle,
   issue the same PostgREST request with those columns added to the select
   list, and the first version's row-level "is this my application" SELECT
   policy would have let it through. **Fixed** two ways: the SELECT policy
   also lost its `student_user_id` branch (a student now gets zero rows
   querying the table directly, same as INSERT), and a new function,
   `get_my_application_status_history(p_application_id)`, is the only way a
   student reads their own history. It is `SECURITY DEFINER`, re-verifies
   `application.student_user_id = auth.uid()` itself, and its `RETURNS
   TABLE` column list is `id, from_status, to_status, actor_type,
   student_visible_message, created_at` — `note` and `changed_by` are not
   merely left out of a `SELECT`, they do not exist anywhere in the
   function's return shape, so this boundary holds even against a caller
   that bypasses this file's TypeScript entirely.
   `getMyApplicationHistory()` in
   `src/lib/supabase/education/applications.ts` was updated to call this
   RPC instead of querying the table directly.

3. **Reapplication after `rejected`/`withdrawn` works correctly.**
   `startApplicationFromCourse()`'s pre-check (the fast, friendly path that
   avoids surfacing a raw constraint violation) used to match on
   `student_user_id` + `course_id` alone, with no stage filter — so an old
   `rejected` or `withdrawn` application was returned as "the existing
   application" forever, silently blocking the new application the
   database's own partial unique indexes (§7 below) were deliberately
   designed to allow. **Fixed** by adding `.not("stage", "in",
   "(rejected,withdrawn)")` plus `.limit(1)` to the pre-check query, so it
   now matches the database's own definition of "active" exactly: only a
   non-terminal application is reused; a terminal one falls through to a
   fresh `INSERT`. `.limit(1)` also makes the query safe against ever
   returning more than one row (which would otherwise throw inside
   `.maybeSingle()`) even with several historical terminal applications for
   the same course.

4. **`course_intake_id`/`course_id` invariant hardened.**
   `validate_application_course_intake()`'s original guard only validated
   when *both* `course_intake_id` and `course_id` were non-null
   (`if new.course_intake_id is not null and new.course_id is not null
   then`) — so the nonsensical combination `course_intake_id != null,
   course_id = null` silently skipped validation entirely. **Fixed** by
   restructuring to `if new.course_intake_id is not null then` as the outer
   guard, with an explicit `if new.course_id is null then raise exception`
   check inside it before the existing cross-table lookup. A null
   `course_intake_id` is still always accepted, unchanged.

5. **Defense-in-depth ownership condition on `student_advance_application()`'s
   final `UPDATE`.** The function's `SELECT ... FOR UPDATE` already locked
   the row and validated ownership/stage before doing anything else, which
   is what actually makes it safe against a concurrent race — but the final
   `UPDATE` statement that performs the transition read only `WHERE id =
   p_application_id`, relying entirely on that earlier check rather than
   re-asserting its own scope. **Fixed** by adding `and student_user_id =
   auth.uid() and stage = v_old_stage` to that `UPDATE`'s own `WHERE`
   clause — matching the same "re-check ownership in the statement that
   performs the write, never only in a preceding read" discipline already
   used by `student_update_application_note()` and both
   `application_status_history` RLS policies. If this `UPDATE` ever
   unexpectedly affects zero rows (should be unreachable given the row
   lock, but is now handled rather than assumed), the function raises the
   same generic, anti-enumeration error used everywhere else in it, and
   never inserts a history row for a transition that did not actually
   happen.

### v3 patch — final student database-boundary hardening (same migration — 0017 still not applied to any database, so patched in place again rather than a new `0018`)

A second, deeper security review found that the v2 patch above still left
three database-authoritative gaps: the two mutation RPCs returned the
**full** `applications` row (not just the columns their callers actually
use), an ordinary student still had **direct table SELECT/INSERT access**
to `applications` itself (RLS restricts rows, not columns — the exact same
class of gap v2 already fixed for `application_status_history`), and
application **creation** went through a direct `INSERT` guarded only by
`student_user_id = auth.uid()`, with no restriction on any other column at
all. All three (plus a related course/university consistency gap) are fixed
directly in `0017_student_application_workflow.sql` PARTs 7-10:

1. **Mutation RPC return shapes narrowed (PART 3.1/3.2 updated).**
   `student_advance_application()` and `student_update_application_note()`
   both used to `returns public.applications` — the full row, including
   `internal_notes`, `assigned_counsellor_id`, and `last_contact_date`. Even
   though the TypeScript callers (`advanceMyApplication()`/
   `updateMyApplicationNote()`) already discarded the returned row entirely,
   that was only an application-layer convention: any caller invoking
   either RPC directly would receive those staff-only fields on their own
   response. **Fixed** by narrowing both to a `RETURNS TABLE` of exactly the
   columns a caller has any legitimate reason to see —
   `student_advance_application()` returns `(id, stage, submitted_at,
   withdrawn_at, updated_at)`; `student_update_application_note()` returns
   `(id, student_note, updated_at)`. Structurally, not by convention: the
   composite type these functions return simply has no
   `internal_notes`/`assigned_counsellor_id`/`last_contact_date` field.

2. **Direct student SELECT/INSERT on `applications` removed entirely (PART
   7).** The two student RLS policies from Milestone 9
   (`0006_global_university_course_data.sql` PART 16 — "Students can read
   their own applications" and "Students can start their own application
   from a course") restricted *rows* only. The SELECT policy would let a
   student's own session request `internal_notes`/`assigned_counsellor_id`/
   `last_contact_date` directly, regardless of what this codebase's own
   TypeScript selected. The INSERT policy's `WITH CHECK` constrained *only*
   `student_user_id = auth.uid()` — nothing stopped a direct caller from
   inserting a row with an arbitrary `stage`, `decision_status`,
   `assigned_counsellor_id`, or `internal_notes`, as long as the owner
   matched. **Fixed** by dropping both policies from within `0017` (they are
   defined in `0006`, which per this patch's own migration rule is never
   edited directly — the same "drop-from-a-later-migration" pattern PART 4
   already used for the `application_status_history` policies originally
   defined in `0004`). An ordinary student now has **zero** direct SELECT or
   INSERT capability on `applications`. The three original admin/counsellor
   policies from `0004_admin_system.sql` have no `student_user_id` branch
   and are completely unaffected.

3. **`get_my_applications()` / `get_my_application(p_application_id)` — the
   new student read RPCs (PART 8).** Replace the direct-table reads
   `listMyApplications()`/`getMyApplicationById()` used before this patch.
   Both are `SECURITY DEFINER`, `STABLE`, derive identity from `auth.uid()`
   only (never a caller-supplied student id — `get_my_application()` takes
   only an application id), and their shared `RETURNS TABLE` shape lists
   exactly the 18 columns `MY_APPLICATION_COLUMNS` already named as safe —
   structurally excluding `internal_notes`/`assigned_counsellor_id`/
   `last_contact_date`. `get_my_application()` returns zero rows (never an
   error) for another student's application id, matching this migration's
   existing anti-enumeration posture.

4. **`student_start_application(p_course_id, p_university_id)` —
   database-authoritative application creation (PART 9).** Replaces
   `startApplicationFromCourse()`'s direct `INSERT`. Every protected field
   is set by the function itself and cannot be influenced by the caller:
   `student_user_id` is always `auth.uid()`, `stage` is always hardcoded
   `'inquiry'`, `decision_status` is always the canonical `'pending'`
   (matching `0004`'s own `applications_decision_status_check`),
   `assigned_counsellor_id`/`internal_notes`/`last_contact_date` are always
   `null`. It reuses an existing non-terminal application for the same
   course (mirroring the pre-existing pre-check, `rejected`/`withdrawn`
   excluded so reapplication always works), and wraps its `INSERT` in a
   `unique_violation` exception handler that re-selects the winning row on a
   genuine concurrent race rather than surfacing the raw constraint
   violation. Returns only the application `id`, never the full row.

5. **Course/university pairing verified server-side, for both the student
   RPC and the admin path (PART 10).** Audited (not guessed) via
   `0004_admin_system.sql`'s own `public.courses` definition:
   `courses.university_id` is the sole, direct, `NOT NULL` FK relationship —
   there is no campus-mediated indirection anywhere in this schema.
   `student_start_application()` verifies the supplied course/university
   pair against that real FK, and additionally requires both the course and
   its parent university to be `is_active = true and publication_status =
   'published'` — the exact same gate `0006`'s own pre-existing public
   course-browsing policy ("Public can read published active courses of
   published unis") already uses, so a student can never start an
   application against a pair they could not already see on the public
   site. One generic error covers every distinct failure reason (course
   missing / wrong university / not published), matching this migration's
   anti-enumeration discipline elsewhere. Separately, a new trigger,
   `validate_application_course_university()`, gives the pre-existing admin
   create/update path (`src/lib/supabase/admin/applications.ts`) the same
   protection at the table level — auditing that code found `university_id`/
   `course_id` are taken independently from raw form fields with no
   correlation enforced today, so (mirroring
   `validate_application_course_intake()`'s own "skip when the referenced
   column is null" precedent) the trigger validates the pairing only when
   **both** columns are non-null, never narrowing the admin form's existing
   ability to submit one without the other.

`startApplicationFromCourse()`/`listMyApplications()`/`getMyApplicationById()`
in `src/lib/supabase/education/applications.ts` were all rewritten to call
the new RPCs via `supabase.rpc(...)` instead of `.from("applications")`. The
`application_started` analytics event still fires only on a genuine new
creation, not a resumed application — since the RPC intentionally returns
only an id with no "was this new" signal, a fast, best-effort pre-check via
`get_my_applications()` decides whether to call `student_start_application()`
at all; this is a UX/analytics nicety only, never a security boundary (the
database itself remains authoritative for whether a duplicate is created).

## 5. What a student can never see

As of the v3 patch, this is **database-authoritative** for every
student-facing read and write on `applications`, not a TypeScript
convention: `listMyApplications()`, `getMyApplicationById()`,
`startApplicationFromCourse()`, `advanceMyApplication()`, and
`updateMyApplicationNote()` all go through a narrow `SECURITY DEFINER` RPC
(`get_my_applications()`, `get_my_application()`,
`student_start_application()`, `student_advance_application()`,
`student_update_application_note()` respectively) whose `RETURNS TABLE` (or
scalar `uuid`, for creation) shape structurally excludes `internal_notes`,
`assigned_counsellor_id`, and `last_contact_date` — they do not merely go
unselected, they do not exist anywhere in the function's return type. The
underlying `applications` table's own RLS grants an ordinary student **zero**
direct SELECT or INSERT access at all (the two student policies from
Milestone 9 are dropped — see §4's v3 subsection). Even a caller that
bypassed this codebase's TypeScript entirely and called a Supabase RPC or
queried the table directly could not retrieve or write any of those
staff-only fields for their own application.

`getMyApplicationHistory()`'s exclusion of `application_status_history`'s
`note`/`changed_by` columns is the same story, one layer over (unchanged
since v2 — see §4's "Post-review security patch" #2 above): it calls
`get_my_application_status_history()`, a `SECURITY DEFINER` function whose
`RETURNS TABLE` shape structurally does not include those two columns, and
the underlying table's own RLS no longer grants an ordinary student any
direct SELECT on it at all.

## 6. Concurrency: no stale last-write-wins

Every state-changing write in this milestone is a single, database-
authoritative conditional operation — never "read, decide in application
code, then write by id alone":

- **Student RPCs**: `SELECT ... FOR UPDATE` locks the row before validating
  the current stage, so a concurrent call to the same RPC on the same
  application serializes rather than racing.
- **Admin `updateApplication()`**: performs
  `UPDATE applications SET <patch> WHERE id = :id AND stage = :expectedCurrentStage
  RETURNING *`. If zero rows come back, some other actor (another admin, or
  the student's own RPC) already moved the row since it was read — this
  surfaces as a plain "this application was updated by someone else —
  refresh and try again" error, **never** a silent overwrite and never an
  automatic retry (a retry would just re-run the same stale decision).

This mirrors the exact pattern the Milestone 13 FINAL FINANCIAL SAFETY
PATCH established for refunds (`applyRefundTransition()` in
`src/lib/supabase/admin/refunds.ts`).

## 7. Duplicate-application protection

Rule: a student may have **at most one non-terminal (not `rejected`/
`withdrawn`) application** per course, further scoped by intake when a real
`course_intake_id` is linked. Two partial unique indexes enforce this (not
one — Postgres treats every `NULL` in a unique index as distinct from every
other `NULL`, so a single combined index would never fire for the common
"no intake linked" case):

- `applications_one_active_per_student_course_no_intake` — `(student_user_id, course_id)`
  where `course_intake_id is null`.
- `applications_one_active_per_student_course_intake` — `(student_user_id, course_id, course_intake_id)`
  where `course_intake_id is not null`.

`rejected` and `withdrawn` are deliberately excluded from "active" — a
student may legitimately reapply after either. Every other stage counts as
active, including `enrolled` (reapplying to a course you're already
enrolled in is never a legitimate case this constraint needs to allow).
`startApplicationFromCourse()` maps the resulting constraint violation to a
plain "you already have an active application for this course" message —
never a raw Postgres error.

**Reapplication after `rejected`/`withdrawn`** (post-review v2 patch, see
§4): the rule that a terminal application is never reused, and instead a
fresh application is created, was originally enforced by a JS-side
pre-check filtering `.not("stage", "in", "(rejected,withdrawn)")`.

**As of the v3 patch**, the authoritative version of this same rule now
lives **inside** `student_start_application()` itself (§4's v3 subsection):
the RPC's own reuse-or-insert logic excludes `rejected`/`withdrawn` from
"an existing application to resume", exactly matching the two indexes
above. The TypeScript-side check in `startApplicationFromCourse()` still
exists, but its role changed — it now calls `get_my_applications()` purely
to decide whether to fire `application_started` analytics (a UX/analytics
nicety, not a security or correctness boundary); even if that pre-check
missed a race, `student_start_application()` itself would still correctly
reuse or create the right row. The two partial unique indexes remain the
authoritative protection against a genuine concurrent double-submission
race — the RPC's own `unique_violation` exception handler catches that case
and re-selects the winning row rather than surfacing the raw constraint
violation.

## 8. Student surfaces

- **`/applications`** — real data, grouped into four honest buckets
  (`getApplicationBucket()`): Active / Submitted / Decision / Closed, with
  real per-bucket counts (never a vanity metric) and a clear empty state
  ("Start your first application" → `/courses`).
- **`/applications/[id]`** — university/course/intake, real resolved
  deadline (or "Deadline not available" — never a guessed date, see §9), a
  five-stage honest progress timeline, the student's own editable note, a
  student-safe history feed, and the available action buttons for the
  current stage.

Deadlines are resolved by `resolveApplicationDeadline()` from a linked
`course_intakes` row only — `final_deadline` first, then
`international_deadline`, then `priority_deadline`. No linked intake, or an
intake with none of those three fields populated, resolves to `null`,
rendered as "Deadline not available". Nothing in this milestone invents or
estimates a date.

The progress timeline (`getApplicationProgressStages()`) is five fixed,
honest milestones — Started / Preparing / Submitted / Under review /
Decision — each `complete`/`current`/`upcoming`. There is no fabricated
completion percentage anywhere in this feature. `withdrawn` is flagged via
`isTerminalWithoutProgress()` and rendered as its own explanatory state
rather than forced onto the forward-moving bar.

## 9. Admin surfaces

`/admin/applications` and `/admin/applications/[id]` already existed from
Milestone 7 as a mature CRUD surface (list/search/filter, create, edit,
stage history) and needed only small, additive changes for this milestone:
`ready_to_submit` added to the stage filter/select options (the stage
`<select>` itself already derives its options from
`APPLICATION_STAGE_TRANSITIONS`, so it required no change), and a new
"Student-visible details" card on the detail page showing the student's own
note (read-only — an admin never edits it) and the three new timestamps.
Admin status changes go through the same `requireAdminPermission("applications:write")`
gate as before. `updateApplication()` now also fires
`application_status_changed` analytics and a best-effort student
notification on `offer_received`/`rejected` (never on every intermediate
move — see §10).

There is intentionally no counsellor case-management workspace, no bulk
actions, and no course/intake admin filter beyond what already existed —
that is Milestone 18/19 scope.

## 10. Analytics & notifications

Three new, real (not reserved) analytics events, registered in
`src/lib/analytics/events.ts` and the `product_events_event_name_check`
constraint:

- `application_status_changed` — fired from the admin update path on every
  committed stage change.
- `application_submitted` — fired when a student's own `submit` action
  succeeds.
- `application_withdrawn` — fired when a student's own `withdraw` action
  succeeds.

(`application_started`, from Milestone 9, is unchanged.)

Notifications reuse the existing `Notifier`/`LoggingNotifier` abstraction
(Milestone 10) — today this means a structured log line, honestly, not a
real email send (see `src/lib/notifications/notifier.ts`'s own docblock).
Three new templates: `application_submitted` (to the student, on their own
submit), `application_offer_received` and `application_rejected` (to the
student, on the matching admin-driven stage change). There is deliberately
no `application_status_changed` notification template — most intermediate
moves are not notification-worthy; offer/rejection are the two that are.

## 11. Testing

- `src/lib/applications/application-lifecycle.test.ts` — pure logic (next
  action, progress stages, buckets, deadline resolution, available
  actions).
- `src/lib/applications/application-workflow-migration-security.test.ts` —
  static assertions against the migration SQL text (locking, `SECURITY
  DEFINER`, grants, RLS narrowing, the two partial unique indexes, the
  additive `product_events` widening).
- `src/lib/supabase/admin/applications.test.ts` — the admin update path's
  atomic conditional update, timestamp stamping, and notification/analytics
  firing, against a hand-rolled in-memory Supabase fake.
- `src/lib/supabase/education/applications.test.ts` — the student-facing
  ownership boundary (`getMyApplicationById`/`getMyApplicationHistory`
  return nothing for a foreign application id), the RPC-delegating
  mutation functions, and the duplicate-application error mapping.
- `src/lib/admin/status.test.ts` — extended with the new
  `ready_to_submit` edges and a regression test confirming
  `preparing → submitted` is no longer a direct, one-step transition.

**Post-review security patch (v2)** added coverage for all five fixes in
§4: the narrowed `application_status_history` INSERT/SELECT policies and
the new `get_my_application_status_history()` function (all in
`application-workflow-migration-security.test.ts`), the reapplication fix
and multi-historical-terminal-application safety
(`education/applications.test.ts`'s `startApplicationFromCourse`
describe block), and the `student_advance_application()` defense-in-depth
`UPDATE` scoping (`application-workflow-migration-security.test.ts`).

**v3 (final student database-boundary hardening)** added 53 new tests
across the same two files (45 in
`application-workflow-migration-security.test.ts`, 8 in
`education/applications.test.ts`), covering every item in §4's v3
subsection: both
mutation RPCs' narrowed `RETURNS TABLE` shapes and their `return query`
restructuring; `get_my_applications()`/`get_my_application()`'s safe-column
shape and `auth.uid()`-only identity; confirmation that the two student
direct-access policies are genuinely dropped (cross-checked against their
real, unmodified definition in `0006`) with no corresponding recreate;
every protected field `student_start_application()` sets itself
(owner/stage/decision_status/internal_notes/assigned_counsellor_id) with no
caller-supplied parameter to override any of them; the course/university
verification query and the new `validate_application_course_university()`
trigger (cross-checked against the real `courses.university_id` FK and the
real public course-browsing policy, both audited from source rather than
assumed); the `unique_violation` exception handler; that the three original
admin/counsellor policies and all five v2 protections remain completely
untouched; and a payment-isolation check confirming no payment/refund/
Razorpay/pricing/invoice/tax object is created, altered, or dropped by this
migration (`education/applications.test.ts`'s rewritten
`startApplicationFromCourse`/`getMyApplicationById`/`listMyApplications`
describe blocks cover the TypeScript-orchestration side of the same RPC
boundary). See `M16_COMPLETION_REPORT.md`'s "v3 patch" section for the exact
before/after test counts.

## 12. Known limitations

Deliberately out of scope for this milestone (candidates for later
milestones, not implemented here even partially):

- **No intake-picker UI.** `course_intake_id` exists on the schema and is
  fully validated (a trigger rejects a mismatched course), but no student-
  or admin-facing UI currently sets it — every application today has
  `course_intake_id = null` and shows "Deadline not available" unless an
  admin sets it directly (there is no admin UI for that either yet).
- **No "start application from a saved/recommended item" wiring.** Starting
  an application is still only possible from a course detail page.
- **No document upload, SOP, or LOR workflow** was in scope for THIS
  milestone. Document upload/view/replace/remove now exists as of Milestone
  17 (v2) — see `docs/application-documents-guide.md`. SOP/LOR generation
  remains Milestone 23/24, undelivered.
- **No counsellor case-management workspace** — Milestone 18.
- **No structured shortlisting** — Milestone 19.
- **No offer comparison/acceptance beyond a status** — `offer_received` is
  shown as a plain state with its decision timestamp; comparing or
  accepting offers is Milestone 27/28.
- **No real university submission integration.** Every "submit" action in
  this system is the student's own record-keeping, never an actual
  transmission to a university — copy throughout this feature is written to
  never imply otherwise.
- **No visa workflow** — Milestone 30+.
- **No reopen-from-terminal flow.** `enrolled`/`rejected`/`withdrawn` are
  dead ends in this milestone; a genuine re-application creates a new
  application row (permitted by the duplicate-protection rule in §7).
- **Payment/refund/pricing/invoice code is entirely untouched** — those
  remain exactly as Milestone 12/13 left them; M14/15 reconciliation issues,
  if any, are still deferred.
