# Milestone 11 File Manifest

Every file created or modified for Milestone 11 (structured plan inclusions, presentation/comparison fields, the
redesigned `/pricing` page, the `--brand-*` visual-identity token system, and light-touch invoice PDF accents),
organized by category. Paths are repo-relative from `/home/claude/careerpath-ai`. See `PRICING-BRAND-INSTALL.md` for
the database install steps and `docs/nextwise-pricing-offers-guide.md` §15 for the full architecture writeup.

## Database

**Created**
- `supabase/migrations/0008_pricing_inclusions_and_presentation.sql` — `pricing_plan_inclusions` table + RLS, 10 new
  presentation columns on `pricing_plan_versions`, extended immutability trigger, 3 new snapshot columns on
  `pricing_purchases`, extended `purchase_pricing_plan()`, security re-review, manual verification queries.
- `supabase/seed/0005_pricing_inclusions_seed.sql` — idempotent seed loading verbatim inclusions/limits for all 9
  plans as a new draft version, then publishing it and archiving the prior version. No price changes.

**Left unchanged (by design)**
- `supabase/migrations/0001_profiles.sql` through `0007_nextwise_pricing_offers.sql` — never altered, per this
  repo's migration convention.
- `supabase/seed/0001_careers_seed.sql` through `0004_pricing_offers_seed.sql` — never altered.

## Types

**Modified**
- `src/types/pricing.ts` — 10 new fields on `PricingPlanVersion`; new `PricingInclusion`, `PricingInclusionSnapshot`,
  `PricingPresentationLimitsSnapshot` interfaces; `inclusions` added to `PricingPlanWithVersion`; 3 new snapshot
  fields on `PricingPurchase`.
- `src/types/database.ts` — 10 new snake_case columns on `PricingPlanVersionsRow`; new `PricingPlanInclusionsRow`
  type; 3 new columns on `PricingPurchasesRow`; `pricing_plan_inclusions` added to the `Tables` map.

## Lib — pure logic & data access

**Created**
- `src/lib/pricing/official-catalog.ts` — pure fixture data (all 9 plans' prices/session counts/limits) used only as
  a regression-test source of truth; not read by runtime code.
- `src/lib/pricing/official-catalog.test.ts` — Vitest coverage for all 9 prices/minor units, Indian-formatted
  display strings, session counts, category groupings, counsellor-tier/mock-interview presence rules.

**Modified**
- `src/lib/pricing/plan-versions.ts` — added `sortInclusionsByDisplayOrder`, `activeInclusions`,
  `visibleInclusionsInOrder`, `highlightedInclusions`, `PricingComparisonRow`, `buildComparisonRow`,
  `formatComparisonCell`.
- `src/lib/pricing/plan-versions.test.ts` — extended with fixtures and test suites for all of the above.
- `src/lib/supabase/pricing/public-plans.ts` — added `InclusionRow`, `toPricingInclusion()`,
  `fetchInclusionsByVersion()`; extended version mapping with the 10 new fields; `listPublicPricingPlans()` and
  `getPublicPricingPlanBySlug()` now attach `inclusions` to each plan.
- `src/lib/supabase/pricing/my-purchases.ts` — added the 3 new snapshot columns to `PurchaseRow`, plus
  `toInclusionSnapshots()`/`toPresentationLimits()` mappers and their use in `toPurchase()`.
- `src/lib/supabase/admin/pricing.ts` — extended `PlanVersionInput`/`parsePlanVersionForm()` with the 10 new
  presentation fields; extended create/update version payloads; added the full inclusions CRUD/reorder surface
  (`listPricingInclusions`, `getPricingInclusionById`, `parseInclusionForm`, `requireDraftVersion`,
  `createPricingInclusion`, `updatePricingInclusion`, `deletePricingInclusion`, `reorderPricingInclusions`).
- `src/lib/payments/pdf.ts` — added `hexToPdfRgb()` and brand color constants; `drawHeader()` now draws a thin
  brand-accent rule; new `statusColor()` helper colors the invoice status label; line-items table header tint uses a
  brand tint. `sanitizeForPdf()`, `loadLogoBytes()`/`drawLogo()` untouched.

## Admin UI

**Created**
- `src/components/admin/pricing/PricingInclusionForm.tsx` — create/edit form for one inclusion.
- `src/components/admin/pricing/PricingInclusionsManager.tsx` — list with reorder (up/down), edit link, two-step
  confirm delete.
- `src/app/admin/pricing/[id]/versions/[versionId]/inclusions/new/page.tsx` — new-inclusion route (draft-only guard).
- `src/app/admin/pricing/[id]/versions/[versionId]/inclusions/[inclusionId]/page.tsx` — edit-inclusion route
  (draft-only + ownership guard).

**Modified**
- `src/app/admin/pricing/actions.ts` — added `createPricingInclusionAction`, `updatePricingInclusionAction`,
  `deletePricingInclusionAction` (non-redirecting, called imperatively), `reorderPricingInclusionsAction`.
- `src/app/admin/pricing/[id]/versions/[versionId]/page.tsx` — draft versions render the inclusions manager +
  presentation-settings form section; published/archived versions show the new read-only fields and the structured
  inclusions list alongside the legacy free-text list (relabeled "legacy").
- `src/components/admin/pricing/PricingPlanVersionForm.tsx` — added the "Presentation & comparison-table settings"
  form section (10 fields); relabeled the legacy included-services hint.

## Public UI

**Created**
- `src/components/sections/pricing/PricingTabs.tsx` — WAI-ARIA tabs (roving tabindex, arrow/Home/End key handling).
- `src/components/sections/pricing/ViewAllServicesDialog.tsx` — native `<dialog>` modal, focus-return to trigger.
- `src/components/sections/pricing/PricingComparisonTable.tsx` — accessible `<table>` (caption + scoped `<th>`s),
  not a div-grid.
- `src/app/(site)/pricing/loading.tsx` — route-level loading skeleton.
- `src/app/(site)/pricing/error.tsx` — client error boundary, never shows raw error detail.

**Modified**
- `src/app/(site)/pricing/page.tsx` — full redesign: 3 tabs (School Guidance / Bachelor Abroad / Master Abroad),
  editorial hero copy, mandatory-terms section (verbatim 6 bullets), per-tab comparison table when >1 plan.
- `src/app/(site)/pricing/checkout/[slug]/page.tsx` — order summary now shows session count and the structured
  inclusions list (falling back to legacy/neutral copy).
- `src/components/sections/pricing/PublicPricingPlanCard.tsx` — added stats block (session count, audience, limits),
  Recommended badge restyled with Star icon, structured "What's included" list (first 5 + "View all services"
  dialog) with legacy/neutral fallback, added a second "Book a free consultation" CTA alongside "Choose package".
- `src/components/sections/home/PricingPreview.tsx` — passes the new `inclusions` prop through to the plan card.

## Visual identity

**Modified**
- `src/app/globals.css` — added the documented `--brand-*` token block (REAL and PROVISIONAL, each labeled);
  existing `--color-*` tokens aliased to `var(--brand-*)`; `--color-accent`/`-dark`/`-light` deliberately left
  un-aliased (contrast reasoning documented inline); `:focus-visible` repointed at `--brand-focus`.

**Created**
- `src/config/brand-tokens.test.ts` — asserts every required `--brand-*` token is declared, every non-REAL token is
  labeled PROVISIONAL, `:focus-visible` uses `--brand-focus`, and `--color-accent` is never aliased.

**Explicitly not touched**
- No logo files under `public/` were replaced, redrawn, or recolored.

## Tests (brand-safety regression guard)

**Modified**
- `src/config/site.test.ts` — added 5 new pricing-related files to
  `FILES_THAT_MUST_NOT_MENTION_THE_OLD_BRAND`.

## Documentation

**Modified**
- `docs/nextwise-pricing-offers-guide.md` — appended "## 15. Milestone 11 — Inclusions, presentation settings, and
  the NextWise visual identity" (architecture decisions, immutability layer, purchase-snapshot extension, admin UI,
  public page redesign, visual identity, testing + manual SQL verification appendix); added a callout after the
  existing §14 "Known limitations" list noting which limitations Milestone 11 resolves; updated the table of
  contents.
- `README.md` — added a Milestone 11 bullet to the top milestone list; added migration `0008`/seed `0005` steps to
  the database-setup numbered list and the "Pricing & Offers setup" section; added the two new admin inclusion
  routes to the routes table; updated the Milestone 10 "What's real" bullet and added a new Milestone 11 "What's
  real" bullet; extended "## Design notes" with a `--brand-*` token paragraph.

**Created**
- `PRICING-BRAND-INSTALL.md` — exact install steps (run migration 0008, run seed 0005, verification SQL, rollback
  notes, brand-token change process).
- `MANIFEST.md` — this file.

## Everything else in the repository

Not modified. In particular: no changes to `.env.local` or `.env.example`, no changes to any file under
`public/` (logo assets untouched), no changes to `supabase/migrations/0001`–`0007`, no changes to
`supabase/seed/0001`–`0004`, no new pricing route (the redesign reuses the existing `/pricing` and
`/pricing/checkout/[slug]` routes), and no changes to the payment/webhook/refund code paths in
`src/lib/payments/` beyond the documented `pdf.ts` color additions.
