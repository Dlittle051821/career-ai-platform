# CC25-02: Security architecture and migration review

**Scope:** counsellor access to Discovery Session students; the migration package `supabase/migrations-proposed/cc25/`.

**Status:** proposed and verified on a disposable local PostgreSQL 16. **It is not applied to QA or production.** Applying it to QA needs your explicit approval (§8).

## 1. Why the CC-24 proposal was rejected

The CC-24 file `cc24/0023_counsellor_discovery_session_profile_read.sql` added one SELECT policy on `public.profiles`. It gave a counsellor the whole profile row of any student with a Discovery Session assigned to them.

The independent review rejected it. We re-tested every concern against the real policies, all on the local database:

| # | Concern | Confirmed? | Evidence (baseline run, before the CC-25 migration) |
|---|---|---|---|
| 1 | A counsellor self-claim gives access | **Yes**, through 0013/0014 today. CC-24 0023 would have added profile access too. | V02, V05 and W02 FAIL: a counsellor who only claimed a session could write provenance, verifications and the workspace. |
| 2 | `student_user_id` can be changed | **Yes**, on both `discovery_sessions` and `admin_student_meta`. | A01 to A03 FAIL (session hijack). C04 FAIL (caseload hijack, a **new** finding). |
| 3 | The whole `profiles` row is exposed | Yes, by design of the rejected policy. | The policy text grants SELECT on every column. |
| 4 | Historical sessions keep access | **Yes** (0014). | V03 and V04 FAIL: completed and cancelled sessions still allowed writes. |
| 5 | 0014 has other assignment-based rules | **Yes**: workspace (0013 PART 3), provenance and verifications (0014). | G07 FAIL. |
| 6 | SQL tests don't fail on unexpected access | **Yes**: CC-24's `0023_rls_tests.sql` only printed lines. | Replaced by an executable suite (§6). |

Further pre-existing gaps found in CC-25:
- An inactive counsellor keeps session access (X02 FAIL).
- A counsellor holding an unapproved claim can cancel or reschedule the session (A06 FAIL).

`cc24/REJECTED.md` marks the old proposal. Its files are kept unchanged as the audit trail.

## 2. Design (least privilege)

```
                 admin approves (trigger stamps by/at from auth.uid(); audited)
counsellor ──claim──▶ discovery_sessions.assigned_counsellor_id = me
                      assignment_approved_counsellor_id = NULL   ← a claim grants nothing
                                   │
                admin assigns / approves ▼
                      assignment_approved_counsellor_id = assigned_counsellor_id
                                   │
     ┌─────────────────────────────┼───────────────────────────────────────┐
     ▼                             ▼                                       ▼
identity RPC                 workspace (session data)              provenance + verifications
id, name, email only         approved assignment, active           (student data): approved
approved + requested/        counsellor, any status                + requested/scheduled
scheduled + active                                                 + active counsellor
counsellor, OR caseload
```

Rules (every one is enforced in the database; the app only displays the outcome):

| Rule | Mechanism |
|---|---|
| Identity: only student ID, full name, email | `staff_discovery_session_student_identities(uuid[])` is `SECURITY DEFINER`, has `search_path=''` and returns exactly those columns plus the session id. `profiles` RLS is **unchanged** (G04, G06). |
| Admin-approved assignments authorize; self-claims don't | New columns `assignment_approved_counsellor_id/_by/_at`. Approval counts only while `approved_counsellor_id = assigned_counsellor_id`. |
| The database controls approval | `discovery_sessions_guard_cc25` trigger: only admins (or a server role without a user JWT) can set a non-null approval. `_by`/`_at` are always stamped from `auth.uid()` and `now()`, and cannot be forged even by an admin (M07). |
| An admin assigning a counsellor *is* the approval | The trigger stamps the approval when an admin changes the assignment through the existing form. Admins see no extra step. |
| Reassignment or unassignment revokes access | Any assignment change by a non-admin clears the approval; an admin's change re-approves for the new counsellor (R02, R05, R06, M09). |
| Unassigned sessions never expose identity | The RPC needs an approved assignment or the caseload (I02). |
| Access limited to active workflow states | Identity and student-level writes need `requested` or `scheduled` (I04, V03, V04). |
| Cancelled, completed and no-show sessions grant nothing | As above. Long-term access is the caseload (`admin_student_meta`). |
| Inactive counsellors are excluded | Session paths require `counsellors.is_active` (X01, X02). |
| Counsellors can't change the student on a booking | `student_user_id` is immutable for **every** role (A01 to A03, M08). |
| The caseload student can't be repointed | `admin_student_meta_guard_cc25` makes its `student_user_id` immutable (C04). |
| An unapproved counsellor can't change the session | Only a pure claim or a no-op save is allowed until approval (A06, A07). |
| Existing caseload permissions stay intact | `profiles` (m7) and the caseload branches are byte-for-byte unchanged (C01, C03, C05). |
| Approval is admin-only, audited and race-safe | `admin_set_discovery_session_assignment_approval(session, expected_counsellor, approve)` is `SECURITY INVOKER`, so RLS applies. It refuses a stale counsellor id (M03), inactive sessions (M04) and inactive counsellors, and writes `admin_audit_log` in the same transaction (M06). |
| No new service-role path | The app calls both RPCs with the user's own JWT, through `src/lib/supabase/admin/discovery-session-rpc.ts`. They're typed there so the protected CC-18 file `src/types/database.ts` stays byte-identical. A static test prevents a service-role import in the loader. |

## 3. Hardening review checklist

| Item | Result |
|---|---|
| `public.profiles` RLS | Unchanged: 3 policies (G06). The rejected CC-24 policy is dropped if present (G05). |
| `public.discovery_sessions` | Gained the guard trigger, 3 approval columns and a consistency CHECK. RLS policies are unchanged, so the triage queue and booking still work. |
| `public.admin_roles` | Unchanged. Escalation attempts are denied (A13, S07). |
| `public.counsellors` | Unchanged. A counsellor can't reactivate a colleague (A14). Deleting a counsellor clears approvals without breaking constraints (Z01, Z02). |
| `public.admin_student_meta` | Gained the immutability trigger. Policies are unchanged. |
| 0013 PART 3 (workspace) and 0014 (provenance, verifications) | Their session branch now uses `counsellor_has_approved_session` / `counsellor_has_active_session_for_student`. The caseload branch is verbatim. |
| Table grants | Supabase defaults give `anon`/`authenticated` every table privilege, including TRUNCATE, REFERENCES and TRIGGER. RLS protects row access; TRUNCATE/REFERENCES/TRIGGER aren't reachable through PostgREST. **Not changed** (minimal package). Recommended for a separate hardening migration, in the style of the CC-14 03 package. Report: `evidence/preflight-local-before.txt` §6. |
| SECURITY DEFINER functions | All 4 new functions pin `search_path=''` and fully qualify every object (G02 and a static test). `EXECUTE` is revoked from `PUBLIC` and `anon` (G03, postcondition). The trigger functions can't be called directly by anyone. |
| RLS recursion | No new policy queries a table whose policy queries back. The helpers are DEFINER and read `discovery_sessions`/`counsellors` as the owner. |
| Existing anon-executable definer RPCs | **Pre-existing P1, found in CC-25:** `record_system_audit_log`, `set_signature_document_path` and `set_stamp_document_path` (0011/0012) can be executed by `anon`. Reproduced locally: an anonymous caller can write a forged `system` audit-log row (`evidence/probe-anon-definer-rpcs.txt`). Fixed by the pending NW-F01 `01_internal_rpcs.sql`. An optional stopgap, `0024_cc25_revoke_anon_internal_rpcs.sql`, is provided (separate approval). |
| Proposed NW07 migration | `NW07_counsellor_studio_foundation.sql` (not applied) copies the unsafe "any assigned Discovery Session" rule. **Before NW07 is approved**, change its `counsellor_has_case_access` to call `counsellor_has_active_session_for_student`. |

## 4. Migration package

| File | Purpose |
|---|---|
| `0023_cc25_counsellor_identity_least_privilege.sql` | The migration. Atomic, re-runnable, approval-gated. Precondition and postcondition checks; reloads the PostgREST schema cache. |
| `0023_cc25_ROLLBACK.sql` | Restores the exact 0013/0014 state. Approval-gated and re-runnable. |
| `0023_cc25_rls_tests.sql` | 89 executable checks. Fictional fixture inside one transaction that is always rolled back. Exits nonzero on any failure. Refuses to run without a non-production target setting. |
| `0023_cc25_preflight_readonly.sql` | Read-only QA preflight: identity, migration markers, drift hashes, grants, RLS and counts-only impact. |
| `0024_cc25_revoke_anon_internal_rpcs.sql` + `0024_cc25_ROLLBACK.sql` | Optional stopgap (§3). Separate approval. |
| `scripts/security/cc25-counsellor-identity.db.test.mjs` | Builds a fresh DB from migrations 0001–0022, then runs the 7-step cycle, the mutation tests and the 0024 test (CC25-03). |

**Version and drift verification.** The migration refuses to run unless:
- 0001–0015 objects exist;
- 0014's provenance policy is in its exact original form, or in CC-25 form on a re-run;
- the helper functions exist.

The preflight prints MD5 hashes of every policy it touches, so QA can be compared with the local reference (`evidence/preflight-local-before.txt`).

## 5. Impact analysis

| Area | Effect |
|---|---|
| Existing assigned sessions on QA | Become **unapproved** (no backfill: least privilege). Counsellors keep seeing them in their list, marked "Awaiting admin approval". An admin approves each with one click, or reassigns. The preflight §8 counts them. |
| Admin workflow | Unchanged, plus an "Assignment approval" card. Assigning in the form approves automatically. |
| Counsellor workflow | Claiming still works. Until approval the counsellor can't see identity, change the session or use the workspace, and the UI says so (R25-03, R25-04). |
| Student booking | Unchanged (S05, N03, suite F). |
| Data | Additive: three nullable columns. No rows are rewritten. Rollback drops the columns, so approval decisions are lost but stay in the audit log. |
| Application compatibility | The CC-25 build works **with or without** the migration. Without it, the identity lookup falls back to the old RLS-limited read and counsellors see "restricted", exactly as in CC-24. Rolling back the migration therefore doesn't break the app. |
| Performance | One indexed lookup per session (≤100 ids per call). The helpers use the existing `discovery_sessions_student_idx` and `_counsellor_idx` indexes. |

## 6. Verification (local, disposable PostgreSQL 16 only)

Full results are in CC25-03:
- **Baseline:** 48 pass / 41 fail. Every `[CC25]` check fails, reproducing the defects.
- **After the migration:** 89/89.
- **After rollback:** the catalog is identical and the results equal the baseline.
- **Reapply, then final run:** 89/89.
- **Mutations:** 4 of 4 caught.
- **0024:** pass.
- **psql exit codes:** 3 before the migration, 0 after (`evidence/psql-tests-stackdb-*.txt`).

## 7. Residual risks

1. **Inactive counsellor, caseload path:** `current_counsellor_id()` ignores `is_active` (CC-24 D23). Session paths now check it; the caseload path (0004) still doesn't. Fix in a separate migration if wanted.
2. **Default table grants:** TRUNCATE and similar privileges for `anon`/`authenticated` (§3). Not reachable through the API.
3. **Unpaid invoice through the API:** the purchase RPC lets a signed-in student create an unpaid invoice directly (CC25-06 P2). No charge is possible.
4. **Review status:** CC-25 answers the six concerns of your independent review (§1). The work was then tested adversarially: the baseline reproduces each defect, and 4 deliberately weakened variants of the migration are each caught by the suite. No separate reviewer re-examined the CC-25 SQL itself. **A human security sign-off on this package is required before production, and recommended before QA.**

## 8. QA deployment procedure (needs your approval; NOT executed)

1. **Confirm the target.** In the Supabase dashboard the project ref must be **`ynwzijulzksmrcwdhudv`**. The SQL editor's project switcher must show it. Stop if you see `bwlkxunujngksibfzzfv` (production).
2. **Take a backup.** Database → Backups; note the timestamp.
3. **Run the preflight** `0023_cc25_preflight_readonly.sql`. Check:
   - every 0013–0022 marker is `t`;
   - the CC-24 policy and CC-25 markers are `f`;
   - the policy hashes match `evidence/preflight-local-before.txt`;
   - note the impact counts.
4. **Apply.** In one execution, run `select set_config('nextwise.cc25_0023_approval','APPROVED-QA-ynwzijulzksmrcwdhudv',false);` followed by the whole migration file. Expect `COMMIT`.
5. **Run the tests.** `select set_config('nextwise.cc25_test_target','QA-ynwzijulzksmrcwdhudv',false);` then `0023_cc25_rls_tests.sql`. Expect `CC25|SUMMARY|89 checks, 89 passed, 0 failed`. The fixture is fictional and rolled back. If the SQL editor refuses `insert into auth.users`, run it with `psql` using the `postgres` role over the session pooler instead.
6. **Re-run the preflight.** The CC-25 marker should now be `t`.
7. **Approve existing assignments.** In the staging app (Admin → Discovery Sessions), or reassign them.
8. **Rollback if needed.** Run the rollback with `nextwise.cc25_0023_rollback`, then the preflight again. All markers return to the step 3 values.

Optional **0024** follows the same steps with its own approval setting.
