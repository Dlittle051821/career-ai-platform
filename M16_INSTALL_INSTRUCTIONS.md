# Milestone 16 (v3 — final student database-boundary hardening) Install Instructions

These steps assume no special Git or database expertise. Follow them in
order; do not skip the "inspect diff" and "verify via SQL" steps even if
everything else seems to be going smoothly.

This ZIP, `nextwise-m16-student-application-workflow-v3.zip`, is an
**update package/delta** — unlike the v2 ZIP (a complete copy of the
runnable application), this one contains **only the files v3 actually
created or changed**, plus this document, `M16_COMPLETION_REPORT.md`, and
`MANIFEST.md`. If you already applied the v2 delivery (or the original v1
delivery plus v2), copying these files in is the entire update.

**If you have NOT yet applied `0017_student_application_workflow.sql` to any
database at all** (the situation this patch assumes): this ZIP's copy of
that migration already has every v1/v2/v3 fix baked in — you only ever need
to apply it once, and you can skip straight to Step 5.

**If you already applied a pre-v3 `0017` to a staging database** (whether
that was the original v1 version or the v2-patched version): this migration
file is safe to re-run as-is. Every statement in it is idempotent (`drop
policy if exists` / `create policy`, `create or replace function`, `add
column if not exists`, `drop constraint if exists`), so re-applying the v3
file only changes the specific policies/functions this patch touched — it
does not re-create anything or duplicate data.

## 1. Back up first

Before touching anything, make a copy of your current project folder (or
confirm you have a recent backup / your Git remote is up to date).

## 2. Confirm your Git working tree is clean

```
git status
```

## 3. Copy the files from this ZIP into your project

Extract this ZIP, then copy every file inside it **except** `MANIFEST.md`,
`M16_COMPLETION_REPORT.md`, and this file (`M16_INSTALL_INSTRUCTIONS.md`)
into your project folder, preserving the folder structure exactly. Only
these files actually changed relative to what v2 already gave you:

- `supabase/migrations/0017_student_application_workflow.sql` (patched in place again — see below)
- `src/lib/supabase/education/applications.ts`
- `src/types/database.ts`
- `src/lib/applications/application-workflow-migration-security.test.ts`
- `src/lib/supabase/education/applications.test.ts`
- `docs/applications-guide.md`
- `MANIFEST.md`, `M16_COMPLETION_REPORT.md`, this file

## 4. Inspect the diff before doing anything else

```
git status
git diff
```

Confirm the changed files match the list above exactly. If you see anything
unexpected touched — in particular anything under `src/lib/payments/`,
`src/app/admin/refunds/`, `src/app/admin/invoices/`, or any migration file
other than `0017_...sql`, or a new `0018_...sql` file — stop and investigate:
this patch was built to touch nothing payment-related and to modify `0017`
in place rather than add a new migration.

## 5. Install dependencies

```
npm install
```

## 6. Run the type checker

```
npx tsc --noEmit
```

Should complete with no errors.

## 7. Run the linter

```
npm run lint
```

Should complete with no errors.

## 8. Run the test suite

```
npm test
```

Should report **1165/1165 passing** across 66 files (up from 1112/1112
before this patch — +53 new tests, 0 removed). If any pre-existing test
outside the files listed in Step 3 fails, stop and investigate — that would
indicate an unexpected regression.

## 9. Run a production build

```
npm run build
```

Confirm it completes successfully and lists the same 77 routes as before —
this patch adds no route and removes none.

## 10. Apply (or re-apply) the database migration

Using your normal Supabase migration workflow, apply
`supabase/migrations/0017_student_application_workflow.sql` to your
**staging** database first — never production first.

- **First time applying `0017` at all**: proceed exactly as you would for
  any other new migration.
- **Already applied a pre-v3 `0017`** (v1 or v2): re-running this same file
  is safe (see the idempotency note at the top of this document) and will
  only change the specific policies/functions this patch touched.

## 11. Verify the migration applied correctly via SQL

Connect to your staging database and run the verification queries in
`M16_COMPLETION_REPORT.md`'s "Manual QA — Database" section, including the
new v3-specific ones (confirming the two Milestone-9 student policies are
gone, the three admin/counsellor policies are untouched, the new
`get_my_applications()`/`get_my_application()`/`student_start_application()`
functions' grants, the narrowed mutation-RPC return shapes, and the new
course/university trigger).

## 12. Deploy to staging

Deploy the application code (not production) to your staging environment,
pointed at the staging database you just migrated.

## 13. Run the manual QA plans

Follow, in order:

1. `M16_COMPLETION_REPORT.md`'s "Manual QA — Student" 13 steps.
2. `M16_COMPLETION_REPORT.md`'s "Manual QA — Admin" 10 steps.
3. `M16_COMPLETION_REPORT.md`'s "Manual QA — Patch-specific (RLS/IDOR
   verification)" 6 steps (v2 — exercises the `application_status_history`
   fixes).
4. `M16_COMPLETION_REPORT.md`'s new "Manual QA — v3 patch-specific
   (database-boundary verification)" 7 steps — these are the ones that
   actually exercise this patch's own fixes: direct-table-access attempts
   against `applications` itself, application creation via the new RPC,
   course/university mismatch rejection, and the admin flow continuing to
   work unaffected.

## 14. Roll back the application code if needed

If staging QA surfaces a problem, revert the application code changes
(`git revert` the commit that applied this patch, or restore from your Step
1 backup) without touching the database — none of this patch's database
changes are destructive to existing data.

## 15. Do not casually reverse the database migration

Once `0017_student_application_workflow.sql` (in any of its v1/v2/v3 forms)
has been applied and real students have started using the new
fields/RPCs, do **not** write and run a "down" migration to remove the new
columns/indexes/functions/policies as a first response to an
application-code issue — that would delete real student data and break
anything already relying on the new RPCs. If the database layer itself
needs to change beyond what this patch already covers, write a new,
forward-only migration (`0018_...sql`) instead, the same way every prior
milestone in this project has handled schema evolution.
