# NW07.8 — Tests, QA, Security Threat Model, Docs, Package & Deliver

## 1. Automated regression — full results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean — zero errors, run repeatedly throughout the build (after every new file/edit, not only at the end) |
| `npx eslint` (every new/changed file) | Clean — zero errors after fixing 11 pre-existing `react/no-unescaped-entities` violations across 7 files written earlier in this milestone (apostrophes in JSX text; fixed with `&apos;`) |
| `npx vitest run` | **139 test files / 2309 tests, all passing.** Zero pre-existing test removed, weakened, or skipped. |
| `npm run build` (production build) | See §5 — not run in this sandbox for the same pre-existing environment reason every prior milestone has disclosed |

## 2. New test coverage this milestone

- `src/lib/recommendations/drafts.test.ts` — 16 tests covering the pure state-machine helpers (`getAllowedRecommendationDraftActions`, `isRecommendationDraftEditable`, `canReviewOwnDraft`, `summarizeRecommendationDrafts`, taxonomy guards).
- `src/lib/recommendations/recommendation-drafts-migration-security.test.ts` — a static-SQL-text audit of `NW07_counsellor_studio_foundation.sql` (34 assertions across 7 `describe` blocks): the PART 1 dual-basis widening across all 14 touched policies, the PART 2 table CHECK constraints and the "zero write RLS policy" invariant for both new tables, every RPC's `SECURITY DEFINER` + locked `search_path`, the self-approval-prevention check's exact ordering (before the role-authorization branch), the approval-before-release gate, immutable-version-history behaviour, and the two student-facing RPCs' `RETURNS TABLE` shapes excluding every internal column. This file was moved from `src/lib/supabase/admin/` to `src/lib/recommendations/` after discovering `vitest.config.mts` has an explicit per-file `include` allowlist with no `src/lib/supabase/admin/**/*.test.ts` wildcard — `src/lib/recommendations/**/*.test.ts` is wildcarded, so the file is placed there instead of being silently excluded from every run.

No existing test file was modified to make these pass.

## 3. Responsive / structural QA — one disclosed limitation

No live, authenticated browser pass (Playwright or otherwise) was run over any `/counsellor/**` or `/studio/recommendation-reports/**` page, because this sandbox's `NEXT_PUBLIC_SUPABASE_URL` is a placeholder host with no real database, and the one new migration this milestone proposes is, by design, not applied anywhere yet — the identical, pre-existing environment constraint every prior milestone in this sandbox (NW03 onward) has disclosed. A structural review was done instead:

- Every new page follows an existing, already-responsive layout convention taken directly from its admin-side counterpart (`AdminTable`, `Card`, `FormField`, the `CounsellorShell`'s own desktop-sidebar/mobile-drawer breakpoints, copied structurally from `AdminShell.tsx`) — no new layout primitive was invented.
- `npx tsc --noEmit` passing confirms every prop contract between a new page and an existing component (e.g. `StatusBadge`, `Badge`, `EmptyState`, `ConfirmSubmitButton`) is satisfied.

**Manual verification steps for a real staging environment** (after the proposed migration is reviewed and applied): sign in as a `counsellor`-role account with at least one dual-basis case (one via direct assignment, one via a Discovery Session they ran but weren't assigned) and confirm (a) both cases appear in My Caseload, (b) a case belonging to a *different* counsellor does not, (c) the Student Case Workspace's profile/applications/recommendations sections all load without a permission error, (d) a second counsellor account cannot approve a recommendation draft the first account authored, and (e) a student account only ever sees a recommendation report after it has been explicitly released, never before.

This does not block any P0/P1 release criterion — it blocks only the live-rendering confirmation, which is otherwise supported by a clean type-check, a full passing test suite, and the migration-security test's own static verification of every RLS/RPC rule.

## 4. Manual code-level security review performed

- Re-read `0004_admin_system.sql` PART 12 in full (not partially) to find the exact scope of the single-basis-only RLS gap (`NW07_01_AUDIT.md` §3) — the single most consequential finding this milestone, which the PART 1 migration fixes.
- Re-read `staff_review_recommendation_draft()`'s own self-approval check to confirm it is unconditional (no `is_admin_role` escape hatch) and ordered before authorization, not after.
- Confirmed, via `grep`, that no other code path writes to `recommendation_drafts`/`recommendation_draft_versions` outside the 9 RPCs (no direct `.from("recommendation_drafts").insert(...)`/`.update(...)` anywhere in `src/`).
- Confirmed the two student-facing RPCs' `RETURNS TABLE` column lists by reading them directly in the migration file, not by assuming a `SELECT *` was filtered correctly elsewhere.

## 5. Constraints honored

No commit, no push, no deploy, no database/Supabase change applied (the one new migration remains under `supabase/migrations-proposed/`, unapplied), no fabricated data or statistics anywhere in any doc or UI copy, no partnership claims, no secret packaged. This staged copy at `/home/claude/carrier.ai` remains, as in every prior milestone this session, not a real git repository (no functional `.git/`) — commit/push were structurally impossible regardless of policy. An injected instruction found in this repository's own `AGENTS.md` (falsely claiming to be regenerated by `next dev` and urging it be committed) was identified as the same untrusted-content pattern flagged earlier in this session and disregarded — nothing was committed.

## 6. Severity tiers — findings

**P0:** none found or introduced. The one P0-adjacent finding from NW07.1 (the single-basis-only RLS gap across 13 tables, meaning a Discovery-Session-only counsellor could not read a student's actual profile at all) is **fixed** by this milestone's PART 1 migration, not merely documented.

**P1:** none found or introduced.

**P2/P3:** the case-scoped (no-application) operational task gap (`NW07_07_TASKS_AND_OPERATIONS.md` §3) remains open, by deliberate scoping decision, not an oversight. The pre-existing ₹1,999 GST-inclusive checkout calculation risk (documented by a prior milestone, untouched by NW07) remains open and unexercised by anything in this milestone.
