# NW06.6 — Student Action Required Tasks

**Status:** Complete.

## 1. Why this exists

NW06.1's audit (§2.6/§2.7) found Milestones 16–19 had built everything else the brief describes — lifecycle, documents, submission tracking, a counsellor workspace — but no persisted, structured "here is a concrete thing you need to do, with a due date and a verified-completion lifecycle" concept, and no safe way to surface the brief's third case (an external university/visa/government fee) without it looking like Nextwise collects money on a third party's behalf. This stage adds exactly that, as **one new table** with a fixed task-type vocabulary.

## 2. The hard constraint, restated

**Nextwise does not collect university application, tuition, visa, or government fees — and `application_tasks` gives it no way to.** There is no payment-method field, no bank/UPI/card field, no Razorpay reference, and no column that could hold a Nextwise-owned payment destination anywhere on this table. The five `external_payment_*` columns are exclusively staff-entered, informational text/numbers describing a charge the student pays **directly** to the third party; the table only records the student's own self-report (`student_completed_at`/`student_note`) and an independent staff verification (`verified_at`/`verified_by`) — never a transaction. This is stated in the migration's own PART 2 comment, enforced by a schema-level CHECK constraint (`application_tasks_payment_fields_scoped_check`) that nulls every payment column for any non-`external_payment` task, and verified by the static regression suite below.

## 3. Schema (proposed, unapplied)

`supabase/migrations-proposed/NW06_application_tasks.sql` — one table (`application_tasks`), one RLS policy (staff SELECT only — zero student policy, zero staff INSERT/UPDATE/DELETE policy), and four `SECURITY DEFINER` RPCs:

- `staff_create_application_task()` — the only way a task is created (super_admin/admin/assigned counsellor only).
- `staff_update_application_task_status()` — the only way staff change a task's status; lock-then-validate-then-conditional-update (same shape as `staff_record_application_submission()`), a fixed transition table (`open ⇄ in_progress`, both → `cancelled`; `student_completed` → `verified_complete`/`open`/`in_progress`/`cancelled`; `verified_complete`/`cancelled` both terminal), one anti-enumeration error for every failure reason.
- `student_complete_application_task()` — the only way a student marks their own task done (including an external-payment self-report); never touches `verified_at`/`verified_by`/`staff_note`.
- `get_my_application_tasks()` / `get_my_open_application_tasks()` — the student's own per-application and cross-application reads; both `RETURNS TABLE` shapes structurally exclude every staff-only column.

Why RPC-only, not plain RLS: this codebase has two precedents for a staff-writable sub-resource — the lighter one (`application_checklist_items`, plain RLS + `WITH CHECK`) for a trivial boolean toggle, and the heavier one (`application_documents`/`application_submissions`, RPC-only) for a genuine state machine. `application_tasks` is the latter, so it follows the latter.

## 4. Application code

- `src/lib/applications/application-tasks.ts` — pure taxonomy/classification (type guards, labels, the UI-mirror transition table, `isApplicationTaskActionableByStudent()`, `isApplicationTaskOverdue()`, `summarizeApplicationTasks()`). Unit-tested in `application-tasks.test.ts` (17 tests).
- `src/lib/supabase/education/application-tasks.ts` / `src/lib/supabase/admin/application-tasks.ts` — student-facing and staff-facing I/O, RPC-only, matching `application-documents.ts`'s own conventions (fail-closed `[]` on any error for reads; `AdminValidationError`/`friendlyAdminError` wrapping for writes; `recordAuditLog()` on every staff mutation).
- `src/components/applications/ApplicationTasks.tsx` — the student's "Action required" card on `/applications/[id]`, wired in this stage. Renders an explicit, hard-to-miss disclosure on every `external_payment` task: *"Nextwise does not collect this fee... Marking this done only tells Nextwise you believe you've paid — staff will verify it separately."*
- `src/components/admin/applications/AdminApplicationTasks.tsx` — the staff "Tasks" card on `/admin/applications/[id]` (NW06.7's own deliverable; documented together here since they share one migration and one component pair), wired in this stage behind the new `application-tasks:read`/`write` permission pair.
- `src/lib/admin/permissions.ts` — the new pair, granted to `admin`/`counsellor`, deliberately withheld from `finance`/`content_editor`/`analyst`.

## 5. Security regression suite

`src/lib/applications/application-tasks-migration-security.test.ts` (45 tests) — a static-source-text audit of the proposed migration, covering: the external-payment safety invariant (no payment-method/bank/card/Razorpay column, the schema-level scoping CHECK), zero student/staff write RLS policy, the lock-then-validate ordering and fixed transition table in `staff_update_application_task_status()`, the ownership-scoped lock and evidence-document cross-application guard in `student_complete_application_task()`, the student-safe `RETURNS TABLE` shapes, and the "every grant has a matching anon revoke" convention (the 0019 lesson).

## 6. What this stage did not do

- No payment, checkout, or Razorpay code touched.
- No change to `applications.stage` — confirmed by direct reading of every new RPC (see `NW06_04_APPLICATION_WORKFLOW.md` §3).
- No migration applied to `supabase/migrations/` — the file lives in `supabase/migrations-proposed/` and requires a founder/admin's explicit review and promotion (see `NW06_DATABASE_CHANGE_PLAN.md`).
