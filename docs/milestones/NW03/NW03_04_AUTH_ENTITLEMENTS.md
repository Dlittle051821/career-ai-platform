# NW03.4 — Shared Auth, Profile & Entitlement Foundation

**Milestone:** NW03 "Two-Product Architecture"
**Stage:** 4 of 6
**Depends on:** NW03.1 (no hard dependency on NW03.2/NW03.3 — consumed by the `/studio` hub they built)

## 1. Auth/profile foundation — confirmed unchanged

Per NW03.1 section 5, this codebase already has exactly one Supabase Auth account, one `profiles` row, and one `student_profiles` row per student — there is no per-product account or profile to "found." NW03.4 therefore adds no new auth table, no new profile field, and no migration. The two concrete auth-adjacent fixes the brief's "shared auth foundation" goal actually required were both completed in NW03.3: the `RegisterForm.tsx` `next`-param fix (AC-04) and adding `/studio` to `middleware.ts`'s `PROTECTED_PATHS`.

## 2. Entitlement module

New file: `src/lib/products/entitlements.ts`.

Built entirely on the existing `PricingCategory` enum (`src/types/pricing.ts`) and the existing `listMyPurchases()` read (`src/lib/supabase/pricing/my-purchases.ts`, already RLS-scoped to `auth.uid()`). Zero new tables, zero migrations.

- `CAREER_PRICING_CATEGORIES` = `school_counselling`, `class_11_counselling`, `class_12_counselling`.
- `ABROAD_PRICING_CATEGORIES` = `bachelor_abroad`, `master_abroad`.
- `productForCategory(category)` — pure, exhaustive mapping.
- `classifyPurchaseEntitlements(purchases, categoryByPlanId)` — pure classifier. A purchase with a null `planId` (a legacy/manually-recorded purchase) or a `planId` not present in the lookup is excluded from both products rather than guessed, matching this codebase's "never fabricate a signal" discipline.
- `getMyProductEntitlements()` — the I/O wrapper. Calls `listMyPurchases()`, then reads `id, category` from `pricing_plans` (readable by anyone per that table's own existing "Anyone can read..." RLS policy — the same policy `listPublicPricingPlans()` already relies on) for the distinct plan ids involved, then calls the pure classifier. Never throws; returns the all-false/empty shape for a logged-out visitor or a student with no purchases.

### 2.1 Server-enforced, never client-state

`getMyProductEntitlements()` re-derives its answer from `pricing_purchases` on every call. Nothing about it is cached in a cookie, a JWT claim, or `localStorage` that a visitor could forge to claim an entitlement they don't have. This is what "server-enforced, never client-state-only" means in this implementation.

### 2.2 Informational only — never a gate

Per the brief's AC-04, this module is deliberately never used to gate access to either product's free functionality. The only consumer added in this stage is `/studio` (`src/app/studio/page.tsx`), which shows an "Active plan" badge next to whichever product(s) the student has purchased into — both "Open workspace" links remain fully functional regardless of entitlement status. No route, component, or Server Action in this codebase checks `hasCareerEntitlement`/`hasAbroadEntitlement` before allowing access to anything.

## 3. Tests

`src/lib/products/entitlements.test.ts` (new) — covers the pure classifier only, following this codebase's "pure, framework-free business logic is unit-tested directly; the Supabase-calling I/O wrapper is not" convention used throughout `vitest.config.mts`. Cases covered: empty input, a career-only purchase, an abroad-only purchase, a student holding both (confirming no cross-contamination between the two lists), a null-`planId` purchase (never guessed), an unknown-`planId` purchase (never guessed), and an exhaustiveness check that `CAREER_PRICING_CATEGORIES`/`ABROAD_PRICING_CATEGORIES` partition all five `PRICING_CATEGORIES` values with no overlap and nothing missing.

`vitest.config.mts`'s `include` list gained one new glob, `"src/lib/products/**/*.test.ts"`, so this new test file is actually picked up by `npx vitest run` (the existing list is an explicit per-directory allowlist, not a catch-all).

## 4. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged) |
| `npx vitest run` | 128 test files (+1), 2101 tests (+10), all passed |
| `npm run build` | succeeded; no route regression |

## 5. What NW03.4 explicitly did not do

- Did not add a new database table, column, or migration.
- Did not gate any route, page, or feature behind an entitlement check.
- Did not change the auth model, `profiles` schema, or `admin_roles`.
- Did not touch payment/checkout logic (`/pricing/checkout`, the Razorpay webhook, or the known GST-inclusive bug) — entitlements only *read* `pricing_purchases` after a purchase is already recorded by the existing, untouched payment path.
