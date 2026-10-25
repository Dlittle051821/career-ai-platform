# NW06.4 — Application Workflow State Machine

**Status:** Complete — confirmation only, no code change needed.

## 1. What the brief asked

A real, server-enforced application lifecycle (stages, allowed transitions, who can advance what) backing every application a student starts.

## 2. What already existed (Milestone 16, extended by Milestone 19)

`supabase/migrations/0017_student_application_workflow.sql` already built the full lifecycle: an 11-value `ApplicationStage` vocabulary, `student_advance_application()`/`student_start_application()`/`get_my_applications()`/`get_my_application()`/`get_my_application_status_history()` (all `SECURITY DEFINER`, all deriving identity from `auth.uid()`), duplicate-active-application partial unique indexes, and — critically — the v3 hardening that removed every direct student RLS policy on `applications`, making these RPCs the entire access boundary, not merely a convenience layer on top of one.

`supabase/migrations/0022_authoritative_submission_invariant.sql` (Milestone 19) then closed the one gap a prior review found: a database-level trigger (`applications_enforce_submitted_transition`) makes it structurally impossible for anything other than `staff_record_application_submission()` to ever set `stage = 'submitted'` — `student_advance_application()`'s own `'submit'` action is permanently unreachable (`fromStages: []` in `src/lib/applications/application-lifecycle.ts`), enforced in the database, not just the UI.

## 3. What NW06 verified, and changed

Verified: every one of this milestone's new code paths (the task system, the dashboard) reads `applications.stage` but never writes it — `staff_create_application_task()`, `staff_update_application_task_status()`, and `student_complete_application_task()` (all three in `supabase/migrations-proposed/NW06_application_tasks.sql`) touch only the new `application_tasks` table; none of them contains an `update public.applications` statement, confirmed by direct reading of each function body.

Changed: nothing. No migration in `supabase/migrations/` was touched by NW06; the state machine itself is exactly as Milestone 16/19 left it.

## 4. Regression coverage

The pre-existing migration-security regression suite for this state machine — `application-workflow-migration-security.test.ts`, `application-submission-migration-security.test.ts`, `application-submission-invariant-migration-security.test.ts` — all still pass unchanged as part of this milestone's full 2254-test run (`NW06_08_QA_REPORT.md` §2); none of them was modified.

## 5. Conclusion

No regression, no code change required for this stage. The state machine NW06.1's audit classified `EXISTING_AND_FUNCTIONAL` remains exactly that.
