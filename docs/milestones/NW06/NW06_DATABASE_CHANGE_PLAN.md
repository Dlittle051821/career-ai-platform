# NW06 — Database Change Plan

**No migration was applied to any database by this milestone.** This document records what NW06 reused, the one schema change it proposes (unapplied), and why no other schema change was needed.

## 1. Existing tables/functions reused (zero change)

| Table / function | How NW06 used it |
|---|---|
| `applications`, `application_status_history` | Unchanged — read via `get_my_applications()`/`get_my_application_status_history()` (Milestone 16) for the dashboard and the per-application Tasks card's surrounding page |
| `application_documents` | Unchanged — `application_tasks.evidence_document_id` is a nullable FK into it (`on delete set null`); `student_complete_application_task()` re-verifies ownership/currency at write time but performs no insert/update/delete against it |
| `application_submissions`, `application_checklist_items`, `application_internal_notes` | Unchanged — not read or written by anything in NW06 |
| `education_saved_items` | Unchanged — confirmed (NW06.3) structurally independent of `applications`, untouched |
| `get_my_applications()`, `get_my_application_status_history()` (RPCs) | Unchanged — reused as-is by the new dashboard |
| `is_admin_role()`, `current_counsellor_id()` (helper functions) | Unchanged — reused by every new RPC's own authorization check, same pattern as every prior milestone's RPCs |
| `set_updated_at()` (trigger function) | Unchanged — reused for `application_tasks`'s own `updated_at` trigger |

## 2. New schema proposed (NOT applied)

**File:** `supabase/migrations-proposed/NW06_application_tasks.sql`

**What:** one new table, `public.application_tasks`, its RLS policy (staff SELECT only), and four new functions: `staff_create_application_task()`, `staff_update_application_task_status()`, `student_complete_application_task()`, `get_my_application_tasks()`, `get_my_open_application_tasks()`.

**Why:** closes the one real gap NW06.1's audit found — no persisted, structured "action item" concept existed anywhere in this product, and the brief's external-fee case needed a safe home that could never be mistaken for Nextwise collecting payment. See `NW06_06_STUDENT_ACTION_REQUIRED.md` for the full writeup.

**Ownership model:** every RPC derives identity exclusively from `auth.uid()`; a student's own row access is scoped through `applications.student_user_id`, a staff member's through `is_admin_role()`/`current_counsellor_id()` — exactly the same two-sided ownership model `application_documents`/`application_submissions` already use.

**RLS rationale:** one SELECT-only policy for staff (super_admin/admin/assigned counsellor), and deliberately no student policy and no staff write policy at all — every mutation is RPC-only, matching this table's state-machine complexity to the same pattern `application_documents`/`application_submissions` already use rather than `application_checklist_items`'s simpler plain-RLS-toggle pattern. See `NW06_06...md` §3 for why.

**Rollback:**
```sql
drop function if exists public.get_my_open_application_tasks();
drop function if exists public.get_my_application_tasks(uuid);
drop function if exists public.student_complete_application_task(uuid, text, uuid);
drop function if exists public.staff_update_application_task_status(uuid, text, text);
drop function if exists public.staff_create_application_task(uuid, text, text, text, date, text, bigint, text, text, text, text);
drop table if exists public.application_tasks;
```
Safe at any time — nothing else in this codebase writes to or depends on `application_tasks` existing; every calling function (`src/lib/supabase/education/application-tasks.ts`/`src/lib/supabase/admin/application-tasks.ts`) fails closed (empty list / a caught, user-safe error) if the table or any RPC does not exist, the same tolerance `student-profile-actions.ts` already has for NW05's own proposed RPC.

**Verification queries:** included in the migration file's own header comment conventions throughout (every RPC's own `comment on function` documents its exact guarantee); the full static-source-text verification is the regression suite in `application-tasks-migration-security.test.ts` (45 tests).

**Deployment prerequisites:** none beyond ordinary founder/admin review and a normal `supabase/migrations/` promotion (copy the file, assign the next sequential number — `0023`, since `0022` is the last applied migration this session found — and apply via the standard process). No data backfill, no downtime, no coordinated deploy with application code required — every calling function already ships in a state that works correctly whether or not this migration has been applied.

## 3. Why no other migration was needed

- **NW06.2 (Application Dashboard):** every data point is a read of an existing table/function, or of the one new table above.
- **NW06.3 (Shortlist to Application):** no code change at all.
- **NW06.4 (Application Workflow):** no code change at all — the state machine was already complete.
- **NW06.5 (Secure Document Centre):** no code change beyond the one nullable FK column already counted in §2 above.
- **NW06.7 (Counsellor/Admin Workspace):** UI and Server Actions only, backed entirely by the RPCs in §2.

## 4. Explicitly NOT done

- No migration was applied to `supabase/migrations/`.
- No database reset, backfill, or seed command was run.
- No production role or policy was altered.
- No paid checkout flow was enabled or altered — this migration contains no reference to `payments`, `invoices`, `pricing_purchases`, or Razorpay anywhere.
