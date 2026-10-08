# UX09 — Admin / Counsellor Experience

This pass improves the operational (admin/counsellor) side of Nextwise to
match the polish already delivered to students in UX07-08, without
redesigning any existing backend logic (M16-M19). Every change below is
either a pure re-labeling/re-grouping of already-computed signals, or a
presentational reorganization of an existing page — never a new rules
engine, never a new permission, never a new migration.

## 1. The work-queue abstraction

`src/lib/applications/application-work-queue.ts` is the one new piece of
logic this pass adds, and it is deliberately small: it re-groups
`NextOperationalActionKind` (Milestone 18, extended by Milestone 19's
`add_application_reference` / `await_university_acknowledgement`) into six
`WorkQueueBucket` values a counsellor actually scans a queue by —
`needs_action`, `waiting_on_student`, `ready_for_submission`,
`awaiting_university`, `no_action`, `closed`. The mapping is a
`Record<NextOperationalActionKind, WorkQueueBucket>`, so TypeScript itself
refuses to compile if a future milestone adds a new action kind without
this file being updated to bucket it — the exhaustiveness is structural,
not a convention someone has to remember.

This module never calls `getNextOperationalAction()` itself and never
re-derives any of its logic — it only re-labels output that already exists.
Every surface below imports this SAME module (and the matching
`src/components/admin/applications/work-queue-visuals.tsx` for
tone/icon/color), so "needs attention" cannot drift into meaning something
different on the list page than it means on the dashboard.

## 2. Admin dashboard (`/admin`)

Added one new widget, "Applications needing your attention", placed
directly under the existing summary-card grid (before the lead funnel /
counsellor workload cards) so it is the first thing a counsellor with
document-review access sees below the headline numbers.

It is backed by `getApplicationsNeedingAttention()`
(`src/lib/supabase/admin/dashboard-work-queue.ts`): a BOUNDED scan (default
40 candidates) of the most recently updated, non-terminal-stage
applications, with document and checklist reads batched via two new `.in()`
sibling functions (below) — never one query per application. Results are
filtered to the `needs_action` bucket only and capped at 5. `waiting_on_
student` and `awaiting_university` items are deliberately excluded from
this widget: they are real, but nothing on a dashboard can move them
forward faster than opening the application already would, so surfacing
them here would only compete with the items a counsellor can actually act
on right now.

Gated behind `application-documents:read` — a caller without it
(finance/analyst/content_editor) never sees this section at all, and the
function itself returns `[]` without throwing for such a role (checked
before `requireAdminPermission` is ever called), so the rest of the
dashboard renders normally.

## 3. Batched reads (no N+1)

Two new sibling functions, following this codebase's own established
`.in("id", ids)` batched-read convention (see the name-map builders already
in `src/lib/supabase/admin/applications.ts`):

- `listApplicationDocumentsForAdminBatch()` in
  `src/lib/supabase/admin/application-documents.ts`
- `getApplicationChecklistItemsBatch()` in
  `src/lib/supabase/admin/application-checklist.ts`

Both require the exact same permission as their single-id counterparts
(`application-documents:read` / `application-documents:review`
respectively), both are bounded by the caller (a page of list results, or
the dashboard widget's capped 40-row scan — never an unbounded "every
application" id list), and both are pure read paths: neither adds, removes,
or changes any RLS policy, table, or column.

## 4. Counsellor work queue / applications list (`/admin/applications`)

Added a sticky (desktop; collapses to normal flow below the `sm` breakpoint,
per the task's own instruction) summary bar above the filter form, tallying
the CURRENT page's own applications into work-queue buckets — "3 Needs
action", "1 Waiting on student", etc. — using the same batched reads as the
dashboard widget, scoped to just the current page's ids.

The table's "Decision" column becomes "Next step" for a caller with
`application-documents:read`: a bucket-toned badge showing the actual
`getNextOperationalAction()` label (e.g. "Request missing document:
Academic transcript.") instead of the raw decision status. Rows are sorted
by bucket priority (needs action first, closed last), stable within each
bucket. A caller without that permission sees the original table, unchanged
— the "falls back to the pre-UX09 page" posture used everywhere else in
this admin for a permission-gated addition.

## 5. Application detail workspace (`/admin/applications/[id]`)

Reorganized into the hierarchy the task asks for, without moving any
backend call out of its existing module:

1. **Identity** — header (student name, university), unchanged.
2. **Status / stage / assigned counsellor** — `ApplicationForm` (M16,
   untouched), immediately below.
3. **Next operational action** — moved UP from where it previously sat
   (after the form) to sit between the header and the form, and restyled
   with the shared work-queue badge/icon. Sticky on desktop (`sm:sticky
   sm:top-4`), normal flow on mobile. Still purely informational: this card
   never mutates `stage` and never auto-submits anything.
4. **Readiness checklist** — `AdminApplicationChecklist` (M18), now
   directly after the editable form, renamed "Readiness checklist" to match
   its actual content (a checklist + blocker list — never a percentage, per
   the task's own instruction). Its position changed; its component and
   logic did not.
5. **Student action required** — new, and deliberately the smallest logic
   footprint possible: a direct re-read of the SAME `documents` array
   already fetched for the Documents card below, filtered to
   `needs_correction`, showing each flagged document's exact student-facing
   correction message. No new query. Framed from the student's side of the
   workflow, as a deliberate counterpart to "Next operational action" above
   (framed from staff's side) — the task's own explicit ask ("what requires
   student action" vs "what requires counsellor action"). The student's own
   free-text note (M16) now lives in this same card rather than in a
   separate "Student-visible details" card, since both answer the same
   question: what does the student currently see or need to do.
6. **Document review** — unchanged position and logic; see §6 below for the
   one real UX fix inside it.
7. **Submission preparation** — the M19 `AdminApplicationSubmissionPanel`,
   position unchanged (already sat here in the pre-UX09 page). Not
   duplicated, not re-implemented — this pass only reorganizes everything
   ABOVE it.
8. **Internal notes** — unchanged.
9. **History** — unchanged, still last.

The old "Student-visible details" card's non-note content (submitted /
decision / withdrawn timestamps) was kept, renamed "Lifecycle timestamps",
and left where it was (between Submission preparation and Documents) —
nothing there needed to move, since it isn't part of the requested
identity→history workflow ordering, it's supplementary metadata.

## 6. Document review — the correction-message visibility fix

While reorganizing the Documents card, found and fixed a real, pre-existing
gap rather than just moving code: `AdminDocumentReviewControls` already
stored the two fields the task asks to keep visually distinct — a
STUDENT-FACING `correctionMessage` and a STAFF-ONLY `reviewNote` — but only
ever rendered `reviewNote` outside of the edit form. The actual message a
student was sent had no read-only display anywhere; a staff member had to
click "Request correction" again (which pre-fills the OLD message into an
editable draft field) just to see what was already sent.

Fixed by rendering both, always, with a deliberately different visual
treatment:

- **Sent to student** — accent-colored block with a message-square icon.
- **Internal note — staff only** — neutral block with a lock icon.

Neither field's meaning changed; neither the database column nor the
Server Action touching it changed. This is a presentation-only fix to an
existing data-visibility gap, exactly the kind of change this task asks
for ("the visual distinction... must be very obvious").

## 7. Role-aware UX

No new permission was added. Every new or moved section reuses an existing
`hasPermission(admin?.role, "...")` check already established by M17-M19:
`application-documents:read` gates the work-queue summary/column/dashboard
widget and the "Next step" column; `application-documents:review` gates the
Next-action card, Readiness checklist, and Internal notes;
`application-submissions:read`/`:write` continue to gate the Submission
preparation panel exactly as before. UI hiding is presentation only — the
underlying RLS/RPC checks (unchanged by this pass) remain the actual
authorization boundary.

## 8. Responsive behavior

Both new sticky elements (the applications-list summary bar, the detail
page's next-action card) use `sm:sticky` rather than a bare `sticky`, so at
375px they render in normal document flow — no floating panel competing for
a small screen's vertical space — and become sticky only at `sm` (640px)
and above, covering the 768/1024/1440 breakpoints the task asks to check.
The existing `AdminTable` wrapper's `overflow-x-auto` (pre-existing,
unchanged) continues to contain the wider "Next step" column without
causing page-level horizontal overflow; the new bucket badges themselves
truncate (`max-w-[16rem] truncate`) rather than wrapping a table row taller.

## 9. Security preservation

No migration file was added or edited (`supabase/migrations/` is still
exactly `0001`-`0022`). No RLS policy, RPC, or permission string was added,
removed, or broadened — `git status` for this pass shows zero changes under
`src/lib/admin/permissions.ts`, zero changes under `supabase/`. Every new
read path reuses an existing permission string and an existing table's
existing RLS policy (via `.in()` instead of `.eq()` — same authorization
boundary, just a wider id filter). No internal-only field
(`reviewNote`, staff identity, internal notes) was made reachable from any
student-facing code path — this pass touched zero files under
`src/app/(site)/` or `src/lib/supabase/education/`. The M19 authoritative
submitted-state invariant (`0022`'s trigger, `staff_record_application_
submission()` as the sole path) was not touched at all by this pass.

## What this pass deliberately did not do

- Did not touch `/admin/students`, `/admin/discovery-sessions`,
  `/admin/counsellors`, `/admin/agreements`, `/admin/payments`, or
  `/admin/refunds` — the task's own instruction to prioritize operationally
  important areas rather than redesign every route.
- Did not change `ApplicationForm` itself, or split identity/stage/
  counsellor-assignment into separate cards — that component already
  bundles M16's editable fields correctly, and splitting it apart would be
  a structural redesign the task did not ask for and that risks the
  existing update/validation logic inside it.
- Did not add a second admin-facing readiness percentage, score, or metric
  beyond what `getApplicationReadiness()` already computes.
- Did not add a submission-state batch reader for the dashboard widget —
  the widget's `needs_action` scope never needs per-application submission
  state, so adding one would have been an unused query, not a real gap.
