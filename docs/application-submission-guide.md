# Application Submission Preparation & Manual Submission Tracking (Milestone 19)

This guide documents the design decisions behind Milestone 19. It follows the
same "extend, don't replace" discipline as every prior application milestone
(M16 lifecycle, M17 documents, M18 processing workspace) — nothing here
invents a second architecture where an existing one already answers the
question.

## What this milestone is, and is not

Nextwise staff take an internally-reviewed application (M18-complete: required
documents accepted, checklist done) and **record** that they have already,
manually, submitted it to a university or platform outside this product. This
milestone does not attempt university API submission, browser automation,
agent-platform automation, or direct portal submission of any kind. The
button in the admin workspace says **"Record submitted application"**, never
"Submit application" — Nextwise never implies it submitted anything itself.

## 1. Submission table design

Two new tables, chosen over a single-table or JSON-column design because a
submission event has a materially different shape and audit lifecycle than
the application row itself, and needs child rows referencing exact document
versions — something no single-row design can express cleanly:

- `application_submissions` — one row per recorded submission: who, when,
  how, and with what external reference/platform/URL/internal note. Also
  captures immutable text snapshots of the university/course/intake labels
  (`university_label`, `course_label`, `intake_label`) alongside the FK
  columns, so a later rename of the linked university/course record can never
  rewrite what this historical row actually says was submitted.
- `application_submission_documents` — one row per document actually
  included, referencing the **exact** `application_documents` row id (never
  a document type alone). `document_type` is deliberately denormalized onto
  this child row (the task's own suggested example of a denormalization worth
  justifying): it lets a submission's document pack be read with zero joins,
  and stays correct even in the hypothetical case a document row's own type
  were ever edited after creation (it never is, in practice).

Both tables are **immutable once written**: neither has an `updated_at`
column, a trigger, or an UPDATE policy, and no code path in this codebase ever
issues an UPDATE against either table after the initial INSERT performed
inside `staff_record_application_submission()`.

## 2. Snapshot strategy

At submission time, `staff_record_application_submission()` selects **every
current, accepted** `application_documents` row for the application and
inserts one `application_submission_documents` row per document, referencing
that exact row's id.

A deliberate simplification: **there is no staff-selectable subset**. Earlier
drafts of this design considered accepting a caller-supplied list of document
ids to snapshot (letting staff pick exactly which accepted documents to
include). That was dropped — it would have required trusting a client-supplied
id list for something security/audit-relevant (a caller could in principle
omit a required accepted document, or reference a document belonging to a
different application), and the task's own document-snapshot rule ("only
CURRENT rows may be selected; required docs must be ACCEPTED") is something
the database can already answer completely on its own by reading
`application_documents` directly. Removing the parameter removes an entire
class of client-trust issues for a UI requirement — "show a pack preview" —
that a **read-only** preview already satisfies without needing the recording
call to also accept a selection.

`application_submission_documents.application_document_id` is
`ON DELETE RESTRICT`, not `CASCADE` or `SET NULL` — a deliberate schema-level
guarantee (not merely a documented convention) that no future cleanup code can
ever destroy a snapshotted document row. In current practice this is
belt-and-suspenders: every existing document mutation path
(`student_upload_application_document`'s replacement,
`student_remove_application_document`) already only ever sets
`is_current = false` / `removed_at`, never a hard `DELETE` (see
`0018_application_documents_foundation.sql` PARTs 6-7) — but the task
explicitly asked that FK delete behavior be inspected carefully, so this makes
the guarantee explicit rather than resting solely on "no code path happens to
delete rows today."

## 3. One submission or multiple?

**Exactly one** immutable `application_submissions` row per application,
enforced by a `UNIQUE` index on `application_id`
(`application_submissions_one_per_application`).

The current M16 lifecycle graph (`APPLICATION_STAGE_TRANSITIONS`,
`src/lib/admin/status.ts`) has no edge back from `submitted` to
`ready_to_submit` — `submitted` can only move forward to `under_review` or
`withdrawn`. This product has no resubmission semantics today. Building a
multi-submission model now would mean inventing a workflow the lifecycle
itself does not support — the task's own instruction is to choose the
smallest design consistent with the *current* transitions, not a hypothetical
future one. If a genuine "corrected resubmission" feature is ever added, it
will need its own explicit M16 lifecycle change (a new stage or a reopened
edge) first, at which point this table's one-row-per-application constraint
can be revisited (see "Limitations / deferred work" below).

The unique index doubles as this migration's core defense against two staff
racing to record the same submission simultaneously (see "Concurrency
approach" below).

## 4. Relationship to the M16 lifecycle

**Corrected after initial delivery — see
`supabase/migrations/0022_authoritative_submission_invariant.sql` for the
full record of what changed and why.** The paragraph originally here argued
that a student's own pre-existing M16 self-service `submit` action and this
milestone's staff-recorded path could both reach `submitted` "without
conflict," because a staff attempt after a student self-submit would simply
find the stage already moved on. That reasoning was wrong: it only considered
what happens when the *staff* path runs second. It never addressed the
inverse — a student's `submit` action, *unchanged by M19*, could set
`applications.stage = 'submitted'` with **no `application_submissions` row,
no document snapshot, and no immutable record at all** — the exact state
this milestone's own opening sentence says must never occur ("Nextwise
staff... **record** that they have already, manually, submitted it"). A
third path had the identical defect: the generic admin "edit application"
form (`updateApplication()`) could also set `stage` directly to `submitted`
via the same `ready_to_submit -> submitted` graph edge, again with no
submission row.

The corrected invariant, enforced at the database level (not merely by
hiding a button): **the only way any caller can ever transition an
application to `submitted` is `staff_record_application_submission()`.**
Concretely:

- A `before update` trigger on `public.applications`
  (`applications_enforce_submitted_transition()`) blocks ANY statement that
  sets `stage = 'submitted'` unless a transaction-local flag is set — and
  that flag is set, and immediately cleared, ONLY inside
  `staff_record_application_submission()`, around its own stage `UPDATE`.
  This is the actual, caller-agnostic enforcement: it holds regardless of
  whether the attempt comes from the student RPC, the admin generic update
  path, a future code path, or a direct SQL statement.
- `student_advance_application()`'s `'submit'` case (redefined in 0022) now
  raises a clear, honest error instead of performing the transition — it
  never even reaches the shared lock/UPDATE logic other actions share. This
  is defense in depth alongside the trigger, not instead of it.
- The student-facing "Mark as submitted" button no longer renders at all
  from `ready_to_submit` (`STUDENT_APPLICATION_ACTIONS.submit.fromStages` is
  now empty) — a UX courtesy on top of the two enforcement layers above,
  never a substitute for them.

Every other M16 transition (`start_preparing`, `mark_ready_to_submit`,
`withdraw`) is completely unchanged. `staff_record_application_submission()`
still reuses the **existing** `ready_to_submit -> submitted` edge inside the
same atomic transaction that creates the submission row — no new stage is
invented, and the function's own readiness/authorization/document/checklist
checks are byte-for-byte unchanged from this milestone's original delivery.

## 5. Relationship to M18 readiness

Three layers, each answering a different question, composed rather than
duplicated (see `src/lib/applications/application-submission.ts`'s own header
comment for the full explanation):

- **M16 `stage`** — the lifecycle state. Authoritative, changed only via a
  controlled transition.
- **M18 `getApplicationReadiness()`** — an operational processing signal
  ("is the staff-side prep work done"), deliberately answerable even while
  still `inquiry` or `preparing`.
- **M19 `getApplicationSubmissionReadiness()`** — the final gate. Takes M18's
  own result as an input verbatim (never re-deriving document/checklist
  logic) and adds exactly two things M18 does not: a strict requirement that
  the stage is *currently* `ready_to_submit` (the only stage the M16 graph
  allows a transition to `submitted` from), and whether a submission has
  already been recorded.

## 6. Document-version immutability strategy

Covered above under "Snapshot strategy" — the short version: exact row ids,
`ON DELETE RESTRICT`, and a fully server-derived selection with no
client-supplied document-id input.

## 7. Authorization model

Recording (`application-submissions:write`) and viewing
(`application-submissions:read`) are two new, narrow permissions — following
this codebase's established per-milestone permission-pair convention
(`application-documents:read`/`review` before it) rather than reusing the
broader `applications:write` or `application-documents:review`. Granted to
`super_admin` and `admin` unconditionally, and to `counsellor` subject to the
application's `assigned_counsellor_id` (enforced by RLS on the read side and
by `staff_record_application_submission()`'s own re-check on the write side —
never only by this permission map, which is UX, not the boundary).
`finance`, `analyst`, and `content_editor` get neither permission and are
absent from both new RLS policies entirely — the default is deny, per the
task's own instruction, not an oversight.

The database-authoritative boundary is `staff_record_application_submission()`
itself: a `SECURITY DEFINER` function that derives the caller's identity from
`auth.uid()` only, re-derives role/assignment from the current
`applications` row (never a value the caller supplied or a stale page read
earlier), and is `revoke all from public; revoke execute from anon;
grant execute to authenticated;` — the exact three-line pattern
`0019_application_document_rpc_permissions.sql` established after finding
Supabase's default privilege grants EXECUTE to `anon` directly.

## 8. Student data-exposure boundary

Students never get a direct RLS policy on either new table — the same
"prefer NOT giving students raw table SELECT access" posture this codebase
already uses for `application_documents`, `application_checklist_items`, and
`application_internal_notes`. The only student-facing path is
`get_my_application_submission()`, a narrow `SECURITY DEFINER` function whose
`RETURNS TABLE` **structurally** excludes:

- `submitted_by_user_id` — which staff member recorded it. Not useful to a
  student, and identifies an individual staff member by id.
- `internal_note` — staff-only by definition; could contain operational
  context never meant for the student.
- `external_url` — could point to an internal staff portal/login flow rather
  than something a student should follow.
- `platform_name` — a judgment call: excluded because nothing in this
  milestone's scope establishes a concrete student-facing need for it, and
  omitting it costs nothing; `university_label`/`course_label`/
  `external_reference` already cover what a student meaningfully needs to
  see.

`external_reference` **is** returned — the task explicitly allows this "if
intentionally student-visible," and an application reference number is
exactly the kind of thing a student may want to quote if they contact the
university themselves.

## 9. Concurrency approach

`staff_record_application_submission()` locks the parent `applications` row
with `SELECT ... FOR UPDATE` before any check runs, and every check re-reads
the **current** row state rather than trusting anything the caller supplied
or read earlier. Every other mutating path on the same row
(`student_advance_application`, `student_upload_application_document`,
`student_remove_application_document`, the admin `updateApplication()`
conditional UPDATE) either takes the same lock or performs its own
conditional UPDATE — so two callers racing on the same application always
serialize, and the loser always re-validates against the winner's
already-committed result. The migration's own PART 3 header comment walks
through exactly how this resolves all four of the task's explicit concurrency
cases (stale document replaced underneath a pending submit, two staff
racing to record the same submission, a counsellor losing assignment before
pressing submit, and a stage change racing a stale form submit) — see
`supabase/migrations/0021_application_submission_tracking.sql`.

The `UNIQUE` index on `application_id` is a second, independent guarantee on
top of the row lock: even if the lock were ever bypassed, a duplicate INSERT
still fails outright.

## 10. Audit behavior

Reuses the existing generic audit infrastructure
(`recordAuditLog()` / `record_admin_audit_log`, unchanged since Milestone 4) —
no second audit-log architecture. A successful recording writes one
`application_submission`-typed entry (a new, narrow `AUDIT_ENTITY_TYPES`
value, alongside M18's own `application_document_review`) with safe metadata
only (submission id, method, actor role) — never the internal note, never a
raw stored URL. `staff_record_application_submission()` also writes a normal
`application_status_history` row for the stage transition, using the exact
same `actor_type`/`student_visible_message` shape every other admin-driven
transition uses.

## 11. Limitations / deferred work

- **No resubmission workflow.** As covered above, the current M16 lifecycle
  has no path back to `ready_to_submit` after `submitted`. If a future
  milestone adds one (e.g. for a corrected resubmission after a rejection),
  `application_submissions`' one-row-per-application constraint will need
  revisiting — likely relaxing the unique index to "one *current* submission
  per application" with a `superseded_at`/`is_current` flag mirroring
  `application_documents`' own versioning pattern, rather than inventing
  something new.
- **No "acknowledged" submission status.** The task allowed one optionally,
  "ONLY if actual M19 functionality uses it." Nothing in this milestone
  records a university acknowledgement, so the submission-status vocabulary
  stays at exactly one value in practice (`submitted`, expressed as the M16
  stage itself — there is no separate `application_submissions.status`
  column at all). A future milestone that genuinely tracks acknowledgement
  events can add one then.
- **No downloadable ZIP export of the submission pack.** The task allowed
  this only if "genuinely required" and safe infrastructure already exists;
  a visual summary (the admin workspace's pack preview and submission-history
  document list) was judged sufficient.
- **`agent_partner` is a label only.** It exists in the submission-method
  vocabulary purely to describe how a submission happened when an
  agent/partner handled it — this milestone implements no agent workflow,
  portal, or commission logic of any kind, and none should be inferred from
  the label's presence.

## 12. In-place correction — the authoritative "submitted" invariant

Summarized in full in §4 above; recorded again here as its own numbered
section so it is not missed on a skim. This milestone's original delivery
left two alternate paths (the pre-existing M16 student `submit` action, and
the admin generic `updateApplication()` edit form) able to set
`applications.stage = 'submitted'` directly, with no `application_submissions`
row created — violating this milestone's own core premise. Fixed by
`supabase/migrations/0022_authoritative_submission_invariant.sql`:

- A `before update` database trigger on `public.applications` now blocks
  every UPDATE that would set `stage = 'submitted'` unless a
  transaction-local flag is set — set, and immediately cleared, ONLY inside
  `staff_record_application_submission()`. This is the real,
  caller-agnostic enforcement.
- `student_advance_application()`'s `'submit'` case now raises a clear,
  honest error instead of performing the transition (defense in depth
  alongside the trigger).
- `src/lib/applications/application-lifecycle.ts`: the student-facing "Mark
  as submitted" button no longer renders from `ready_to_submit`
  (`STUDENT_APPLICATION_ACTIONS.submit.fromStages` is now `[]`), and
  `getApplicationNextAction("ready_to_submit")` no longer claims the student
  can perform this step.

Nothing else in this milestone changed: every readiness/authorization/
document/checklist check inside `staff_record_application_submission()`,
the table design, the snapshot strategy, and the authorization model are all
exactly as originally delivered and described in §§1-10 above.
