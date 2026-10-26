# NW08 — Admin & Operations: Business Command Centre — Install Guide

## 0. Read this first — avoiding double-installation confusion

Unlike a patch set applied from scratch, **this ZIP is a release/backup artifact of changes already made directly in your working repository during this session.** If you are reading this from inside the same repository NW08 was built in, your `src/` and `docs/` are already in the post-NW08 state — do not copy this ZIP's files over them again. This ZIP exists so you have (a) a durable, portable snapshot of exactly what changed, and (b) a way to apply the same change set to a **different** copy of the repository (e.g. your own `C:\carrier.ai`, if this work was done in a separate sandbox). Check your repository's own state first (`git status`/`git diff`, or simply open `src/app/admin/page.tsx` and look for "Command Centre") before copying anything from this ZIP on top of it.

## 1. What's in this ZIP

```
NW08-ADMIN-OPERATIONS/
├── NW08_INSTALL_GUIDE.md                  (this file, also under docs/milestones/NW08/)
├── SHA256_MANIFEST.txt                    sha256 checksum of every file below
├── docs/milestones/NW08/                  all 14 milestone docs
└── src/                                   every implementation + test file NW08 added or changed,
    └── app/...                            at its real repository-relative path
    └── components/...
    └── lib/...
```

No `supabase/` folder — **NW08 created zero migrations**, proposed or applied. See `NW08_DATABASE_CHANGE_PLAN.md`.

Full list of new vs. modified files: `NW08_ARCHITECTURE.md` §2–3.

## 2. How to install into a DIFFERENT copy of your repository

1. Make sure you're starting from a clean working tree (commit or stash anything in progress).
2. Copy every file under this package's `src/` folder into your repository's `src/` folder at the **same relative path**, overwriting the 14 modified files that already exist and adding the 5 new files.
3. Copy `docs/milestones/NW08/` into your repository's `docs/milestones/` folder.
4. From your repository root, run:
   ```
   npm install          # only if dependencies changed — NW08 added none
   npx tsc --noEmit      # confirm a clean type-check
   npx vitest run        # confirm the full suite passes (expect 139 files / 2326 tests)
   npm run lint           # confirm 0 new errors
   npm run build           # confirm the production build succeeds
   ```
5. Verify the checksums if you want to confirm nothing was altered in transit.

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

## 3. Nothing to apply to your database

NW08 reads only tables that already existed before this milestone. There is no proposed migration to review or apply — see `NW08_DATABASE_CHANGE_PLAN.md` for why none was needed.

## 4. What NW08 did NOT do

Per the milestone's own explicit constraints: **no commit, no push, no deploy, no database/Supabase change, no fabricated data or statistics, no partnership claims, no secret packaged, no checkout or payment-calculation change, no new dependency.** This package is a patch set / backup to apply yourself if needed — it does not touch your git history, your deployed environment, or your database in any way.

## 5. The disclosed testing limitations

This milestone's sandbox had no live Supabase project connected, so no authenticated, live-rendered browser pass was possible, and no pixel-level mobile-breakpoint verification was possible. `docs/milestones/NW08/NW08_08_QA_REPORT.md` §3 gives the exact manual-verification steps to run against your real staging environment.

## 6. Where to read more

- `docs/milestones/NW08/NW08_COMPLETION_REPORT.md` — overall status and the NW09/NW10/NW11 handoff section.
- `docs/milestones/NW08/NW08_ARCHITECTURE.md` — exact file list and the reasoning behind every structural decision.
- `docs/milestones/NW08/NW08_METRIC_DICTIONARY.md` — what every number on every new/changed page actually means.
- `docs/milestones/NW08/NW08_SECURITY_THREAT_MODEL.md` — the STRIDE-style review of this milestone's additions.
- `docs/milestones/NW08/NW08_DATABASE_CHANGE_PLAN.md` — why zero migrations were needed.
- `docs/milestones/NW08/NW08_08_QA_REPORT.md` — the full validation gate, the AC01–AC30 table, and the disclosed limitations.
