# UX03-04 File Manifest

Every file created or modified for UX03 (Design System Consistency) and UX04 (Student Journey Experience),
organized by category. Paths are repo-relative. See `UX03-04_COMPLETION_REPORT.md` for the full
audit/design writeup, `UX03-04_INSTALL_INSTRUCTIONS.md` for the install steps, and
`docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md` for the complete per-component audit and per-stage journey data
source table.

This manifest describes UX03-04 only. It supersedes the previous "Milestone 13 File Manifest" that lived at
this path — see `git log -- MANIFEST.md` (or `M13_COMPLETION_REPORT.md`) for that history.

## Baseline

- Repository: `Dlittle051821/career-ai-platform`, branch `release/m10`
- Real remote `origin/release/m10` SHA at audit time: `6ac3fe147c9e8cb489cd118a900d2e2c20b89015` (M12)
- This environment's working HEAD at audit time: `09fb6b416bb3e325fa324f7de1eb545e6475cd7c` (M13, committed
  locally, not yet pushed to the real remote — see `UX03-04_COMPLETION_REPORT.md` for why)

## UX03 audit summary

- **Card system**: 110 existing call sites of `src/components/ui/Card.tsx`, plus 18 hand-rolled bordered
  divs surveyed. One genuine consolidation made (`AuthLayout.tsx`, below); the rest documented as either
  structurally not a card (dialogs, menus, sticky trays, accordions) or a deliberately-deferred table-scroll
  wrapper pattern (5 files, left alone — see design doc §2.1).
- **Badge/status system**: audited all four tone-map components (`StatusBadge`, `TrustBadge`,
  `ReadinessBadge`, `MatchBandBadge`). Finding: all four already render through the shared `Badge`
  component's six-tone palette — the "shared appearance layer" this milestone asks for already exists.
  Deliberately left unchanged (see design doc §2.2).
- **Typography/spacing**: `PageHero`/`SectionHeading`/`Container`/`Section` already consistent across every
  page type audited. No new abstraction introduced.
- **Loading/empty/error states**: one genuine duplication found and consolidated (three form
  success-notice blocks, below). Route-level loading/error boundaries beyond `/pricing` audited and
  recorded as a deferred UX05+ item (not touched this pass).
- **Accessibility**: spot-checked (focus-visible, heading hierarchy, touch targets, reduced motion, colour
  independence) — no regressions found; new components built to the same bar.

## UX04 journey model summary

Six stages — Explore, Build Profile, Recommendations, Saved Options, Decide, Apply — computed by
`computeJourneyProgress()` from data the dashboard already fetches. Full per-stage data source, completion
logic, and known limitations: `docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md` §3.1. Summary:

| Stage | Data source | Limitation |
|---|---|---|
| Explore | Derived from downstream activity (no direct source) | Cannot use real page-view tracking without a new RLS policy (database change) — avoided per spec |
| Build Profile | `calculateCompletion()` | None — direct, already-shown status |
| Recommendations | `getMyRecommendationReadiness()` | "Complete" means ready to view, not reviewed (no "reviewed" signal exists) |
| Saved Options | `listSavedItems()` | Labelled "Saved Options", not "Shortlist" — the underlying model is a flat saved boolean |
| Decide | None exists | Permanently informational; never completes; never blocks Apply |
| Apply | `listMyApplications()` | "Complete" means a record exists, not that it was submitted |

## New files

**Lib**
- `src/lib/dashboard/journey-progress.ts` — `computeJourneyProgress()`, the UX04 journey model.
- `src/lib/dashboard/journey-progress.test.ts` — coverage: new/incomplete-profile/recommendation-ready/
  saved-item/existing-application journeys, no false completion, Decide never completes or blocks Apply,
  stage ordering.
- `src/lib/dashboard/next-best-action.ts` — `getNextBestAction()`, extracted verbatim from
  `src/app/(site)/dashboard/page.tsx` (same logic, same copy — purely relocated so it can be tested).
- `src/lib/dashboard/next-best-action.test.ts` — coverage of its full priority chain.

**UI**
- `src/components/sections/dashboard/JourneyProgress.tsx` — the dashboard "Your journey" component
  (horizontal stepper ≥640px, vertical list below that).
- `src/components/ui/FormSuccessNotice.tsx` — shared "form preview completed" success notice, replacing
  three hand-rolled duplicates.

**Documentation**
- `docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md` — full UX03 audit + UX04 journey model design doc.
- `UX03-04_COMPLETION_REPORT.md` — this milestone's completion report.
- `UX03-04_INSTALL_INSTRUCTIONS.md` — step-by-step install/QA guide (includes the manual QA checklist).
- `MANIFEST.md` — this file.

## Modified files

- `src/app/(site)/dashboard/page.tsx` — removed the inline `getNextBestAction()` definition (now imported
  from `src/lib/dashboard/next-best-action.ts`); added `computeJourneyProgress()` call and the new
  `<JourneyProgress>` card directly below "Your next step"; reordered "Your account" and "Your roadmap"
  further down the page (content of both cards is unchanged — only their position moved). No data-fetching
  logic changed; the same queries that already ran are simply also passed into the new journey computation.
- `src/components/sections/auth/AuthLayout.tsx` — migrated its hand-rolled bordered surface onto the shared
  `Card` component (`padded={false}` plus an explicit className reproduces the original classes exactly).
- `src/components/sections/book-counselling/BookingForm.tsx` — its "form preview completed" success block
  now renders via `FormSuccessNotice`; wording unchanged.
- `src/components/sections/career-discovery/WaitlistForm.tsx` — same consolidation, `size="sm"` to match
  its original (smaller) padding/icon size; wording unchanged.
- `src/components/sections/contact/ContactForm.tsx` — same consolidation as BookingForm; wording unchanged.
- `vitest.config.mts` — added `src/lib/dashboard/**/*.test.ts` to the test-include list (a new pure-logic
  directory needs an explicit entry, same as every prior milestone's own lib directory) plus a matching doc
  comment. No existing include entry changed or removed.

## Database

**None.** No migration added. No table, column, policy, or function changed.

## Environment

**None.** No new environment variable required.

## M13 isolation

Confirmed via `git diff --stat` against this milestone's starting commit (`09fb6b4`): no file under
`supabase/`, `src/lib/payments/`, `src/lib/supabase/admin/refunds.ts`, `src/app/admin/refunds/`,
`src/components/admin/refunds/`, or `src/app/(site)/payments/` appears in this milestone's changed-file
list. `docs/payments-billing-guide.md` was not touched. No refund, payment, invoice, or gateway logic was
read, referenced, or modified by any file in this manifest.

## Test results

- `npm run typecheck` — clean, no errors.
- `npm run lint` — clean, no errors or warnings.
- `npm test` — **946/946 passing** across 60 test files (up from 926/58 before this milestone; +20 new
  tests across the 2 new `src/lib/dashboard/` test files, zero pre-existing tests changed or removed).
  Milestone 11-A/B/C, Milestone 12 pricing, and Milestone 13 refund test suites all remain green.
- `npm run build` — succeeded; all 77 routes compiled/generated without error.

## Everything else in the repository

Not modified. In particular: no changes to `.env.local`/`.env.example`, no changes to any file under
`supabase/migrations/` or `supabase/seed/`, no changes to any M8–M13 payments/refunds/pricing/signature/
stamping/onboarding/readiness business logic, no changes to `src/components/ui/Card.tsx` or
`src/components/ui/Badge.tsx` themselves (both were audited and found already correct — see
`docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md` §2.1–2.2), and no new npm dependency.
