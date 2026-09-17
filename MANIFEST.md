# MANIFEST — Milestone 16: Student Application Workflow (v3 — final student database-boundary hardening)

Every file created or modified for Milestone 16 and both of its security patches (v2 "post-review security
patch", v3 "final student database-boundary hardening"), organized by category. Paths are repo-relative.
See `M16_COMPLETION_REPORT.md` for the full audit/design writeup and each patch's own reasoning,
`M16_INSTALL_INSTRUCTIONS.md` for install steps, and `docs/applications-guide.md` for the complete
domain/security/UX writeup.

This manifest describes Milestone 16 (original delivery + v2 + v3) as a single unit. It supersedes the
previous "UX03-04 File Manifest" that lived at this path — see `git log -- MANIFEST.md` for that history.
(Milestone 16's original delivery never updated this file in the repository tree — only its own ZIP's copy
— so v2 was the first time this path reflected Milestone 16 at all; v3 continues describing everything as
one unit, since a patch to an unapplied migration is best understood that way.)

## Baseline

- Repository: `Dlittle051821/career-ai-platform`, branch `release/m10`
- Exact baseline commit: `c4bf5a605aaa54c68d1fa4f27e18a6a845fc9f59` ("Fix Razorpay receipt length for checkout")
- This v3 patch is applied on top of the already-committed Milestone 16 original delivery (`17e94de`), UX03-04
  navigation (`7c2f8a4`), and the v2 post-review security patch (`bb461fe`) commits on this same branch — see
  `git log --oneline -5`.

## AUDIT FINDINGS (original delivery)

**Existing infrastructure found and reused (not duplicated):**

- `public.applications` and `public.application_status_history` already existed (Milestone 7, `0004_admin_system.sql`), with a 10-value `stage` CHECK constraint, `application_status_history` audit trail, and `is_admin_role()`/`current_counsellor_id()` RLS helpers.
- Student read/insert access to `applications` already existed (Milestone 9), via `startApplicationFromCourse()`/`listMyApplications()` in `src/lib/supabase/education/applications.ts`.
- A mature admin CRUD surface already existed: `/admin/applications`, `/admin/applications/[id]`.
- `course_intakes` (Milestone 9) already had real deadline fields — no invention needed.
- `APPLICATION_STAGE_TRANSITIONS` (`src/lib/admin/status.ts`) already modeled the admin-facing lifecycle graph and needed only one new edge.
- `applications:read`/`applications:write` permissions already existed and were reused unchanged.

**Genuine gaps found and closed by the original delivery:** no `ready_to_submit` stage; no student-mutable columns; no student self-service write path; `application_status_history`'s RLS checked only "does the application exist", never ownership; no duplicate-active-application protection at the database level; the admin `updateApplication()` path had a stale-write race; no real per-application deadline resolution.

**Further gaps found by the v2 post-review (see `M16_COMPLETION_REPORT.md`'s "Post-review security
patch" section for full reasoning on each):**

1. The IDOR-gap fix above still let a student directly INSERT a history row for their own application —
   bypassing `student_advance_application()` entirely.
2. The same fix still let a student directly SELECT the internal `note`/`changed_by` columns off their own
   application's history rows — RLS restricts rows, not columns.
3. `startApplicationFromCourse()`'s pre-check ignored application stage, so a rejected/withdrawn
   application blocked a legitimate reapplication forever.
4. `validate_application_course_intake()`'s guard skipped validation entirely whenever `course_id` was
   null, even with a non-null `course_intake_id`.
5. `student_advance_application()`'s final `UPDATE` relied solely on a preceding `SELECT ... FOR UPDATE`
   for its ownership/stage scoping, rather than re-asserting it in the `UPDATE`'s own `WHERE` clause.

**Further gaps found by the v3 review (see `M16_COMPLETION_REPORT.md`'s "v3 patch" section for full
reasoning on each) — this time on `applications` itself, not `application_status_history`:**

1. `student_advance_application()`/`student_update_application_note()` both `returned public.applications`
   — the full row, including `internal_notes`/`assigned_counsellor_id`/`last_contact_date` — even though
   neither TypeScript caller consumed the result.
2. An ordinary student still had direct SELECT access to `applications` via the Milestone 9 RLS policy —
   RLS restricts rows, not columns, so a student's own session could request staff-only columns directly.
3. An ordinary student still had direct INSERT access to `applications` via the Milestone 9 RLS policy,
   whose `WITH CHECK` placed no restriction on any column besides `student_user_id`.
4. Application creation (`startApplicationFromCourse()`) was not database-authoritative — a direct INSERT
   guarded only by row ownership, with the TypeScript layer as the only thing stopping a caller-chosen
   `stage`/`internal_notes`/`assigned_counsellor_id`.
5. Course/university pairing was never verified server-side — a manipulated caller could pair a real course
   with the wrong real university, and the pre-existing admin create/update path had no equivalent
   protection either.

## NEW FILES (original delivery + v2; none new in v3 — see MODIFIED FILES below for v3's own delta)

| Path | Purpose |
| --- | --- |
| `supabase/migrations/0017_student_application_workflow.sql` | The only new migration (patched in place by v2 and again by v3 — see below; no `0018` was ever created). |
| `src/lib/applications/application-lifecycle.ts` | Pure, framework-free business logic: student action vocabulary, next-action helper, 5-stage progress model, dashboard bucket grouping, deadline resolution. |
| `src/lib/applications/application-lifecycle.test.ts` | Unit tests for the above. |
| `src/lib/applications/application-workflow-migration-security.test.ts` | Static SQL-text assertions against the migration — **96 tests** (34 original + 17 v2 + 45 v3). |
| `src/lib/supabase/admin/applications.test.ts` | Orchestration tests for the admin update path. |
| `src/lib/supabase/education/applications.test.ts` | Orchestration tests for the student-facing ownership boundary and RPC-delegating mutation functions — **31 tests** (16 original + 7 v2 + 8 v3). |
| `src/components/applications/*.tsx` | `ApplicationStatusBadge`, `ApplicationCard`, `ApplicationTimeline`, `ApplicationActions`, `ApplicationNoteEditor`. |
| `src/app/(site)/applications/[id]/page.tsx`, `src/app/(site)/applications/actions.ts` | The new student application detail page and its Server Actions. |
| `docs/applications-guide.md` | Full domain/security/UX/limitations writeup, extended by v2's and now v3's own subsections. |
| `M16_COMPLETION_REPORT.md`, `M16_INSTALL_INSTRUCTIONS.md`, `MANIFEST.md` (this file) | Added to the repository tree for the first time by v2 — the original delivery shipped these only inside its own ZIP. |

## MODIFIED FILES — v3 patch (this update, on top of the original delivery + v2)

| Path | Exact changes |
| --- | --- |
| `supabase/migrations/0017_student_application_workflow.sql` | PART 3.1/3.2: `student_advance_application()`/`student_update_application_note()` narrowed from `returns public.applications` to a `RETURNS TABLE` of 5/3 columns respectively. New PART 7: drops the two Milestone-9 student policies on `applications` (no recreate). New PART 8: `get_my_applications()`/`get_my_application(uuid)`. New PART 9: `student_start_application(uuid, uuid)`. New PART 10: `validate_application_course_university()` and its trigger. |
| `src/lib/supabase/education/applications.ts` | `startApplicationFromCourse()` rewritten to call `student_start_application()` via `.rpc(...)` (with a `get_my_applications()` pre-check retained only for analytics accuracy), replacing its direct `.insert()`. `listMyApplications()`/`getMyApplicationById()` rewritten to call `get_my_applications()`/`get_my_application()` via `.rpc(...)`, replacing their direct `.from("applications").select(...)`. `MY_APPLICATION_COLUMNS` constant removed (no longer needed — the RPCs' own return shape is now the authoritative column list). |
| `src/types/database.ts` | `student_advance_application`/`student_update_application_note`'s `Returns` narrowed to match the new `RETURNS TABLE` shapes. New `Functions` entries: `get_my_applications`, `get_my_application`, `student_start_application`. |
| `src/lib/applications/application-workflow-migration-security.test.ts` | +45 tests covering all five v3 fixes; one pre-existing test ("only 'rejected' and 'withdrawn' are excluded...") re-scoped to PART 5 specifically since v3 legitimately adds two more occurrences of that phrase inside `student_start_application()`. |
| `src/lib/supabase/education/applications.test.ts` | `getMyApplicationById`/`listMyApplications`'s describe blocks rewritten around `fake.rpc` instead of `fake._tables.applications` (ownership now enforced inside the RPC, observed as "zero rows returned"), plus a new structural-exclusion regression test. `startApplicationFromCourse`'s entire describe block rewritten around `student_start_application()`/`get_my_applications()` RPC mocking via a new `mockRpc()` test helper; a `fullRow()` helper added for building RPC row fixtures. |
| `docs/applications-guide.md` | New "v3 patch — final student database-boundary hardening" subsection under §4; §5, §7, and §11 updated to describe the now-complete database-authoritative boundary on `applications` itself (not just `application_status_history`). |
| `M16_COMPLETION_REPORT.md` | New "v3 patch" section, §4/§6/§7/§11/§12 updated, §17 test counts updated, new §20 acceptance checklist, new v3-specific Manual QA + SQL verification steps. |
| `M16_INSTALL_INSTRUCTIONS.md` | Rewritten for the v3 delta-package format (see below). |
| `MANIFEST.md` (this file) | Rewritten to describe v3 as the current state. |

## DATABASE

- **Migration**: `0017_student_application_workflow.sql` — patched in place again by this v3 update. Still
  no `0018` (migration `0017` had still not yet been applied to any database at the time of this patch).
- **No table, column, or index shape changed** by v3. The two partial unique duplicate-protection indexes
  are byte-for-byte unchanged from v1/v2.
- **RLS**: the two Milestone 9 student policies on `applications` ("Students can read their own
  applications", "Students can start their own application from a course") are dropped with no
  replacement. The three original admin/counsellor policies on `applications` (Milestone 7) are completely
  unaffected. `application_status_history`'s policies (narrowed by v2) are unchanged by v3.
- **New functions**: `get_my_applications()`, `get_my_application(uuid)`, `student_start_application(uuid,
  uuid)`, `validate_application_course_university()` (trigger function) — all `SECURITY DEFINER`, `set
  search_path = public`; the three RPCs are additionally `revoke all from public; grant execute to
  authenticated`.
- **Narrowed return shapes**: `student_advance_application(uuid, text)` and
  `student_update_application_note(uuid, text)` — both `RETURNS TABLE` now, no longer `returns
  public.applications`.
- **New trigger**: `validate_applications_course_university` — `before insert or update of course_id,
  university_id on public.applications`, shared by the student RPC and the admin create/update path.
- **Confirmed**: no migration 0001–0016 touched; no file under `src/lib/payments/`, `src/app/(site)/payments/`, `src/app/admin/invoices/`, `src/app/admin/refunds/`, or any Razorpay/pricing/billing/tax path was read or modified by this patch.

## TEST RESULTS

- **`npx tsc --noEmit`**: clean, 0 errors.
- **`npm run lint`**: clean, 0 errors/warnings.
- **`npm test` (`vitest run`)**: **1165 / 1165 passing**, 66 test files, 0 failures. Baseline before this v3
  patch: 1112/1112 (v2's own baseline: 1088/1088). This v3 patch adds **53 new tests** across the same 2
  existing files v2 already touched, 0 removed:
  - `src/lib/applications/application-workflow-migration-security.test.ts`: 96/96 (34 + 17 v2 + 45 v3 new)
  - `src/lib/supabase/education/applications.test.ts`: 31/31 (16 + 7 v2 + 8 v3 new)
  - Every other pre-existing suite (application lifecycle, admin applications, status transitions, M10–M13, UX03-04 navigation) still passes unchanged.
- **`npm run build`**: succeeds — production build compiles, typechecks, and generates the same 77 routes as before this patch.

## PAYMENT ISOLATION

**Confirmed** (this v3 patch, same as v1/v2): no file under `src/lib/payments/`,
`src/app/(site)/payments/`, `src/app/admin/invoices/`, `src/app/admin/refunds/`, `src/app/api/webhooks/razorpay/`,
or any Razorpay/invoice/refund/pricing/billing/tax-related path was created, modified, or read for context
by this patch. `git diff --stat` for this patch's changes touches only the files listed under MODIFIED FILES
above.

## KNOWN LIMITATIONS

Unchanged by this patch — see `docs/applications-guide.md` §12 and `M16_COMPLETION_REPORT.md` §18 for the
full list.
