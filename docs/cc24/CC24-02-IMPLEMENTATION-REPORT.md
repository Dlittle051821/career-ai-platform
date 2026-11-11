# CC24-02 — Implementation report

**Baseline:** `a1017b9`. **Branch:** `cc24/student-journey-stabilization`.

**Nothing committed, pushed, merged or deployed.** No SQL was run against QA or production, and no Vercel, Supabase or Razorpay configuration changed.

**Change set:** 67 paths (`CC24-FILE-MANIFEST.json`).
- **34** source files modified.
- **13** source files added, 2 of them the renamed list skeletons.
- **2** files removed: the old list-level `loading.tsx` files (`Finish-CC24.ps1` removes them on Windows).
- **7** test files and 1 test fixture added.
- **3** proposed SQL files and **7** docs.

Untouched:
- **No CC-18 file** (45/45 unchanged);
- **no V5.4 homepage, logo or brand file** (39/39 byte-identical, pinned by a test);
- no `package*.json`, config, env or migration.

Every fixed defect has a regression test that **fails on the unmodified `a1017b9`**: 28 failures across the 6 main new test files (`evidence/regression/new-tests-on-unmodified-baseline.log`). The `/counsellor` middleware test was added later and fails on the baseline too.

## Fixes

### D02 (P1) — Discovery Session request accepts arbitrary input

- **Root cause.** `bookDiscoverySession()` inserted `preferredTimeRange`, `preferredLanguage` and `studentNotes` exactly as received. Server Actions can be called directly; only the contact method had a DB CHECK.
- **Resolution.**
  - New pure `normalizeBookingInput()`: allow-lists matching the form (morning / afternoon / evening; English / Odia / Hindi; phone / video / WhatsApp); note trimmed and ≤ 1,000 characters; non-object payloads rejected. Called before any query.
  - The form's textarea gets the same `maxLength`.
- **Files:**
  - `src/lib/discovery-sessions/booking-input.ts` (new)
  - `src/lib/supabase/discovery-sessions/book.ts`
  - `src/components/sections/discovery-session/DiscoverySessionBookingForm.tsx`
- **Tests.** `src/lib/discovery-sessions/cc24-booking-input.test.ts` (19): the real `bookDiscoverySession` with only Supabase faked shows no insert on rejection and only normalized values stored. Browser F8: now PASS.

### D03 (P1) — Profile actions accept unbounded text and rows

- **Root cause.** The 11 profile save actions validated choices against option lists but not text length or row counts, and the DB has no limits.
- **Resolution.**
  - New `PROFILE_TEXT_LIMITS` (city 100 … life goals 2,000), `MAX_EDUCATION_RECORDS = 10` and `MAX_EXPERIENCE_RECORDS = 15`, plus `findTextLimitError()`.
  - About You, Education, Interests, Career Goals, Study preferences and Experience check them **before** any delete, insert or upsert.
  - Inputs carry matching `maxLength`; the "Add another" buttons stop at the row limits.
- **Files:**
  - `src/lib/profile/input-limits.ts` (new)
  - `src/lib/supabase/student-profile-actions.ts`
  - `src/components/sections/profile/onboarding/steps/` — `AboutYouStep`, `CareerGoalsStep`, `EducationStep`, `ExperienceStep`, `InterestsStep`
- **Tests.** `src/lib/profile/cc24-profile-input-limits.test.ts` (13): the real actions with only Supabase faked; zero writes on rejection; the maximum valid rows still save.

### D04 (P1) — Soft 404 on career, university and course detail routes

- **Root cause (two parts).**
  1. The lookups returned `null` both for "no such published record" and for "query failed", so the pages rendered a "couldn't find" card with HTTP 200.
  2. `/universities/loading.tsx` and `/courses/loading.tsx` wrap **every child route** in a Suspense boundary. The status (200) is sent before a detail page can call `notFound()`, so even a correct `notFound()` stayed a soft 404, also for crawlers.
- **Resolution.**
  - Three-way `DetailLookup` (`found` / `not_found` / `unavailable`) for career, university and course. The old null-returning functions remain as wrappers for other callers.
  - The pages call `notFound()` only for `not_found`. On `unavailable` they show "This … can't be shown right now" (never a misleading 404).
  - University and course detail segments get a small `layout.tsx` that checks existence before their own `loading.tsx` boundary. A request-scoped `React.cache` lookup is shared by the layout, metadata and page, so it is still one query.
  - The two list-level skeletons became each list page's own `<Suspense>` fallback (`list-skeleton.tsx`, same markup). The lists keep their skeleton and no longer wrap the detail routes.
  - Not-found cards keep the previous wording (`DetailRecordNotice`).
- **Files:**
  - `src/lib/supabase/detail-lookup.ts` (new), `src/lib/supabase/education/detail-lookups.ts` (new)
  - `src/lib/supabase/careers.ts`, `src/lib/supabase/education/universities.ts`, `src/lib/supabase/education/courses.ts`
  - `src/components/sections/DetailRecordNotice.tsx` (new)
  - Careers: `src/app/(site)/careers/[slug]/page.tsx`, `src/app/(site)/careers/[slug]/not-found.tsx` (new)
  - Universities: `src/app/(site)/universities/[slug]/page.tsx`, `layout.tsx` (new), `src/app/(site)/universities/not-found.tsx` (new), `src/app/(site)/universities/page.tsx`, `loading.tsx` → `list-skeleton.tsx`
  - Courses: `src/app/(site)/courses/[universitySlug]/[courseSlug]/page.tsx`, `layout.tsx` (new), `src/app/(site)/courses/[universitySlug]/not-found.tsx` (new), `src/app/(site)/courses/page.tsx`, `loading.tsx` → `list-skeleton.tsx`
- **Tests.** `src/lib/education/cc24-detail-not-found.test.ts` (16), including a guard that no parent segment of a detail route has a `loading.tsx`. Browser D3 and E3: PASS. HTTP check: unknown, draft and unpublished return 404; published return 200; a database fault gives a 200 "can't be shown right now" (`evidence/run/detail-status-codes.txt`).
- **Alternative rejected.** Moving the list pages into a `(list)` route group also fixes the status, but it broke the V4/V5.4 homepage link tests that locate `courses/page.tsx` by path. It was reverted so no homepage test needed changing.

### D05 (P2) — `/counsellor` not protected by the middleware

- **Root cause.** `/counsellor` was missing from `PROTECTED_PATHS`. A signed-out visitor got HTTP 200 "Access denied — your account is signed in…". The layout's role gate still blocked all data.
- **Resolution.** Added to `PROTECTED_PATHS`: signed-out visitors now go to `/login?next=/counsellor…`.
- **File:** `src/lib/supabase/middleware.ts`
- **Tests.** `src/lib/auth/cc24-middleware-counsellor.test.ts` (6). Browser R1: PASS.

### D06 (P2) — Verify-payment action outside the launch gate

- **Resolution.** `verifyCheckoutAction` refuses while paid checkout is off, before any DB call. Settlement of a genuine payment never depends on it (the signed webhook does).
- **File:** `src/app/(site)/payments/actions.ts`
- **Tests.** `src/lib/payments/cc24-payment-safety.test.ts` (13), including tree-wide guards on every money-moving call site.

### D07 (P2) — "Unnamed student" hid a permission problem

- **Root cause.** A profile hidden by RLS rendered as an empty name.
- **Resolution.**
  - The staff loader marks `studentIdentityVisible`.
  - The new `describeDiscoverySessionStudent()` labels the hidden case "Student details restricted", with a reason: "appear once this request is assigned to you", or "Ask an admin to check your access".
  - "Unnamed student" remains only for a readable profile with no name.
  - Used on all 7 admin and counsellor Discovery Session screens.
  - No access is widened; the access fix is migration 0023 (CC24-03).
- **Files:**
  - `src/lib/discovery-sessions/student-identity.ts` (new)
  - `src/lib/supabase/admin/discovery-sessions.ts`
  - `src/types/discovery-session.ts`
  - `src/app/admin/discovery-sessions/{page, [id]/page, [id]/workspace/page}.tsx`
  - `src/app/counsellor/{page, discovery-sessions/page, discovery-sessions/[id]/page, discovery-sessions/[id]/workspace/page}.tsx`
- **Tests.** `src/lib/discovery-sessions/cc24-student-identity.test.ts` (15): the real loader with RLS-like filtering. Browser R3/R4.

### D08 (P2) — Password toggle touch target

- **Resolution.** The show/hide button is now 32×32 px, inside the input's existing 44 px right padding. Same icon and position.
- **Files:** `LoginForm.tsx`, `RegisterForm.tsx`, `ResetPasswordForm.tsx`
- **Test:** `cc24-ux-and-homepage-guard.test.ts`

### D09 (P2) — Unexplained `*` markers

- **Resolution.** Under every step heading except Review: "Fields marked * are needed to finish your profile. You can continue or save and come back to them later." This keeps partial saving (brief A3).
- **Files:** `OnboardingWizard.tsx`, `useProfileWizard.tsx`
- **Tests.** Unit, plus browser C11. The C11 criterion was updated to "legend shown and partial save allowed", recorded in CC24-04.

### D10 (P2) — Country chips on `/courses`

- **Resolution.** An optional `note` on `LaunchCountryDiscovery`. `/courses` explains that the chips show the official portal and that the Country filter narrows the list. `/universities` is unchanged (its chips do filter). M20C's independence of `destination` and `country` is preserved and still pinned by its tests.
- **Files:** `LaunchCountryDiscovery.tsx`, `src/app/(site)/courses/page.tsx`

### D11 (P3) — Welcome choice runtime check

- **File:** `src/app/(site)/welcome/actions.ts`
- **Test:** `cc24-ux-and-homepage-guard.test.ts`

## Homepage preservation

- `src/components/sections/cc24-ux-and-homepage-guard.test.ts` pins SHA-256 (line endings normalized) of all 39 V5.4, logo and brand files and of `src/app/(site)/page.tsx`.
- Browser suite V compares the CC-24 build with the deployed `a1017b9` build:

| Check | Result |
|---|---|
| Rendered DOM, desktop and mobile | Identical |
| Page height | Identical |
| Internal links (28) | Identical |
| Screenshots at 8 scroll positions per viewport, motion paused | 16/16 pixel-identical |
| Console errors | 0 |

## Test totals

| Run | Result |
|---|---|
| Vitest, baseline | 168 files, 2,906 passed, 1 skipped |
| Vitest, CC-24 | **175 files, 3,045 passed, 1 skipped**: +139 new tests; none removed or skipped |
| Existing tests changed | **None.** The CC-23 browser harness (not part of the repo) had two checks updated, C11 and the F11 wording, noted in CC24-04. |

## Rollback

- **Whole milestone.** In `C:\ClaudeBuilds\CC24-STUDENT-JOURNEYS`:
  1. `git restore --staged --worktree -- .`
  2. `git clean -n` to review, then remove only the CC-24 new files listed in `CC24-FILE-MANIFEST.json`.
  3. Or remove the worktree and branch: nothing is committed, and `C:\carrier.ai` is untouched.

  `Rollback-CC24.ps1` (milestone folder) does this safely. It refuses if a file changed after delivery, unless `-Force`.
- **One fix.** Each section above lists its files. Restore them from `a1017b9` and delete the matching `cc24-*.test.ts`.
- **Database.** Nothing to roll back; no migration was applied. 0023 has its own rollback SQL.
