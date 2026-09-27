# NextWise Apply Experience (UX08)

Like UX07, this is a UX/product-experience pass over the existing
Milestone 16 (application lifecycle) / 17 (documents) / 18 (counsellor
processing) surface, not a new backend milestone. Milestone 19 does not
exist in the real repository at the baseline commit this pass was built
against (confirmed: no `application_submissions` table, no
`staff_record_application_submission()` RPC, no migration numbered above
`0020`) — per the task's own instruction, nothing M19-shaped was invented
to fill that gap. Where M19 will eventually slot in is called out
explicitly below (§9) instead.

## What this pass found before changing anything

`/applications` and `/applications/[id]` were, like the university/course
pages, considerably more mature than a first read of the task spec would
suggest was needed. The application list is already grouped into four
honest buckets (Active / Submitted / Decision / Closed — never a vanity
metric, each count is a real `.length`). The detail page already has a
discrete, never-fabricated five-stage progress timeline
(`getApplicationProgressStages()`), a document checklist with real
accepted/needs-correction states and student-facing correction messages,
and — already, unprompted by this pass — the exact trust-setting sentence
the spec asks for: *"NextWise tracks your application journey here —
marking a step complete does not itself submit anything to the university
unless stated otherwise."* `getMyApplicationById()`/`MyApplicationSummary`
already **structurally exclude** `internal_notes` and
`assigned_counsellor_id` from the student-facing query — not merely omit
them in the UI, but never select them from the database in the first
place.

## 1. Application-list hierarchy (unchanged — already correct)

University, course, stage badge, real deadline, and a plain-language next
step are already the first things each `ApplicationCard` shows; the bucket
grouping (`/applications`) already answers "how many, and what needs
attention" before a student opens any individual application. No internal
database stage name, internal ID, or counsellor-only metadata is exposed
anywhere on this surface. This pass left the hierarchy itself alone.

## 2. Application-detail hierarchy (unchanged — already correct)

The existing order — header/status → progress → details (intake,
deadline, dates) → documents → student note → history, with a persistent
"Next step" sidebar card — already matches the spec's recommended shape.
This pass did not reorder it.

## 3. Progress model (unchanged — already honest)

`getApplicationProgressStages()` maps every real `ApplicationStage` onto
exactly five fixed, honestly-labeled milestones (Started / Preparing /
Submitted / Under review / Decision) and a withdrawn application is
rendered as a dedicated non-progress state rather than forced onto the
forward-moving bar. No percentage, no fabricated interim step. Unchanged.

## 4. Student-facing status language (unchanged — already correct)

`APPLICATION_STAGE_LABELS` already reads in plain English (`ready_to_submit`
→ "Ready to submit", `under_review` → "Under review", etc.) — no
database-value leakage anywhere on the student-facing pages. Unchanged.

## 5. Next-action logic (unchanged — already the single deterministic source)

`getApplicationNextAction()` (`src/lib/applications/application-lifecycle.ts`)
is already the one place a student-facing "what happens next" sentence is
computed, and it is already honest about the difference between an action
the student can take right now vs. a purely informational wait state. This
pass did not add a second, competing next-action helper — it only extended
the *document* summary line surfaced alongside it (§6).

## 6. Document UX — the one concrete logic gap found

`getApplicationDocumentReviewCompleteness()` already existed
(`src/lib/applications/application-documents.ts`) and already computed
`requiredAccepted`/`isRequiredReviewComplete`/`hasOutstandingCorrection` —
but it had **zero call sites in any UI** and, notably, **zero test
coverage**, despite the review/upload distinction being exactly the kind
of "meaningful logic" the task asks to test. `ApplicationDocuments.tsx`'s
own summary line only ever reported upload completeness ("4 of 5 required
documents uploaded"), never review status — so a student with all
documents uploaded but three still `pending_review` and one
`needs_correction` saw no different message than someone whose documents
were all accepted.

This pass:
- Added two small, purely additive fields to the existing (already
  correctly-scoped) `ApplicationDocumentReviewCompleteness` type —
  `acceptedCount` and `needsCorrectionCount` — counting *all* current
  documents (not just the required-type subset `requiredAccepted` already
  covered), so the summary line can report the same plain counts a
  counsellor already sees on the M18 processing workspace.
- Wired `getApplicationDocumentReviewCompleteness()` into
  `ApplicationDocuments.tsx`'s summary, which now reads, e.g., "4 of 5
  required documents uploaded" on one line and "3 reviewed and accepted ·
  1 needs correction" on the next — matching the spec's own example format
  ("4 of 5 required documents uploaded / 3 reviewed / 1 correction
  needed") without collapsing upload and review into one misleading
  number.
- Added the test coverage this function should have had from the start
  (`application-documents.test.ts`), including a case that explicitly
  proves `acceptedCount` counts a non-required accepted document while
  `requiredAccepted` correctly does not.

Internal review notes and reviewer identity were already never rendered to
the student (`ApplicationDocuments.tsx` only ever reads
`currentDocument.correctionMessage`, the student-safe field) — unchanged,
and re-verified during this pass.

## 7. Correction-required UX (unchanged — already calm)

A `needs_correction` document already renders a `warning`-tone badge (not
`error`/red) plus the student-facing correction message in a
`bg-warning-light` box — already the "calm warning styling, not
overused red" the spec asks for. Unchanged.

## 8. Counsellor context — deliberately NOT added

The spec's own instruction is conditional: *"If the student has an
assigned counsellor and the product currently allows showing it: surface
this calmly."* It currently does not. `getMyApplicationById()` and
`MyApplicationSummary` structurally exclude `assigned_counsellor_id` — this
is an existing, deliberate Milestone 16 privacy boundary (the student-facing
query never selects the column at all, not merely "the UI doesn't render
a field it has"). Adding counsellor-identity display would mean either
weakening that boundary (out of scope — "DO NOT CHANGE BACKEND SECURITY")
or building a second, parallel "is a counsellor assigned" boolean-only
lookup whose only purpose would be this one UI line — a narrow enough
justification that it was judged not worth a new query path for a feature
the spec itself gates on the product "currently allowing" it. Deferred; see
below.

## 9. Submission expectation-setting / M19 compatibility

M19 does not exist in this repository (confirmed above). Nothing M19-shaped
— no "Mark submitted" button, no submission reference field, no "University
portal" link, no submission history — was added, per the spec's explicit
instruction. What already exists and is real:

- The M16 `ready_to_submit → submitted` self-service transition (`submit`
  action) is already exposed on the "Next step" card via
  `ApplicationActions`, and `getApplicationNextAction("ready_to_submit")`
  already returns the honest "Mark as submitted once you've applied" copy
  — a real state, a real action, not a placeholder.
- The trust-setting sentence already on that same card (quoted above)
  already draws the exact line the spec asks for between "Nextwise tracks
  this" and "the university has been notified" — this pass re-verified it
  reads correctly and left it untouched rather than duplicating it.

**Where a future M19 will slot in:** the "Next step" card
(`src/app/(site)/applications/[id]/page.tsx`, the sidebar `Card` currently
rendering `next.label` + `ApplicationActions`) is the natural, already-
identified location for a future staff-recorded-submission summary or a
"submission prepared, awaiting your counsellor" state once that milestone
is real — no placeholder box was added there now, because an empty
placeholder implying a feature that doesn't exist yet would itself be a
form of the fabrication the spec explicitly warns against. This is a
documented seam, not a code change.

## 10. Parent-friendly clarity (unchanged — already reads plainly)

Reviewed every student-facing label touched by this pass
(`APPLICATION_STAGE_LABELS`, the new document-review summary line, the new
empty-state copy) for admissions jargon or unexplained acronyms — none
found. "IELTS/TOEFL/PTE" etc. only appear on the course-detail entry-
requirements section (unchanged by this pass), where they are the actual
named tests, not a NextWise-internal abbreviation.

## 11. Mobile behavior

Reviewed via Tailwind responsive classes (see the parallel note in
`docs/ux07-university-discovery.md` §11 on why code review was used
instead of a live-rendered screenshot pass for this environment):
- `ApplicationCard` already truncates its title and stacks
  vertically below `sm`; status badge and deadline/next-step `dl` already
  wrap via `flex-wrap`/`grid-cols-2`.
- `ApplicationTimeline` is already vertical-only at every breakpoint (its
  own docblock notes this was deliberate — "a horizontal timeline is the
  thing most prone to overflow at 375px").
- New `loading.tsx` skeletons for `/applications` and `/applications/[id]`
  (§12) use the same card/grid shapes as the real content, so the loading
  state's layout matches the loaded state's at every breakpoint.

## 12. Loading/error states, and the empty-applications CTA (new)

- Added `loading.tsx`/`error.tsx` for `/applications` and
  `/applications/[id]`, mirroring `/pricing`'s existing convention exactly
  (see `docs/ux07-university-discovery.md` §12 for the shared pattern).
- The empty-applications state (no applications started yet) previously
  had one CTA and slightly clinical copy. It now explicitly distinguishes
  "starting an application in NextWise" from "submitting to a university"
  in its own description line, and offers one primary CTA (Explore
  courses) plus two secondary/tertiary ones (Explore universities, Book a
  discovery session) — the spec's own "1 primary, 1-2 secondary" action-
  hierarchy rule, applied to the one place on this surface that previously
  only had a single action.

## Deferred (explicitly out of scope for this pass)

- **Counsellor identity/context display.** Gated on a product decision
  this pass doesn't have the authority to make (relaxing what the
  student-facing query selects) — see §8.
- **Any M19-shaped submission UI.** Does not exist in the real repo; not
  invented. See §9.
- **A resubmission/"corrected resubmission" workflow.** No such M16 stage
  transition exists (`submitted` has no edge back to `ready_to_submit`);
  out of scope for a UX-only pass in any case.
