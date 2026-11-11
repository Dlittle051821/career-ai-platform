# CC24-07 — Handoff guide (Windows PowerShell)

**Worktree:** `C:\ClaudeBuilds\CC24-STUDENT-JOURNEYS`
**Branch:** `cc24/student-journey-stabilization`
**Base:** `a1017b9`

The CC-24 changes are present in the worktree as **uncommitted** files. Nothing has been committed, pushed or deployed. `C:\carrier.ai` was not modified.

The scripts below live in `C:\ClaudeBuilds\Milestones\CC24-STUDENT-JOURNEY-STABILIZATION`.

## 0. One-time finishing step

The file bridge can write files but cannot delete them. One CC-24 fix (D04, real 404s) needs two now-obsolete files removed:
- `src/app/(site)/universities/loading.tsx`
- `src/app/(site)/courses/loading.tsx`

Their content moved to `list-skeleton.tsx` in the same folders. Run:

```powershell
cd C:\ClaudeBuilds\Milestones\CC24-STUDENT-JOURNEY-STABILIZATION
powershell -ExecutionPolicy Bypass -File .\Finish-CC24.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\Finish-CC24.ps1 -InstallDependencies
```

`Finish-CC24.ps1` does the following:
1. Checks the branch, that HEAD is `a1017b9`, and that nothing is staged.
2. Checks every CC-24 file against `CC24-FILE-MANIFEST.json`.
3. Removes the two `loading.tsx` files, but only if they are the untouched `a1017b9` originals.
4. Checks that the 45 CC-18 security files and the 39 V5.4 homepage and brand files are unchanged.
5. With `-InstallDependencies`, runs `npm.cmd ci` inside the CC-24 folder only. This needs network access.
6. Runs typecheck, lint, tests and the production build, and writes `finish-cc24-<time>.txt`.

It never commits, pushes, runs SQL, or touches Supabase or Vercel.

## 1. Inspect the worktree

```powershell
cd C:\ClaudeBuilds\CC24-STUDENT-JOURNEYS
git rev-parse --abbrev-ref HEAD          # cc24/student-journey-stabilization
git rev-parse HEAD                       # a1017b9dddf7ad132e4ccb1fb8abb424042c8fe7
git worktree list                        # CC24 listed separately from C:\carrier.ai
git status --short                       # the CC-24 changes, uncommitted
git diff --stat                          # modified tracked files
git status --short --untracked-files=all | Select-String '^\?\?'   # new files
```

## 2. Run the tests

Install dependencies once (CC-24 folder only):

```powershell
npm.cmd ci
```

Then:

```powershell
npm.cmd run typecheck -- --incremental false
npm.cmd run lint
npm.cmd test                                   # expect 175 files, 3,045 passed, 1 skipped
npx.cmd vitest run src/lib/payments/cc24-payment-safety.test.ts      # one file
npx.cmd vitest run -t "V5.4 homepage"          # homepage byte-guard only
```

## 3. Run the development server

Use a **QA or local** Supabase project only, never production. Create `.env.local` in the CC-24 folder with the QA values. The file is git-ignored; never commit it.

```powershell
notepad .env.local
# NEXT_PUBLIC_SUPABASE_URL=https://<QA project>.supabase.co
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<QA publishable key>
# NEXT_PUBLIC_APP_URL=http://localhost:3000
# (no NEXTWISE_PAID_CHECKOUT*, no RAZORPAY_*, no OPENAI_API_KEY, no AI_*_APPROVED)
npm.cmd run dev
```

Open http://localhost:3000.

## 4. Build the application

```powershell
Remove-Item Env:NEXTWISE_PAID_CHECKOUT, Env:NEXTWISE_PAID_CHECKOUT_PREREQUISITES, Env:RAZORPAY_KEY_ID, Env:RAZORPAY_KEY_SECRET, Env:OPENAI_API_KEY, Env:AI_OPENAI_APPROVED -ErrorAction SilentlyContinue
npm.cmd run build
npm.cmd run start      # production mode on http://localhost:3000
```

Quick checks while it runs:

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/universities/no-such-university   # 404
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/careers/no-such-career             # 404
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/counsellor                         # 307 (to /login)
```

## 5. Check the git changes

```powershell
git diff -- src/lib/supabase/middleware.ts       # one change at a time
git diff --check                                 # whitespace problems
git status --short -- src/components/sections/home src/lib/home public/home-v54 public/brand   # must be empty (homepage untouched)
```

## 6. Prepare a future reviewed release (do not run without approval)

1. **Review.** Read `docs/cc24/CC24-06-RELEASE-READINESS-REPORT.md` and the diff.
2. **Commit locally** (your decision):
   ```powershell
   git add -A
   git status --short     # confirm: no .env*, no node_modules, no .next
   git commit -m "CC-24: student journey stabilization (validation, real 404s, counsellor labels, payment gate)"
   ```
3. **Database (separate approval).** Migration 0023 goes to QA first (CC24-03 §3); NW06/NW07 and the CC-18 payment migrations are separate decisions.
4. **Staging (separate approval).** Push the branch, let Vercel build a **Preview** with **QA** environment variables, rerun the journeys there, and check Safari/iOS and a screen reader.
5. **Production (separate approval).** Production promotion is outside CC-24's authorization. Keep Instant Rollback to the current production deployment as the fallback.

## 7. Roll back CC-24

```powershell
cd C:\ClaudeBuilds\Milestones\CC24-STUDENT-JOURNEY-STABILIZATION
powershell -ExecutionPolicy Bypass -File .\Rollback-CC24.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\Rollback-CC24.ps1
```

This restores the CC-24-modified files and the two `loading.tsx` files from `a1017b9`, and removes the CC-24-added files. It refuses if a file changed after delivery, unless you pass `-Force`. It refuses if anything was committed on the branch. The worktree itself stays.

To remove the worktree entirely:

```powershell
git -C C:\carrier.ai worktree remove C:\ClaudeBuilds\CC24-STUDENT-JOURNEYS
git -C C:\carrier.ai branch -D cc24/student-journey-stabilization
```

## 8. Re-run the browser journeys (optional, local stack)

The Playwright journey harness used for CC-24 (suites B, C, D/E, F, G, H, R, V) and its local-stack scripts are in the milestone folder under `harness\`. It runs against a disposable local Supabase (PostgreSQL 16, GoTrue, PostgREST) on Linux or WSL, and is not wired to QA. To run the same journeys against QA, point it at a QA-only Preview with fictional accounts after approval.
