# Application Processing Guide — Milestone 18

Counsellor Application Processing Workspace. Builds directly on Milestone 16
(student application lifecycle) and Milestone 17/17-v3 (application
documents foundation + least-privilege hardening), both of which are
preserved unchanged. This is **not** a new application architecture — it
adds a staff review layer, an operational checklist, internal notes, and a
deterministic readiness/next-action calculation on top of the existing
`applications` / `application_documents` / `application_status_history`
tables.

## 1. Database design

**Decision: extend `application_documents` with review columns (Option A),
not a separate `application_document_reviews` table (Option B).**

Milestone 17 already gives every document row immutable, append-only version
semantics: a replacement or a fresh upload always inserts a *new* row (never
an in-place update of the old one — `student_upload_application_document()`,
0018 PART 6), and the old row is simply flipped to `is_current = false`.
That property means a plain column with `DEFAULT 'pending_review'` already
satisfies "a replacement must require review again, and must never inherit
the retired document's ACCEPTED state" — for free, with zero changes to
0018's insert path. A separate review-events table was seriously considered
(it would give a cleaner "who reviewed what, when, across every version"
audit trail) but was rejected for this milestone: it would duplicate the
`is_current`-scoped row identity 0018 already maintains, and nothing in this
milestone's scope needs a *history* of review decisions across superseded
document versions — only the current document's current review state.
`admin_audit_log` (see §4) already captures every review decision as an
audit event if that history is ever needed later.

New columns on `application_documents` (migration `0020`, PART 1):

| Column | Type | Notes |
|---|---|---|
| `review_status` | `text not null default 'pending_review'` | CHECK-constrained to the three values below |
| `reviewed_at` | `timestamptz` | server-derived (`now()`), never client-supplied |
| `reviewed_by` | `uuid references auth.users` | server-derived (`auth.uid()`), never client-supplied |
| `review_note` | `text` | INTERNAL, staff-only, ≤2000 chars |
| `correction_message` | `text` | STUDENT-FACING, ≤1000 chars, kept in its own column |

RLS note: RLS restricts *rows*, not *columns*. The existing admin/counsellor
SELECT policy on this table (0018 PART 2) already covers these five new
columns for whichever rows it already permitted — no RLS policy change was
needed for read access.

## 2. Document review states

**Decision: the simplified three-state model — `pending_review`,
`accepted`, `needs_correction`.** A fourth `rejected` state was considered
(and is explicitly offered as an option in the task spec) and dropped: since
a student can always replace a document, `rejected` and `needs_correction`
would have had no distinct operational consequence in this MVP — a
counsellor uses `needs_correction` with a `correction_message` either way,
and the student's only available response to either is "upload a new one."
Smallest useful model, chosen deliberately and documented here per the
task's own instruction.

## 3. Authorization

A new, narrow permission — `application-documents:review` — gates every
M18 mutation (document review, checklist toggles, internal notes),
following this codebase's own established "one narrow permission per
sensitive new surface" convention (`profile-verification:*`,
`recommendation-readiness:*`, and M17-v3's own `application-documents:read`
are the direct precedents). Granted only to `super_admin`/`admin`/
`counsellor`; **never** `finance`, `analyst`, or `content_editor`.

This is deliberately its own permission rather than reusing the broader
`applications:write` — even though `applications:write` already happens to
be held by exactly the same role set today, the task's own instruction is
explicit: "Do NOT use broad `applications:write` as the only authorization
boundary if a narrower document-review permission is appropriate." A
narrower, clearly-named permission also means a future milestone that widens
`applications:write` to a new role can never accidentally widen document
review access as a side effect.

**The application permission map is UX, never the security boundary** —
exactly the posture this codebase already documents at the top of
`permissions.ts`. The real boundary is the database:

- `staff_review_application_document()` (0020 PART 2) re-derives the
  caller's role/assignment from `auth.uid()` inside its own `UPDATE`'s
  `WHERE` clause — `is_admin_role(['super_admin','admin'])` or
  (`is_admin_role(['counsellor'])` and
  `assigned_counsellor_id = current_counsellor_id()`), reusing the exact
  helper functions and the exact scoping expression 0018's own SELECT policy
  already uses.
- The new `application_checklist_items` and `application_internal_notes`
  tables carry their own RLS policies using the identical role/assignment
  expression.

A counsellor who is not assigned to a given application gets zero rows /
zero effect from every M18 write — not an error, not a partial success —
matching 0018's own anti-enumeration posture exactly.

## 4. Operational checklist

Deliberately a small, fixed, practical checklist — not a generic workflow
engine. Of the eight example items in the task spec, only four are
genuinely staff-toggled manual state, stored in the new
`application_checklist_items` table:

- Application profile reviewed
- Academic eligibility checked
- Course/intake confirmed
- Application details confirmed

The other four are **derived at read time**, never stored, so they can never
drift out of sync with the data they summarize:

- Required documents uploaded — from `getApplicationDocumentCompleteness()`
  (existing M17 pure logic, unchanged)
- Required documents reviewed — from the new
  `getApplicationDocumentReviewCompleteness()`
- Student clarification required — true whenever any current document is
  `needs_correction`
- Ready for submission — mirrors the M18 readiness calculation (§5)

## 5. Readiness — distinct from M16's `ready_to_submit` and M17 completeness

`getApplicationReadiness()` (`src/lib/applications/application-readiness.ts`)
is a **new, purely informational** composition, never a replacement for
M16's `ready_to_submit` stage value and never a mutation of
`applications.stage`. It composes:

1. Stage is in an appropriate pre-submission window (`inquiry`, `preparing`,
   `ready_to_submit`) — an already-submitted or closed application is
   reported as a blocker, never silently "ready".
2. Every required document is uploaded (M17 completeness).
3. Every required document is **accepted**, not merely uploaded (M18
   review) — this is the task's own explicit rule: "do not claim an
   application is ready merely because documents exist."
4. No outstanding correction request on any current document.
5. Every manual checklist item is complete.

The counsellor/admin remains responsible for explicit progression — nothing
in this milestone auto-submits or auto-advances a stage because readiness
became true.

## 6. Next operational action — deterministic, not an LLM

`getNextOperationalAction()`
(`src/lib/applications/next-operational-action.ts`) is a plain, ordered
chain of conditionals over already-computed signals — no model call, no
randomness. Priority order (first match wins): closed application →
documents pending review → a required document missing → an outstanding
correction request → an incomplete checklist item → ready for the
staff-controlled submission step → no immediate action. See
`next-operational-action.test.ts` for one test per branch.

This is deliberately a **separate** module from
`application-lifecycle.ts`'s existing `getApplicationNextAction()`, which
answers the same question for the *student* — the two audiences need
different answers, and merging them would blur that. Neither function calls
the other.

## 7. Internal notes vs. student-facing requests

Two entirely separate mechanisms, never mixed in one field:

- **Internal notes** (`application_internal_notes`, new table): staff-only,
  append-only, timestamped, actor-recorded. Mirrors the existing
  `admin_student_notes` table and `addStudentNote()` pattern
  (`src/lib/supabase/admin/students.ts`) exactly — same shape, same
  `requireAdminPermission` → insert → `recordAuditLog()` flow — reusing
  that established pattern rather than inventing a new one, per the task's
  own instruction to check for existing notes infrastructure first. The
  table itself is new because this is a different entity (an
  application, scoped by assigned counsellor) than a student (scoped by "any
  admin who can see this student"), not a second notes *architecture*.
- **Student-facing correction requests** (`application_documents.
  correction_message`): a short, actionable message ("Upload a clearer
  passport copy.") shown only while the document is `needs_correction`.
  Never internal staff notes, never the reviewer's identity, never a raw
  database status.

## 8. Audit trail

Reuses the existing generic `admin_audit_log` / `recordAuditLog()`
infrastructure (`0004_admin_system.sql` PART 11) for every M18 event —
document review decisions, checklist completions, internal notes added.
One new `AUDIT_ENTITY_TYPES` entry, `"application_document_review"`, was
added for document review decisions specifically (the one M18 action with a
real database-authorized RPC boundary behind it); checklist/notes events
reuse the existing `"application"` entity type. `application_status_history`
(M16) is left completely untouched and is used only for real stage
transitions, as before — it is structurally unsuited to generic M18 events
(`to_status` is `NOT NULL`).

## 9. Concurrency and integrity

- **Two staff reviewing the same document**: the last successful `UPDATE`
  wins; both requests independently satisfy the same `WHERE` clause, and
  Postgres serializes the two writes normally. No lost-update risk beyond
  ordinary row-level concurrency, which this table already had.
- **Student replaces a document while a counsellor's page is open**: the
  replacement's own `UPDATE` (0018 PART 6) flips the old row's `is_current`
  to `false` *before* the new row is inserted. A subsequent review attempt
  against the old (now stale) document id matches zero rows in
  `staff_review_application_document()`'s `WHERE is_current = true` clause
  and returns the same generic "please refresh" error `student_remove_
  application_document()` already uses for the equivalent case — the
  counsellor can never approve/reject a document the student has since
  superseded.
- **Retired/non-current document**: same `is_current = true` clause — a
  retired document can never be reviewed, full stop.
- **Duplicate checklist writes**: a single `upsert` on the
  `(application_id, item_key)` unique constraint, never a separate
  exists-then-insert-or-update round trip.
- **Stale-page stage transitions**: unaffected — M18 never writes
  `applications.stage`, so M16's own optimistic-concurrency guard on stage
  transitions is untouched.

## 10. Error handling

Every new SECURITY DEFINER function raises exactly one generic,
already-safe message per failure class (never a raw Postgres/PostgREST
error) — the same convention 0018/0019 established. The TypeScript
orchestration layer relays that message as-is for the one function that
raises it (`staff_review_application_document`), and falls back to a
short, generic, already-reviewed message (`friendlyAdminError()`, existing
infrastructure) for any raw database failure elsewhere (checklist upsert,
internal note insert) — never a raw constraint name or Postgres internals
reaches a person.

## 11. Testing approach

No live Postgres connection exists in this project's Vitest setup (see the
comment block at the top of `vitest.config.mts`), so — matching the exact
convention `application-documents-migration-security.test.ts` and
`application-workflow-migration-security.test.ts` already established —
RLS/RPC correctness for the new migration is verified against the actual
migration SQL **text** in
`application-processing-workspace-migration-security.test.ts`, not a live
database. Pure logic (readiness, checklist view, next-action, review
completeness) is fully unit-tested as ordinary functions. The TypeScript I/O
wrappers are tested the same way `application-documents.test.ts` already
tests the M17 admin wrapper — every Supabase call mocked, asserting the
correct permission/RPC/table is used and that failures degrade safely.

**Correction (v2)**: an earlier draft of this milestone incorrectly claimed,
in this section, that `src/lib/supabase/admin/application-documents.test.ts`
and `src/lib/supabase/education/application-documents.test.ts` (Milestone
17) existed on disk but were never added to `vitest.config.mts`'s `include`
list, and re-added them under that claim. That claim was wrong — both files
were already correctly wired into `include` (under a "Milestone 17 (v2)"
comment) before this milestone touched anything; the earlier draft's own
investigation had been run against a stale local copy of the config file
that predated that real fix. This milestone leaves that pre-existing block
untouched. What genuinely is new here: this milestone's two
`src/lib/supabase/admin/` I/O test files —
`application-checklist.test.ts` and `application-notes.test.ts` — need (and
received) their own new `include` entries, for the same reason
`refunds.test.ts`/`applications.test.ts`/`application-documents.test.ts`
already have entries (stateful I/O orchestration that can't be exercised as
a pure function). This milestone's other five new test files, all under
`src/lib/applications/`, need no config change at all — they're already
covered by the pre-existing `"src/lib/applications/**/*.test.ts"` glob
(Milestone 16).

## 12. Out of scope (deferred, consistent with the task's own scope list)

No university submission automation, no OCR/AI document analysis, no
generic workflow engine, no second ownership/assignment field, no change to
payments/invoicing/pricing, no change to SEO-owned files.
