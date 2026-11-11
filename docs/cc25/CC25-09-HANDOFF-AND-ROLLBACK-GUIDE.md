# CC25-09: Handoff and rollback guide (Windows PowerShell)

Everything runs from the milestone folder:

```powershell
cd C:\ClaudeBuilds\Milestones\CC25-STAGING-ACCEPTANCE
```

## 1. Verify and commit locally (no push)

```powershell
# 1a. read-only checks: branch, HEAD, manifest hashes, stray files, protected files, secret scan
powershell -ExecutionPolicy Bypass -File .\Finish-CC25.ps1 -DryRun

# 1b. full verification in the CC-25 folder only: npm ci, typecheck, lint, tests, npm audit, build
powershell -ExecutionPolicy Bypass -File .\Finish-CC25.ps1 -InstallDependencies

# 1c. when 1b is all PASS: the same run, then ONE local commit (never pushed)
powershell -ExecutionPolicy Bypass -File .\Finish-CC25.ps1 -InstallDependencies -Commit
```

Expected results:
- TypeScript passes.
- ESLint: 0 errors, 18 warnings (unchanged).
- Vitest: **176 files, 3,060 passed, 1 skipped**.
- `npm audit`: 0 vulnerabilities.
- The build passes.
- `git diff --check` is clean.

The commit message is `CC25-COMMIT-MESSAGE.txt`.

## 2. Database: QA only, after you approve

The full procedure is in **CC25-02 §8**.

Short version:
1. Back up QA.
2. Run the preflight (`0023_cc25_preflight_readonly.sql`).
3. Apply `0023_cc25_counsellor_identity_least_privilege.sql` with the approval setting.
4. Run `0023_cc25_rls_tests.sql`, then the preflight again.
5. Approve the existing assignments in the admin UI.

Optional: `0024_cc25_revoke_anon_internal_rpcs.sql`, with its own approval.

**Never production.** Never run `supabase db push` and never apply all pending migrations. Use only these files.

If you use `psql` with the QA session-pooler connection, leave the password out of the connection string. `psql` asks for it, so it never lands in your command history or a log:

```powershell
$qa = 'host=aws-0-<region>.pooler.supabase.com port=5432 dbname=postgres user=postgres.ynwzijulzksmrcwdhudv sslmode=require'
psql $qa -v ON_ERROR_STOP=1 -f .\migration-proposal\0023_cc25_preflight_readonly.sql
psql $qa -v ON_ERROR_STOP=1 -c "select set_config('nextwise.cc25_0023_approval','APPROVED-QA-ynwzijulzksmrcwdhudv',false)" -f .\migration-proposal\0023_cc25_counsellor_identity_least_privilege.sql
psql $qa -v ON_ERROR_STOP=1 -c "select set_config('nextwise.cc25_test_target','QA-ynwzijulzksmrcwdhudv',false)" -f .\migration-proposal\0023_cc25_rls_tests.sql
```

`-c` and `-f` run in the same session, so the approval setting applies to the file.

Before any write, check that the user name contains `ynwzijulzksmrcwdhudv`. Stop if you see `bwlkxunujngksibfzzfv`.

## 3. Staging Preview (after the commit, and your authorization)

The steps are in **CC25-07**: push the branch (plain push), set the branch-scoped QA variables, wait for the Preview, then:

```powershell
powershell -ExecutionPolicy Bypass -File .\Verify-CC25-Staging.ps1 -BaseUrl https://<preview>.vercel.app [-BypassToken <token>]
```

## 4. Signed-in acceptance on the Preview (manual, fictional QA accounts)

| # | Who | Do | Expect |
|---|---|---|---|
| 1 | New student | Register a fictional `@example.test` address you can receive, confirm the email, log in | The dashboard opens; the profile status is shown |
| 2 | Student | Complete 3 onboarding steps, Save & Exit, log out and in | The wizard resumes; answers kept |
| 3 | Student | Book the free Discovery Session | Status "Requested"; a second booking is refused |
| 4 | Admin | Admin → Discovery Sessions → assign counsellor A and schedule | The "Assignment approval" card says Approved |
| 5 | Counsellor A | Counsellor → Discovery Sessions | The student's name and email are shown |
| 6 | Counsellor B | Claim another open request | "Awaiting admin approval"; no name; can't change the status |
| 7 | Admin | Approve B's claim | B now sees the name |
| 8 | Admin | Reassign the session from step 4 to B | A no longer sees it; B does |
| 9 | Admin | Mark it completed | B sees "Details are only shown for requested or scheduled sessions" |
| 10 | Student | /pricing → Nextwise Verified | ₹1,999 incl. GST; no way to pay |
| 11 | Anyone | /careers/abc, /universities/abc, /courses/a/b | Real 404 |

Record PASS or FAIL for each step. Steps 4–9 need QA migration 0023. Without it, counsellors see "Student details restricted" (expected, safe).

## 5. Rollback

| What | How |
|---|---|
| Uncommitted CC-25 files | `powershell -ExecutionPolicy Bypass -File .\Rollback-CC25.ps1 -DryRun`, then run it without `-DryRun`. It restores the modified files from `3d5e373` and removes the added ones. Then run `npm ci`. |
| The local CC-25 commit | `git -C C:\ClaudeBuilds\CC25-STAGING-ACCEPTANCE revert --no-edit HEAD` (keeps history) |
| QA database 0023 | `0023_cc25_ROLLBACK.sql` with `nextwise.cc25_0023_rollback` set (CC25-02 §8). The CC-25 app keeps working: counsellors see "restricted". |
| QA database 0024 | `0024_cc25_ROLLBACK.sql` with `nextwise.cc25_0024_rollback` |
| Preview | Delete the deployment or remove the branch-scoped variables. Production is never touched. |

## 6. What was never done

These need you, or a separate authorization:
- no push, merge or deploy;
- no production change;
- no SQL on QA or production;
- no payments or paid AI enabled;
- no change to the V5.4 homepage or portrait;
- no edit to `C:\carrier.ai` working files.
