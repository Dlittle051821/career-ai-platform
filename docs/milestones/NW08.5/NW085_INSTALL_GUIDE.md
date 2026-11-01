# NW08.5 — Install Guide

## 1. What this package is

`NW08-5-GLOBAL-UX-REFINEMENT.zip` is a **clean update package** — the
files this milestone actually created or modified, plus the two files it
deletes, plus this milestone's own 13 documentation files. It is **not**
a full copy of the repository (per this session's established convention
for update packages — see e.g. the M13 refund-operations package). Apply
it on top of your existing `carrier.ai` checkout; do not extract it over
an empty directory expecting a runnable project on its own.

No database migration is included — this milestone made no schema change.
No environment variable is added or changed.

## 2. Files to delete first

These two files are dead code after the navigation flattening (task #66)
and must be removed — they no longer compile against the new
`src/config/site.ts` exports and are not included in this package:

```
src/components/navigation/ExploreMenu.tsx
src/components/navigation/NavDropdown.tsx
```

## 3. Files to add or overwrite

Extract the archive into your `carrier.ai` checkout root, allowing it to
overwrite existing files at these paths:

**New files:**
```
src/components/navigation/WorkspaceEntryLink.tsx
src/components/registration-prompt/RegistrationPrompt.tsx
src/lib/registration-prompt/eligibility.ts
src/lib/registration-prompt/storage.ts
src/lib/registration-prompt/event-bus.ts
src/lib/registration-prompt/eligibility.test.ts
src/lib/registration-prompt/registration-prompt-source-audit.test.ts
```

**Modified files (overwrite in place):**
```
src/config/site.ts
src/config/site.test.ts
src/components/navigation/Header.tsx
src/components/navigation/MobileNav.tsx
src/lib/navigation/nw04-public-website-audit.test.ts
src/lib/navigation/account-menu.ts
src/lib/navigation/account-menu.test.ts
src/app/(site)/layout.tsx
src/app/(site)/about/page.tsx
src/components/sections/home/HomeHero.tsx
src/lib/home/hero-composition-audit.test.ts
src/components/admin/AdminTable.tsx
src/app/admin/counsellors/page.tsx
vitest.config.mts
```

**New documentation (all 13 files, informational only, safe to add
anywhere under `docs/milestones/NW08.5/`):**
```
docs/milestones/NW08.5/NW085_01_PUBLIC_PAGE_AUDIT.md
docs/milestones/NW08.5/NW085_02_NAVIGATION_ARCHITECTURE.md
docs/milestones/NW08.5/NW085_03_HOMEPAGE_REDESIGN.md
docs/milestones/NW08.5/NW085_04_DISCOVERY_PAGE_REDESIGN.md
docs/milestones/NW08.5/NW085_05_INFORMATION_AUTH_PAGES.md
docs/milestones/NW08.5/NW085_06_REGISTRATION_PROMPT.md
docs/milestones/NW08.5/NW085_07_AUTHENTICATED_UX_AUDIT.md
docs/milestones/NW08.5/NW085_08_SEO_PERFORMANCE_ACCESSIBILITY.md
docs/milestones/NW08.5/NW085_09_QA_REPORT.md
docs/milestones/NW08.5/NW085_ARCHITECTURE.md
docs/milestones/NW08.5/NW085_DESIGN_SYSTEM.md
docs/milestones/NW08.5/NW085_COMPLETION_REPORT.md
docs/milestones/NW08.5/NW085_INSTALL_GUIDE.md (this file)
```

## 4. After extracting

```bash
npm install                 # no new dependency was added; confirms your lockfile is intact
npx tsc --noEmit             # expect: clean, 0 errors
npx vitest run               # expect: 141 test files, 2360 tests, all passing
npm run lint                 # expect: 0 errors, 18 warnings (pre-existing <img> warnings, unrelated to this package)
npm run build                # expect: succeeds, 131 routes
```

If any of these differ from the expected result, stop and diff your tree
against the file lists in §2/§3 before assuming the new code is at fault —
this almost always means a file was partially applied or an unrelated
local change is present.

## 5. Manual verification this environment could not perform

No real Supabase credentials exist in the sandbox this was built in (only
`.env.example` is committed), and this environment never deploys or runs
`npm run start`. Once you run this for real, with your own
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
`.env.local`:

1. Visit `/` signed out — confirm the headline reads exactly "Know What's
   Next." and the hero search bar actually submits to `/careers?q=...`.
2. Confirm the primary desktop nav shows exactly six flat items (Home,
   Explore Careers, Career Intelligence, Study Abroad, Universities,
   Courses) with no dropdown.
3. Browse any public page for ~45 seconds without interacting — confirm
   the Registration Prompt dialog appears once, with the exact copy in
   `NW085_06_REGISTRATION_PROMPT.md`, and does not reappear for 7 days
   after being dismissed (check by inspecting
   `localStorage.nw_registration_prompt_dismissed_until` in devtools).
4. Confirm the prompt never appears while signed in, and never on
   `/login`, `/register`, `/pricing/checkout/*`, `/admin/*`, or `/welcome`.
5. Sign in as a counsellor account (`profiles.account_type = 'counsellor'`)
   — confirm both the account-menu dropdown's "Counsellor Workspace" link
   and the header's workspace pill now go to `/counsellor`, not `/admin`.
6. Sign in to `/admin/pricing` and `/admin/counsellors?view=workload` with
   React DevTools or the browser console open — confirm no duplicate-key
   warning appears (the bug this milestone fixed).
7. Responsive pass at 375/768/1024/1440px on `/`, `/careers`, `/abroad`,
   and the registration-prompt dialog — check for overflow and touch-
   target sizing, which this sandbox cannot verify without a live browser.
