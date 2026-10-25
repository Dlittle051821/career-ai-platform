# NW05.1 — Existing System Audit

Status: **COMPLETE**

## 0. Repository state (checked, not assumed)

`git status`, `git branch --show-current`, `git log -1 --oneline` were all run first, as instructed. Result: `fatal: not a git repository`. `.git/` exists but contains only three files — `COMMIT_EDITMSG`, `HEAD`, `packed-refs` — no object store, no refs directory, no index. This has been the consistent, repeated finding across every milestone of this session (NW02 through NW04): this staged copy of the repository, at `/home/claude/carrier.ai`, has never had a functional git history inside this environment. There is no `release/m10` branch reachable here, and no commit/diff/stash operation is possible.

Consequence for this milestone's constraints ("do not commit, do not push, do not switch branches without approval"): none of those are reachable actions from this environment regardless, so compliance is structural, not a discipline choice. This is reported honestly rather than fabricating a git-history inspection that could not actually be performed.

`package.json` confirms the expected stack: Next.js 16.3.1 (App Router), React 19.2.8, TypeScript, `@supabase/ssr` + `@supabase/supabase-js`, `razorpay`, Vitest. No ORM beyond the Supabase JS client. 22 applied migrations (`0001`–`0022`) plus one existing proposed-but-unapplied migration (`NW01_fix_purchase_pricing_plan_tax_handling.sql`), confirming this repository already has an established "proposed migrations live in `supabase/migrations-proposed/`, are never auto-applied" convention this milestone reuses rather than invents.

## 1. Subsystem classification

| Subsystem | Classification | Notes |
|---|---|---|
| Supabase Auth + session middleware | EXISTS_AND_WORKS | `src/lib/supabase/middleware.ts` — `/studio` (and its `/career`, `/abroad` children via prefix match) already in `PROTECTED_PATHS`, refreshes session, redirects unauthenticated visitors to `/login?next=...` before any markup renders. |
| Admin/counsellor role checks | EXISTS_AND_WORKS | Server-side only: `/admin/layout.tsx` calls `getCurrentAdmin()`; every privileged RLS policy below uses `public.is_admin_role(...)` / `public.current_counsellor_id()`, never a client-supplied flag. |
| Shared student profile (`/profile`, onboarding) | EXISTS_AND_WORKS | 11 physical tables (`0002_student_profile.sql`), `student-profile-actions.ts` (11 save functions + completion recompute), `calculateCompletion()`. Student-owned, RLS-scoped to `auth.uid()`. |
| **Counsellor verification / provenance** | **EXISTS_AND_WORKS, but with one real gap** | `student_profile_section_provenance` (0013 PART 4) is already fully secure: student has SELECT-only RLS, write policy is admin/assigned-counsellor only, `COUNSELLOR_VERIFIED` requires a DB-level CHECK constraint tying it to a real `verified_by_counsellor_id`/`verified_at`. **Gap:** `student-profile-actions.ts`'s 11 save functions never touch this table, so a student can edit a section a counsellor has verified and the provenance row silently keeps reading `COUNSELLOR_VERIFIED` for data the counsellor never actually saw. See §3. |
| Recommendation Readiness | EXISTS_AND_WORKS | `src/lib/supabase/recommendation-readiness.ts` (Milestone 11-C2) — student-facing read-only, combines profile completion + `student_recommendation_verifications` (same secure provenance pattern) + the real recommendation engine output. Already used by `/dashboard` and `/recommendations`. |
| Journey progress / Next Best Action | EXISTS_AND_WORKS | `src/lib/dashboard/journey-progress.ts`, `next-best-action.ts` — pure functions over real signals only, explicitly documented "never fabricate a signal" discipline (UX04/NW01 Part D/E). |
| Saved items | EXISTS_AND_WORKS | `src/lib/supabase/education/saved-items.ts` — flat `education_saved_items(student_user_id, entity_type, entity_id)`, RLS-scoped, idempotent save/remove. No country/product tag on the row itself — Abroad-scoping must be derived by joining to the university/course record's own `countryName` (see §5). |
| Student applications | EXISTS_AND_WORKS | `src/lib/supabase/education/applications.ts` — as of Milestone 16 v3, students have **zero direct table access**; every read/write goes through narrow SECURITY DEFINER RPCs (`get_my_applications`, `student_start_application`, `student_advance_application`) that structurally exclude staff-only columns. No `category`/`product` column exists — Abroad-scoping again requires a `universityId` → `countryName` join. |
| `/dashboard` (the de facto "Career Workspace") | EXISTS_AND_WORKS | Already composes every signal Section 07 of the brief asks for: profile completion, next-best-action, recommendations, saved items, applications, discovery session, important dates. `/studio/career` already redirects here (NW03.3 decision) — see §4. |
| `/studio` (Student Studio hub) | PARTIALLY_IMPLEMENTED | Currently a thin two-card chooser (NW03.3) with no journey overview, no next-best-action, no saved-items preview — see NW05.2. |
| `/studio/abroad` (Abroad Workspace) | PARTIALLY_IMPLEMENTED | Currently all `ComingSoon`/`DemoNotice` placeholders for everything except two outbound links — see NW05.5. |
| **Product entitlements** | **EXISTS, SECURITY-CRITICAL GAP (P0)** | See §2 — this is the central finding of this audit. |
| Payment/checkout flow | EXISTS, KNOWN P0 RISK, UNTOUCHED | The GST-inclusive ₹1,999 checkout-safety issue named in the brief is confirmed still present and was not touched, inspected for a fix, or exercised in any way this milestone. |
| Abroad-specific profile fields (target countries, intended study level, language-test status, document readiness) | NOT_IMPLEMENTED | Confirmed by schema inspection (`0002_student_profile.sql`) — no such columns exist today. `budgetBand` is the one adjacent field that does exist, and is generic (not Abroad-specific). See §5 for the scope decision this drives. |

## 2. THE CENTRAL FINDING — product entitlements currently trust an unpaid purchase

This is the most important thing this audit found, and it is a real, currently-live gap, not a hypothetical.

**How a purchase is actually created today:** `confirmPricingPurchaseAction` (`src/app/(site)/pricing/checkout/actions.ts`) runs the instant a student clicks "confirm" on the order-summary screen — **before Razorpay ever opens**. It calls `purchasePricingPlan()` → the `public.purchase_pricing_plan()` RPC (`0007_nextwise_pricing_offers.sql` PART 7), which writes an `invoices` row (`status = 'issued'`, unpaid) **and** a `pricing_purchases` row, in the same transaction. Only after that does the student get redirected to `/payments/[invoiceId]`, where the actual Razorpay `PayButton` → `verify_checkout_payment()` flow happens.

**How entitlements are currently computed:** `getMyProductEntitlements()` / `classifyPurchaseEntitlements()` (`src/lib/products/entitlements.ts`, NW03.4) read every row in `pricing_purchases` for the signed-in student and classify it as an active Career or Abroad entitlement — with **zero reference to whether the linked invoice was ever actually paid.**

**The consequence:** any signed-in student can obtain `hasCareerEntitlement: true` or `hasAbroadEntitlement: true` by clicking "confirm" on a paid plan and then simply closing the tab, declining the Razorpay payment sheet, or letting the payment fail — no money needs to change hands. The same is true for a purchase that is later fully refunded: `recompute_invoice_status()` (`0005_payments_billing.sql`) correctly sets the invoice's own `status` to `'refunded'`/`'partially_refunded'` once `public.refunds` records a processed refund, but `pricing_purchases` rows are documented as immutable and are never updated or deleted, and nothing in `entitlements.ts` re-checks the invoice.

This matches the brief's own named risk almost exactly (AC-11/AC-12, "pending/failed/refunded purchases must not grant paid access") — except it is worse than "pending/failed can leak through," because a row in `pricing_purchases` is also written for every eventual **refund**, with no record ever removed. The fix (NW05.6) is to join every purchase to its invoice's live `status` and only treat `status = 'paid'` as an active entitlement — everything else (`draft`, `issued`, `partially_paid`, `overdue`, `void`, `refunded`, `partially_refunded`) is excluded, fail-closed on any lookup error. This requires **zero schema change** — `invoices.status` is already the authoritative, already-correctly-maintained source of truth; `entitlements.ts` simply never consulted it.

## 3. Second finding — counsellor-verified profile sections can go stale silently

`student_profile_section_provenance` (§1 table) is already fully secure against a student *claiming* verification — there is no student INSERT/UPDATE policy on that table at all, and the DB-level CHECK constraint means a row can never even exist in a `COUNSELLOR_VERIFIED` state without a real counsellor id and timestamp. The gap is narrower and different: once a counsellor has verified a section (e.g. "Education"), nothing stops the student from later editing that same section through the ordinary onboarding wizard, and nothing downgrades the stale `COUNSELLOR_VERIFIED` provenance row to reflect that the data has changed since a counsellor actually saw it. A student reading their own profile, or the Recommendation Readiness screen reading `student_profile_section_provenance`, would keep seeing "counsellor verified" attached to data a counsellor never reviewed.

Fix (NW05.3): a narrow, one-directional SECURITY DEFINER RPC that a student's own save action calls after a successful write — it can only ever downgrade *their own* row to `SELF_ENTERED`, never set it to `COUNSELLOR_ENTERED`/`COUNSELLOR_VERIFIED`. This is a genuinely new (proposed, unapplied) migration — the smallest one that closes this specific gap without widening student write access to the provenance table in any other way.

## 4. Career Workspace — already reuse, not rebuild

`/studio/career` already redirects to `/dashboard` (NW03.3's deliberate decision, reaffirmed by this audit). `/dashboard` already composes, from real data: profile completion, Next Best Action, Recommendation Readiness + live recommendation results, saved items, applications, an active Discovery Session, and important dates — i.e. essentially every element Section 07 of the brief lists (A–I). Rebuilding a parallel "Career Studio" page would create exactly the "second, drifting copy" this codebase's own NW03.3 docblock explicitly warned against. NW05.4 therefore keeps this redirect and documents the mapping rather than rebuilding anything — see `NW05_04_CAREER_WORKSPACE.md`.

## 5. Abroad-specific profile data — scope decision

The brief lists candidate Abroad Readiness categories including language-test planning, budget planning, and document planning, and explicitly cautions these are "candidate fields, not authorisation to create unnecessary new database columns." Schema inspection confirms none of target-countries / intended-study-level / language-test-status / document-readiness exist today. Per the brief's own "reuse existing schema first" and "do not overengineer unnecessary new systems" instructions, NW05.5's Abroad Readiness is built entirely from data that already exists:

- Academic information → the shared profile completion signal (same as Career).
- Destination preference / programme shortlist → real saved universities/courses whose `countryName` matches one of the six launch countries (`EUROPE_COUNTRIES`, joined via `getUniversitiesByIds`/`getCoursesByIds` — the exact pattern `/dashboard` and `/saved` already use).
- Budget planning → the existing, already-collected `budgetBand` field (generic, not Abroad-specific, but real).
- Language-test planning and document readiness → **honestly marked informational/not-yet-tracked**, the same pattern `journey-progress.ts` already uses for its own "Decide" stage, rather than fabricated or backed by fields that don't exist.

A richer Abroad-specific onboarding (target countries, intake, language test status) is flagged as a credible NW06+ candidate in `NW05_DATABASE_CHANGE_PLAN.md`, not half-built here.

## 6. Files reviewed (non-exhaustive, the load-bearing ones)

`middleware.ts`, `src/lib/supabase/middleware.ts`, `src/lib/products/entitlements.ts` (+ test), `src/lib/supabase/pricing/{checkout,my-purchases}.ts`, `src/app/(site)/pricing/checkout/actions.ts`, `supabase/migrations/{0005,0007,0013,0016,0017}_*.sql`, `src/lib/supabase/profile-provenance.ts`, `src/lib/supabase/recommendation-readiness.ts`, `src/lib/supabase/student-profile-actions.ts`, `src/types/profile-provenance.ts`, `src/lib/dashboard/{journey-progress,next-best-action,important-dates}.ts`, `src/lib/supabase/education/{saved-items,applications,universities,courses}.ts`, `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardShell.tsx`, `src/app/studio/{layout,page,career/page,abroad/page}.tsx`, `src/app/(site)/saved/page.tsx`.

## 7. Decisions carried into implementation

1. Fix entitlements to check invoice status (NW05.6) — zero schema change, pure application-logic fix + tests.
2. Propose (not apply) one narrow migration for provenance self-downgrade (NW05.3).
3. Reuse `/dashboard` as the Career Workspace unchanged (NW05.4) — no new route, no duplicate implementation.
4. Build Abroad Readiness from existing signals only; document richer Abroad onboarding as future, proposed-only schema (NW05.5, NW05_DATABASE_CHANGE_PLAN.md).
5. No payment/checkout code is touched. No destructive or applied migration. No commit/push (also structurally impossible here, see §0).
