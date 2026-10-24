# NW03 — Two-Product Architecture: Consolidated Architecture Reference

**Milestone:** NW03
**Status:** Complete (all 6 stages delivered)
**Companion documents:** `NW03_01_AUDIT.md` · `NW03_02_ROUTES.md` · `NW03_03_STUDENT_JOURNEYS.md` · `NW03_04_AUTH_ENTITLEMENTS.md` · `NW03_05_INTEGRATION.md` · `NW03_06_QA_REPORT.md` · `NW03_COMPLETION_REPORT.md`

## 1. One-paragraph summary

Nextwise ships one brand and one Supabase Auth account, now exposing two independent, fully-functional-on-their-own product journeys — **Career Intelligence** and **Study Abroad** — each with its own public landing page and its own authenticated workspace. A signed-in student reaches either workspace through a shared `/studio` hub. Entitlement (which plans a student has purchased) is read server-side from the existing `pricing_purchases`/`pricing_plans` tables and shown only informationally; it never gates either product's free functionality. Zero database migrations were needed — the entire product split is expressed in routing, one new pure module, and two small, targeted edits to existing files.

## 2. Route map (post-NW03)

```
PUBLIC (no auth)                              AUTHENTICATED (/studio/*, PROTECTED_PATHS)
─────────────────                              ──────────────────────────────────────────
/                     (existing, unchanged)    /studio               — hub: choose a product
/career               (NEW, NW03.2)            /studio/career        — redirect() -> /dashboard
  -> /career-discovery, /careers, /courses,    /studio/abroad        — NEW honest foundation workspace
     /book-counselling, /abroad                  -> links to /study-europe, /courses
/abroad               (NEW, NW03.2)
  -> /study-europe, /courses, /study-options,  /dashboard            (existing, unchanged — the real
     /book-counselling, /career                                        Career Intelligence workspace)
/study-europe         (existing NW02, reused)  /profile, /recommendations, /saved, /applications,
/careers, /courses,                             /payments, /agreements, /discovery-session, /welcome
/universities, /study-options                  (all existing, unchanged)
(existing, unchanged)
```

Five new routes total: `/career`, `/abroad`, `/studio`, `/studio/career`, `/studio/abroad`. Zero existing routes removed, renamed, or had their path changed.

## 3. Root layouts (five, independent, confirmed)

| Layout | Routes | Chrome |
|---|---|---|
| `src/app/(site)/layout.tsx` | `/`, `/career`, `/abroad`, `/careers`, `/courses`, `/study-europe`, … | Public Header/Footer |
| `src/app/admin/layout.tsx` | `/admin/*` | AdminShell |
| `src/app/dashboard/layout.tsx` | `/dashboard` | DashboardShell |
| `src/app/profile/layout.tsx` + `src/app/recommendations/layout.tsx` | `/profile`, `/recommendations` | DashboardShell (shared component, independent layouts) |
| `src/app/studio/layout.tsx` **(new, NW03.3)** | `/studio`, `/studio/career`, `/studio/abroad` | DashboardShell (shared component, independent layout) |

This codebase has no single global root layout — each top-level route owns its own `<html>`/`<body>`. NW03.3 followed this exact, already-four-times-repeated pattern rather than introducing a new one.

## 4. Auth/redirect flow (post-NW03.3 fix)

```
/register?next=/studio/abroad          /login?next=/studio/abroad
         │                                      │
         ▼                                      ▼
RegisterForm: safeNext =               LoginForm: router.push(
  getSafeRedirectPath(next,              getSafeRedirectPath(next,
  "/welcome")                             await resolveMyDefaultWorkspace())
         │                                      │
  ┌──────┴───────┐                              │
  session ready?  no -> emailRedirectTo=         │
  │               /auth/callback?next=<safeNext> │
  yes                    │                       │
  │                      ▼                       │
  router.push(safeNext)  auth/callback: already  │
  │                       uses getSafeRedirectPath│
  └──────────────┬────────────────────────────────┘
                 ▼
         lands on /studio/abroad directly
         (or /welcome / resolveMyDefaultWorkspace()
          when no explicit `next` was supplied —
          unchanged pre-NW03 behavior)
```

Every redirect decision in this flow routes through exactly one shared validator, `getSafeRedirectPath()` — no second, hand-rolled check was added anywhere in NW03.

## 5. Entitlement data flow

```
pricing_purchases (existing table, RLS: auth.uid() = student_user_id)
        │  listMyPurchases()  (existing, unchanged)
        ▼
PricingPurchase[]  (each has planId | null)
        │
        │  distinct planIds
        ▼
pricing_plans (existing table, RLS: "Anyone can read...")
        │  select id, category
        ▼
Map<planId, PricingCategory>
        │
        ▼
classifyPurchaseEntitlements(purchases, categoryMap)   <- PURE, unit-tested
        │
        ▼
ProductEntitlements { hasCareerEntitlement, hasAbroadEntitlement, careerPurchases, abroadPurchases }
        │
        ▼
/studio hub — "Active plan" badge only, never a gate on either workspace link
```

`getMyProductEntitlements()` (`src/lib/products/entitlements.ts`) is the single I/O entry point; `classifyPurchaseEntitlements()` is the pure function it delegates to, following this codebase's established pure-function/I/O-component split.

## 6. New files introduced by NW03

| File | Purpose |
|---|---|
| `src/app/(site)/career/page.tsx` | Career Intelligence public landing page |
| `src/app/(site)/abroad/page.tsx` | Study Abroad public landing page |
| `src/app/studio/layout.tsx` | Fifth independent root layout, shares DashboardShell |
| `src/app/studio/page.tsx` | Shared hub — choose a product; shows entitlement badges |
| `src/app/studio/career/page.tsx` | `redirect("/dashboard")` |
| `src/app/studio/abroad/page.tsx` | Abroad workspace foundation (real links + honest `ComingSoon`/`DemoNotice`) |
| `src/lib/products/entitlements.ts` | Pure classifier + I/O wrapper for product entitlements |
| `src/lib/products/entitlements.test.ts` | Unit tests for the pure classifier |
| `src/lib/auth/nw03-studio-reference-audit.test.ts` | Source-text regression/security audit for all of the above |

## 7. Existing files edited by NW03 (and exactly what changed)

| File | Change |
|---|---|
| `src/config/site.ts` | Added `PRODUCT_NAV` constant; added a "Products" group to `FOOTER_NAV`. No existing export removed or renamed. |
| `src/components/navigation/Header.tsx` | Renders `PRODUCT_NAV` (2 links) using the exact existing active-link styling. |
| `src/components/navigation/MobileNav.tsx` | Renders `PRODUCT_NAV` (2 links) using the exact existing drawer-row styling. |
| `src/lib/supabase/middleware.ts` | Added `"/studio"` to `PROTECTED_PATHS` (one array entry). |
| `src/components/sections/auth/RegisterForm.tsx` | Post-signup redirect and `emailRedirectTo` now use `getSafeRedirectPath(next, "/welcome")` instead of a hardcoded `/welcome`. |
| `src/components/dashboard/DashboardShell.tsx` | Added one `NAV_ITEMS` entry ("Studio" → `/studio`), inserted first. |
| `vitest.config.mts` | Added one new `include` glob for `src/lib/products/**/*.test.ts`. |

Thirteen files total (9 new, 7 edited — `vitest.config.mts` and the test files overlap the "new" count above). No file outside this list was touched by NW03.

## 8. Explicit non-goals (confirmed never touched)

Payment/checkout code, admin routes, Supabase migrations, RLS policies, the `admin_roles` authorization model, the homepage (`/`) composition, `/welcome`'s own content, and any NW06–NW10 functionality.
