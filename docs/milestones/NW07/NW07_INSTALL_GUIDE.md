# NW07 — Counsellor Studio Foundation — Install Guide

This package contains every file NW07 added or changed in the Nextwise repository, the one proposed (unapplied) database migration, and this milestone's full documentation set. It does **not** contain `node_modules/`, `.next/`, `.git/`, `.env.local`, credentials, or any database dump.

## 1. What's in this ZIP

```
NW07-COUNSELLOR-STUDIO-FOUNDATION/
├── NW07_INSTALL_GUIDE.md                  (this file, also under docs/milestones/NW07/)
├── SHA256_MANIFEST.txt                    sha256 checksum of every file below
├── docs/milestones/NW07/                  all 13 milestone docs (audit, 7 stage reports, architecture,
│                                           database plan, security threat model, QA, completion, this guide)
├── supabase/migrations-proposed/
│   └── NW07_counsellor_studio_foundation.sql   PROPOSED migration — NOT applied, review before use
└── src/                                   every implementation + test file NW07 added or changed,
    └── app/...                            at its real repository-relative path
    └── components/...
    └── lib/...
    └── types/...
```

Full list of implementation files, split by new vs. modified, is in `docs/milestones/NW07/NW07_ARCHITECTURE.md` §2–3.

## 2. How to install into your real repository

1. Make sure you're starting from a clean working tree (commit or stash anything in progress) — the usual precaution before applying any external patch set, nothing NW07-specific.
2. Copy every file under this package's `src/` folder into your repository's `src/` folder at the **same relative path**, overwriting the 6 modified files that already exist and adding the ~27 new `src/` files (exact list in `NW07_ARCHITECTURE.md` §2–3).
3. Copy `docs/milestones/NW07/` into your repository's `docs/milestones/` folder.
4. **Do NOT copy `supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql` into your active `supabase/migrations/` folder.** It is a reviewable proposal, not something to apply automatically — see §3 below. `/counsellor/**` will not return real case/profile/recommendation data until it is reviewed and applied.
5. From your repository root, run:
   ```
   npm install          # only if dependencies changed — NW07 added none
   npx tsc --noEmit      # confirm a clean type-check
   npx vitest run        # confirm the full suite passes (expect 139 files / 2309 tests)
   npm run lint           # confirm 0 new errors
   npm run build           # confirm the production build succeeds
   ```
6. Verify the checksums if you want to confirm nothing was altered in transit.

   **macOS/Linux (POSIX):**
   ```
   sha256sum -c SHA256_MANIFEST.txt
   ```
   (On macOS without GNU coreutils: `shasum -a 256 -c SHA256_MANIFEST.txt`.)

   **Windows (PowerShell-native — no extra tools required):**
   ```powershell
   Get-Content SHA256_MANIFEST.txt | ForEach-Object {
     $hash, $path = $_ -split '  ', 2
     $actual = (Get-FileHash -Algorithm SHA256 -Path $path).Hash
     if ($actual -ieq $hash) { "OK: $path" } else { "MISMATCH: $path" }
   }
   ```

## 3. The one proposed migration — review before applying

`supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql` (798 lines) does two things, in two clearly separated PARTs:

- **PART 1** widens 14 existing RLS policies (`profiles`, 11 Student Digital Profile tables, `admin_student_meta` SELECT, `admin_student_notes` SELECT+INSERT) to fix a real pre-existing gap — a counsellor who only ran a student's Discovery Session (never directly assigned via `admin_student_meta`) could not read that student's actual profile data at all. Full explanation: `NW07_DATABASE_CHANGE_PLAN.md` §2.
- **PART 2** adds two new tables (`recommendation_drafts`, `recommendation_draft_versions`) and 9 new `SECURITY DEFINER` RPCs implementing the Recommendation Workflow (draft → review → approve → release), with self-approval prevention and zero plain write RLS for any role. Full explanation: `NW07_DATABASE_CHANGE_PLAN.md` §3, `NW07_SECURITY_THREAT_MODEL.md`.

Apply it only after a founder/admin reviews the file's own header and PART comments, by copying it into `supabase/migrations/` with the next sequential number and running it through your normal migration process. Every `/counsellor/**` page and `src/lib/supabase/admin/recommendation-drafts.ts`/`src/lib/supabase/education/recommendation-reports.ts` depend on this migration being applied — without it, these surfaces will return empty lists or RPC errors, not incorrect data.

## 4. What NW07 did NOT do

Per the milestone's own explicit constraints: **no commit, no push, no deploy, no database/Supabase change applied, no fabricated data or statistics, no partnership claims, no secret packaged.** This package is a patch set to apply yourself — it does not touch your git history, your deployed environment, or your database in any way. The one proposed migration above requires your own explicit review and action to take effect.

## 5. The one disclosed testing limitation

This milestone's sandbox had no live Supabase project connected, so no authenticated, live-rendered browser pass was possible over any `/counsellor/**` or `/studio/recommendation-reports/**` page. `docs/milestones/NW07/NW07_08_QA_REPORT.md` §3 gives the exact manual-verification steps to run against your real staging environment, after the proposed migration is applied, before treating this milestone as fully production-verified.

## 6. Where to read more

- `docs/milestones/NW07/NW07_COMPLETION_REPORT.md` — overall status, the 8-stage table, and what's handed off to the next milestone.
- `docs/milestones/NW07/NW07_ARCHITECTURE.md` — exact file list, dependency graph, and the reasoning behind every structural decision.
- `docs/milestones/NW07/NW07_SECURITY_THREAT_MODEL.md` — the full STRIDE-style threat review, including self-approval prevention and the student-sees-only-released-reports guarantee.
- `docs/milestones/NW07/NW07_DATABASE_CHANGE_PLAN.md` — everything about the one proposed migration.
- `docs/milestones/NW07/NW07_08_QA_REPORT.md` — the full validation gate, new test coverage, and the disclosed testing limitation.
