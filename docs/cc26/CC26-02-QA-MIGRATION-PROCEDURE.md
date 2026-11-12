# CC26-02: QA migration procedure, recovery and approval requests

**Target:** Development-QA `ynwzijulzksmrcwdhudv` **only**. Production `bwlkxunujngksibfzzfv` is never a target: every migration refuses any approval value other than the QA value or `LOCAL-DISPOSABLE-TEST`.

**Nothing in this document has been run against QA.** Each step below waits for your written approval.

## 1. Files (in apply order)

| Order | File | One transaction | Needs | Purpose |
|---|---|---|---|---|
| — | `supabase/migrations-proposed/cc26/cc26_qa_preflight_readonly.sql` | READ ONLY, rolled back | — | QA state, drift, exposure counts |
| 1 | `cc25/0023_cc25_counsellor_identity_least_privilege.sql` (**revision 2**) | yes | 0001–0015 | Approval-gated counsellor access; NW07 narrowing (S1–S3) |
| 2 | `cc25/0024_cc25_revoke_anon_internal_rpcs.sql` | yes | 0011/0012 | Internal function privileges (S4) |
| 3 | `cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql` | yes | 0023 | Inactive counsellors; table privileges (S5–S7) |
| 4 | `cc26/0026_cc26_database_checkout_gate.sql` | yes | 0005/0007 | Database checkout gate, **closed** (S8) |
| tests | `cc25/0023_cc25_rls_tests.sql` and `cc26/cc26_security_tests.sql` | one transaction, **always rolled back** | 0023 | 89 + 45 checks with fictional fixtures; non-zero exit on any failure |

Rollbacks, in reverse order: `0026_cc26_ROLLBACK.sql`, `0025_cc26_ROLLBACK.sql`, `0024_cc25_ROLLBACK.sql`, `0023_cc25_ROLLBACK.sql`. Each is atomic and re-runnable, and each was proven byte-identical on both local states.

The NW-F01 package (NW09.2 atomic, 05, 06) and NW01 can be applied **before or after** this set: both orders are tested and converge. They are separate approvals (CC-16/CC-18).

## 2. Runner

`docs/cc26/qa/Run-CC26-Qa.ps1 -Step Preflight|Apply|Tests|Rollback -DbHost <session pooler host> -DbUser postgres.ynwzijulzksmrcwdhudv`

What it enforces:
- It refuses any target naming production, any target without the QA ref, and any port other than 5432.
- You type the QA ref. Write steps also need a typed phrase (`APPLY CC-26 TO QA` / `ROLL BACK CC-26 ON QA`).
- The password is read without echo and cleared afterwards. `psql` runs with `ON_ERROR_STOP=1`.
- Output goes to `cc26-qa-<step>-<time>.txt`.
- `-IncludeCheckoutGate` adds 0026 (Apply) or its rollback (Rollback).
- It never uses a linked Supabase CLI. Never use `supabase db push`.

## 3. Procedure

1. **Backup (dashboard).** Database → Backups, or note a PITR timestamp. Record the ID and time, and confirm restore is available.
2. **Preflight** (`-Step Preflight`). Read the markers:
   - **Q1**: is NW07 applied, and is it the ORIGINAL rule? If yes, S1 is live on QA: apply 0023 r2 promptly.
   - **Q2**: which of 0023–0026 are present. 0023 revision 1 counts as "applied (any revision)"; revision 2 re-applies safely over it.
   - **Drift**: the policy hashes must match the expected state; the migrations also refuse on drift.
   - **Exposure counts**: see the table below.
   - `auth_uid.reads_claim_sub` must be true (the tests' login helper relies on it).
3. **Apply** (`-Step Apply`, then separately `-IncludeCheckoutGate` once approved). Each file prints nothing on success. Any failed precondition or postcondition aborts that file with no change.
4. **Tests** (`-Step Tests`). They must end with `89 checks, 89 passed` and `CC26|SUMMARY|pass=45|fail=0` on an NW07 database. On a database without NW07 it is `pass=32`, with 13 SKIP. Any failure exits non-zero.
5. **Admin follow-up.** Existing session assignments are **unapproved** after 0023. Admins approve each one with one click in Admin → Discovery Sessions; each approval is audited. The preflight's exposure count says how many need approval.
6. **Re-run the preflight.** All Q2 markers should now be true and the exposure counts unchanged.

| Preflight exposure indicator | What a non-zero count means |
|---|---|
| Sessions assigned (active) | They need admin approval after 0023 before the counsellor regains session access |
| Caseload rows held by inactive counsellors | These counsellors lose access with 0025; reassign the students |
| Student-created plan invoices (unpaid) | Created through the S8 path before 0026; review and void in Admin → Finance if fictional |
| Payment attempts created by students | Same, for the attempt path |
| System audit rows | Compare with expected webhook activity; unexpected rows may be S4 forgeries |

## 4. Recovery

- **Any error before COMMIT** rolls the whole file back automatically. Fix the cause and re-run; every file is idempotent.
- **After COMMIT, forward fix first.** Roll back only the migration that misbehaves (`-Step Rollback`). Rolling back re-opens its defect, so approve it separately and run the preflight before and after.
  - 0023 rollback restores exactly the NW07 state it replaced (original or patched, recorded by a marker on the function comment).
  - 0026 rollback re-opens S8; payments must stay off.
- **Last resort:** restore the backup from step 1.
- **App compatibility:** the CC-26 app works with or without the migrations. Identity lookup falls back when the CC-25 RPC is missing; checkout is paused in the app anyway. Roll back the app only together with 0023, to the CC-24 build (see the CC-25 handoff).

## 5. Approval requests

| # | Request | Writes | Prerequisite |
|---|---|---|---|
| A1 | Run the read-only preflight on QA | nothing | backup recorded |
| A2 | Apply 0023 r2, 0024, 0025 on QA, then run the rolled-back test suites | QA schema | A1 output reviewed; no drift |
| A3 | Apply 0026 (database checkout gate, closed) on QA | QA schema (one table, two triggers) | A2 passed |
| A4 | After A2: admins approve the existing Discovery Session assignments | QA data (audited) | A2 |
| A5 | Push branch `cc26/launch-readiness` and create the Vercel **Preview** against QA (CC26-12) | remote | your commit of CC-26 |
| A6 (separate, later) | NW-F01 package and NW01 on QA (CC-16/18 plan); Razorpay **test-mode** checks | QA schema | human security sign-off |
| A7 (read-only, by you) | Check in the production dashboard whether `counsellor_has_case_access` exists (S1 exposure) | nothing | — |
