# NW06.7 — Counsellor/Admin Workspace (minimum)

**Status:** Complete. Scoped deliberately narrow per the brief's own NW07 boundary — see §4.

## 1. What already existed (Milestones 18–19)

`src/app/admin/applications/[id]/page.tsx` was already a mature processing workspace: a sticky "Next operational action" card, a readiness checklist (`AdminApplicationChecklist.tsx`), a "Student action required" panel surfacing `needs_correction` documents, a document review workflow with accept/needs-correction/reject controls, internal (staff-only) notes, and the Milestone 19 submission-recording panel. NW06.1's audit classified this `EXISTING_AND_FUNCTIONAL`, and nothing in this stage rebuilds or replaces any of it.

## 2. What this stage adds

The one genuinely new staff surface the brief's third-party-fee case needs: a **Tasks** card (`AdminApplicationTasks.tsx`), wired into the same page, gated behind the new `application-tasks:read` permission. It lists every task on the application (type, status, due date, student's own note, the staff-only internal note) with the allowed-transition buttons `getAllowedStaffTaskTransitions()` computes, and a "New task" form that reveals the external-payment-specific fields (payee, amount, currency, instructions, reference) only when `taskType === "external_payment"` — with the same "Nextwise does not collect this fee" notice shown to the student, shown here too, so staff creating the task see the same constraint the student will.

Server Actions: `createApplicationTaskAction()`/`updateApplicationTaskStatusAction()` (`src/app/admin/applications/actions.ts`), following the exact `friendlyAdminError()`/`revalidatePath()` wrapping every other action in that file already uses — no new error-handling pattern introduced.

## 3. Reused as-is

`formatMoney()` (`src/lib/admin/money.ts`) for the external-payment amount display — the same currency formatter 31 other files (student- and staff-facing) already import; no second formatter written. The card/badge/button primitives, and the "list + a small mutation form, backed by one Server Action per mutation" shape, are copied from `AdminApplicationChecklist.tsx`/`AdminApplicationNotes.tsx` exactly.

## 4. The NW07 boundary — what this stage deliberately did not build

Per the brief's own instruction to keep this "minimum" and respect a separate NW07 scope, this stage did **not** build: bulk task operations across applications, a counsellor-facing task queue/dashboard analogous to `/studio/abroad/applications` (NW06.2 is student-only), task templates or auto-generated tasks from stage transitions, notification delivery for a new/overdue task (the existing `LoggingNotifier` placeholder — see NW06.1's audit §2.9 — was not extended with a new template), or any reporting/analytics surface over task completion rates. Each of these is a reasonable next step for a future milestone, not something this stage's brief asked for.

## 5. Conclusion

One new card, two new Server Actions, zero rebuilt surface, zero scope bleed into NW07.
