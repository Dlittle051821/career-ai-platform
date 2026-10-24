# NW03.5 — NW01/NW02 Integration & Feature Preservation

**Milestone:** NW03 "Two-Product Architecture"
**Stage:** 5 of 6
**Depends on:** NW03.1–NW03.4

## 1. Method

This stage re-opens every file NW01 and NW02 are known to have introduced or materially changed, confirms each was either left untouched by NW03.2–NW03.4 or touched only in the one deliberate, documented way, and re-runs the full validation gate as the empirical check. "Known to have introduced or materially changed" is drawn from this session's own direct reads of the code (not from a historical report assumed to still be accurate) — the same discipline NW03.1 applied.

## 2. NW01 "Trust & System Integrity" — preservation checklist

| Invariant | File(s) | Status after NW03.2–NW03.4 |
|---|---|---|
| Open-redirect-safe `next` validation is the ONLY mechanism used anywhere a `next` param drives a redirect | `src/lib/auth/safe-redirect.ts` | Untouched. NW03.3's `RegisterForm.tsx` fix calls this exact function rather than adding a second check. |
| Role-aware default workspace resolution (admin → `/admin`, else → `/dashboard`) | `src/lib/auth/default-workspace.ts` | Untouched. NW03 does not change the global post-login default; `/studio` is an additional, explicitly-chosen destination (via an explicit `next`), not a replacement for this resolver. |
| `admin_roles` (authorization) kept separate from `profiles.account_type` (presentation-only label) | `src/lib/admin/permissions.ts`, `src/lib/supabase/use-auth-profile.ts` | Untouched. |
| `getNextBestAction()` / `computeJourneyProgress()` — honest, never-fabricated Career progress signals | `src/lib/dashboard/journey-progress.ts` | Untouched. `/studio/abroad` deliberately does NOT add an equivalent Abroad signal yet — it uses `ComingSoon`/`DemoNotice` instead, following this exact file's own documented discipline rather than violating it. |
| `profileCompletenessMessage()` correctness fix | `src/components/dashboard/ProfileCompletenessCard.tsx` | Untouched. |
| IST-labelled discovery-session date/time formatter | `src/lib/discovery-sessions/format.ts` | Untouched. |
| Admin-shell/public-shell/dashboard-shell separation (three independent root layouts) | `src/app/admin/layout.tsx`, `src/app/(site)/layout.tsx`, `src/app/dashboard/layout.tsx` | Untouched. NW03.3 adds a fifth independent root layout (`src/app/studio/layout.tsx`) following the exact same pattern — it does not merge into or alter any of the three existing ones. |

Empirical confirmation: every pre-existing test file under `src/lib/auth/`, `src/lib/dashboard/`, `src/lib/discovery-sessions/`, `src/components/dashboard/`, and `src/lib/navigation/` (all NW01-era test globs in `vitest.config.mts`) is still present and still passes — see §4.

## 3. NW02 "Complete Education Discovery Experience" — preservation checklist

| Invariant | File(s) | Status after NW03.2–NW03.4 |
|---|---|---|
| Exactly 7 launch destinations (India + Germany, Ireland, Netherlands, France, Sweden, Denmark) — no silent expansion | `src/lib/education/external-search/launch-countries.ts` (`LAUNCH_COUNTRY_CODES`) | Untouched. Confirmed by direct re-read this stage: still exactly `["IN", "DE", "IE", "NL", "FR", "SE", "DK"]`. |
| The 6-country Europe registry used by `/study-europe` | `src/data/europe-explorer.ts` (`EUROPE_COUNTRIES`) | Untouched. The new `/abroad` page (NW03.2) imports this exact constant to render its country teaser list — it is structurally impossible for `/abroad` to show a different set than `/study-europe`, since both read the same array. |
| Unified Course/University Explorer (not forked per product) | `/courses`, `/universities` and their supporting `src/lib/supabase/education/` modules | Untouched. NW03.2's `/career` and `/abroad` both link to the same `/courses` route rather than each getting its own course-search implementation. |
| `nw02-launch-destination-regression.test.ts` and related education test suites | `src/lib/education/external-search/*.test.ts` | Untouched, still passing (see §4). |

## 4. Validation gate (re-run, full repository)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 18 pre-existing warnings (identical set to the NW03.1 baseline — no new warning introduced) |
| `npx vitest run` | 128 test files, 2101 tests, all passed (127/2091 baseline + 1 new file/10 new tests from NW03.4; zero failures, zero skips) |
| `npm run build` | succeeded; every pre-existing route from the NW03.1 baseline still builds, plus the 5 new NW03 routes (`/career`, `/abroad`, `/studio`, `/studio/career`, `/studio/abroad`) |

No NW01 or NW02 test, route, or documented invariant regressed.

## 5. Resolved from NW03.1's open risks

- **R-3 (`/roadmap` ownership, previously `LEGACY-REQUIRES-REVIEW`):** Opened and read this stage. `/roadmap`'s own copy ("career-first journey", career discovery framing, `JOURNEY_STAGES` from `src/data/journey.ts`) confirms it is Career-only content. Reclassified **CAREER**. No change was needed — it remains reachable at its existing protected URL and is implicitly part of the Career Intelligence product surface `/studio/career` (→ `/dashboard`) belongs to; it did not need a new link added anywhere for this milestone's acceptance criteria.
- **R-1, R-2 (Abroad signup funneled through Career `/welcome`):** Resolved in NW03.3 (`RegisterForm.tsx` fix) and documented in `NW03_03_STUDENT_JOURNEYS.md` §4/§7.
- **R-4, R-5:** Confirmed still out of scope and untouched — the homepage composition and all payment/checkout/webhook code are unchanged by every NW03 stage so far.

## 6. What NW03.5 explicitly did not do

- Did not modify any NW01 or NW02 file as part of this stage — this stage is verification only, and the one open item it found (`/roadmap`'s classification) required a documentation update, not a code change.
- Did not add new tests beyond what NW03.4 already added — the full existing NW01/NW02 test suites are the evidence of preservation, re-run rather than re-written.
