# NW06 — Security Threat Model

**Scope:** the one new schema object this milestone proposes (`application_tasks` and its four RPCs, `supabase/migrations-proposed/NW06_application_tasks.sql`) and the application code built on top of it (NW06.2/.6/.7). Everything NW06.1's audit classified `EXISTING_AND_FUNCTIONAL` (lifecycle, documents, submissions, the admin workspace) is out of scope here — it has its own prior-milestone threat coverage (migration-security test suites referenced in `NW06_04_APPLICATION_WORKFLOW.md`/`NW06_05_SECURE_DOCUMENT_CENTRE.md`) and NW06 changes none of it.

## 1. Methodology

A lightweight STRIDE pass over the new table/RPCs, plus one Nextwise-specific business-risk category (§7) the brief treats as a hard constraint rather than an ordinary security property. Every mitigation cited below is backed by a specific static regression test in `application-tasks-migration-security.test.ts` (45 tests) — this is a source-text audit, not a live-database penetration test (this environment's Supabase project is a placeholder; see `NW06_08_QA_REPORT.md` §3 for the same disclosed limitation every prior milestone has carried).

## 2. Spoofing / identity

**Threat:** a caller claims to be staff, or claims to be a different student, to read or write a task that isn't theirs.
**Mitigation:** every RPC derives identity exclusively from `auth.uid()` — never a parameter. `staff_create_application_task()`/`staff_update_application_task_status()` re-check the caller's admin role (`is_admin_role()`) and, for a counsellor, that the application's own `assigned_counsellor_id` matches `current_counsellor_id()` — both re-evaluated against a freshly locked row, never a value read earlier in the same request. `student_complete_application_task()`'s own lock query is itself scoped to `a.student_user_id = auth.uid()` — ownership is not a separate check, it is the lock's own WHERE clause.
**Residual risk:** none identified beyond the pre-existing trust placed in Supabase's own JWT verification, which this migration does not touch.

## 3. Tampering

**Threat:** a caller supplies a privileged field (status, `verified_at`, `verified_by`, `cancelled_at`, `cancelled_by`, `created_by`) directly.
**Mitigation:** none of these columns has a corresponding RPC parameter on any function in this migration — `staff_create_application_task()`'s own parameter list has no `p_status`/`p_created_by`; `student_complete_application_task()` has no `p_verified_at`/`p_staff_note`. Every one of these columns is set server-side, inside a `CASE` expression keyed off `now()`/`auth.uid()`/the validated target status, never from client input.
**Threat:** a caller attaches someone else's document, or a retired version of their own, as task evidence.
**Mitigation:** `student_complete_application_task()`'s evidence check requires `d.application_id = v_app_id and d.is_current = true` — same application, current version only, re-verified at write time regardless of what the client claims.

## 4. Repudiation

**Threat:** a staff action (creating a task, verifying one, cancelling one) can't later be attributed to who did it.
**Mitigation:** `created_by`/`verified_by`/`cancelled_by` are all `auth.uid()`-derived and immutable once set (no RPC can null them back out); every staff mutation additionally calls `recordAuditLog()` (`src/lib/supabase/admin/application-tasks.ts`) into this codebase's pre-existing admin audit log, the same convention every other staff-mutating module uses.

## 5. Information disclosure

**Threat:** a student reads another student's task, or reads staff-internal fields (`staff_note`) on their own task.
**Mitigation:** the table has exactly one RLS policy, staff-SELECT-only with no student branch at all — a student has zero direct table access, structurally. `get_my_application_tasks()`/`get_my_open_application_tasks()` are the entire student read boundary, and both `RETURNS TABLE` shapes structurally exclude `staff_note`/`created_by`/`verified_by`/`cancelled_at`/`cancelled_by` — not merely omitted from a `SELECT` list, absent from the function's own return type, so no caller-controlled query shape could add them back.
**Threat:** a finance/content_editor/analyst admin role reads task detail they shouldn't.
**Mitigation:** the new `application-tasks:read`/`write` permission pair is granted only to `admin`/`counsellor` in `src/lib/admin/permissions.ts` — `finance`/`content_editor`/`analyst` get neither, and the admin page's own Tasks card is omitted entirely (never rendered with empty data) when the permission check fails.

## 6. Denial of service

**Threat:** an unbounded task list, or an unbounded evidence/description field, degrades the page or the database.
**Mitigation:** every text field has an explicit length CHECK constraint (title ≤200, description ≤2000, student/staff notes ≤1000/2000, payment fields ≤200/2000); indexes exist on `application_id`/`status`/`due_date` for the query patterns this milestone's own reads use. No unbounded recursive or fan-out query was introduced — `get_my_open_application_tasks()` is a single join, not a loop.

## 7. Nextwise-specific business risk: looking like a payment collector

**Threat:** the `external_payment` task type, or its UI, is read by a student (or a regulator) as Nextwise collecting a university/visa/government fee on its own behalf.
**Mitigation (schema level):** no payment-method, bank/UPI/card, or Razorpay-reference column exists anywhere on `application_tasks` — verified by a direct regex-negative assertion in the migration-security suite (`not.toMatch(/payment_method/i)` etc.), not merely by convention. The five `external_payment_*` columns are schema-CHECK-scoped to only ever be non-null for that one task type.
**Mitigation (application level):** `ApplicationTasks.tsx` (student) and `AdminApplicationTasks.tsx` (staff) both render an explicit, non-dismissable disclosure sentence on every `external_payment` task — never styled or worded as a payment form, never showing a "Pay now" button, only "I've paid this directly" (a self-report) and a staff-only "Verify complete" (an acknowledgement of the self-report, not a transaction confirmation).
**Residual risk:** none identified within this milestone's own scope. This mitigation does not extend to any future milestone that might add a real payment-processing feature elsewhere in the product — that would need its own, separate threat review.

## 8. Elevation of privilege

**Threat:** a student-callable function is used to reach a staff-only effect (e.g. calling `student_complete_application_task()` to set `verified_complete`).
**Mitigation:** `student_complete_application_task()`'s own UPDATE statement has no `verified_at`/`verified_by`/`status = 'verified_complete'` assignment anywhere in its body — not merely unreachable via its parameters, structurally absent from the statement. Verified directly in the migration-security suite's "never touches verified_at/verified_by/staff_note" test.

## 9. Conclusion

No P0/P1 finding. Every mitigation above is backed by a passing, specific regression test, not asserted from design intent alone.
