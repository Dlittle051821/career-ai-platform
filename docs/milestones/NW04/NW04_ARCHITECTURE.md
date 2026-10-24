# NW04 Architecture — Public Website & Premium User Experience

## 1. Summary

NW04 is a presentation-layer milestone built on top of NW03's two-product architecture (`/career`, `/abroad`, `/studio`). It adds no new routes, no new database access, and no new business logic — every change is new or restructured UI composed from existing data sources and existing links. The two structural additions are a shared in-product sub-navigation component (`ProductSubNav`) and a shared header dropdown component (`NavDropdown`), both built once and reused rather than duplicated per surface.

## 2. New components

```
src/components/sections/home/ProductEntryCards.tsx   — homepage: 2 equal product entry cards
src/components/sections/home/StudioIntro.tsx         — homepage: Student Studio intro + illustrative preview
src/components/sections/ProductSubNav.tsx             — shared in-product tab row (used by /career and /abroad)
src/components/navigation/NavDropdown.tsx             — shared header dropdown (used by Products/Resources/About)
```

`ProductSubNav` and `NavDropdown` are each built once and consumed from multiple call sites, rather than copy-pasted per page — the same "build the primitive once" discipline this codebase has used since NW01 (e.g. `ComingSoon`/`DemoNotice`, `active-nav.ts`).

## 3. Modified components/pages

```
src/app/(site)/page.tsx            — renders the two new homepage sections
src/app/(site)/career/page.tsx     — ProductSubNav, 5th link card, hero copy
src/app/(site)/abroad/page.tsx     — ProductSubNav, flag emoji, hero copy, "Nextwise Abroad" rename
src/components/navigation/Header.tsx    — Products/For Students/Resources/About desktop IA
src/components/navigation/MobileNav.tsx — mirrors the desktop IA for the mobile drawer
src/components/navigation/ExploreMenu.tsx — thin wrapper around NavDropdown, relabelled "Resources"
src/config/site.ts                  — "Nextwise Abroad" label rename (PRODUCT_NAV, FOOTER_NAV)
src/app/studio/page.tsx             — "Nextwise Abroad" rename (hub card heading)
src/app/studio/abroad/page.tsx      — "Nextwise Abroad" rename (title, h1)
src/components/dashboard/DashboardShell.tsx — docblock rename only (non-user-facing)
src/app/sitemap.ts                  — added /career, /abroad static entries
```

## 4. Data flow — unchanged

No NW04 component fetches new data or calls a new Supabase query. `ProductEntryCards`/`StudioIntro`/`ProductSubNav`/`NavDropdown` are all pure presentational components over data that already existed:

- `PRODUCT_NAV`, `PRIMARY_NAV`, `EXPLORE_NAV`, `FOOTER_NAV` — pre-existing config arrays in `src/config/site.ts` (NW04 only edited two label strings; the arrays' shape and the rest of their contents are untouched).
- `EUROPE_COUNTRIES` (`src/data/europe-explorer.ts`) — the NW02 six-country registry, reused directly by `/abroad`'s flag map.
- Every href in every new/changed component points at a pre-existing route.

## 5. Dependency graph (new/changed only)

```
src/app/(site)/page.tsx
 ├─ ProductEntryCards.tsx ──uses──> homepage-layout.ts, motion.ts (pre-existing)
 └─ StudioIntro.tsx ────────uses──> homepage-layout.ts, motion.ts (pre-existing)

src/app/(site)/career/page.tsx ──uses──> ProductSubNav.tsx
src/app/(site)/abroad/page.tsx ──uses──> ProductSubNav.tsx, europe-explorer.ts (EUROPE_COUNTRIES, EuropeCountryCode)

src/components/navigation/Header.tsx ──uses──> NavDropdown.tsx, ExploreMenu.tsx, site.ts (PRODUCT_NAV, PRIMARY_NAV)
src/components/navigation/MobileNav.tsx ──uses──> site.ts (PRODUCT_NAV, PRIMARY_NAV, EXPLORE_NAV)
src/components/navigation/ExploreMenu.tsx ──uses──> NavDropdown.tsx, site.ts (EXPLORE_NAV)
```

## 6. Architectural decisions and why

1. **`HomeHero.tsx` was never edited.** It is the most test-pinned file in the codebase (4 regression test files assert its exact hrefs/labels). The brief's "two equal product entry points" and "Student Studio intro" requirements are satisfied by two new, additive sections placed beneath it instead. See `NW04_01_UX_AUDIT.md` §1.
2. **`NavDropdown` extracted from `ExploreMenu`'s own prior implementation**, not reimplemented three times. One reviewed keyboard/ARIA disclosure pattern now backs three menus (Products, Resources, About) instead of three separate, independently-reviewable implementations.
3. **`ProductSubNav` is a server component**, not a client-side tab widget — `activeHref` is passed statically per page (always known at the page level) rather than derived from `usePathname()`, avoiding unnecessary client JavaScript for something that never needs to react to in-page navigation.
4. **The Abroad flag map is typed against `EuropeCountryCode`**, not a fresh string union — a `Record<EuropeCountryCode, string>` cannot compile if `EUROPE_COUNTRIES` ever gains or loses a country without the flag map being updated to match, a structural guarantee against silent drift.
5. **Mobile keeps `PRODUCT_NAV` and `PRIMARY_NAV` flat** rather than mirroring desktop's dropdown consolidation — dropdowns exist to relieve horizontal space pressure that a vertical mobile drawer doesn't have; adding one there would cost taps for no benefit. See `NW04_05_NAVIGATION_CONVERSION.md` §2.4.
6. **No Footer.tsx redesign**, despite a real, measured color-contrast defect found in it during NW04.6 — it's a shared, pre-existing, sitewide component outside this milestone's "homepage + two product pages + nav" scope, and fixing it correctly requires a cross-cutting design-token review the brief's own execution protocol asks NW04 not to turn into ("do not turn NW04 into NW05/NW06"). Disclosed, not silently dropped — see `NW04_06_ACCESSIBILITY_SEO_PERFORMANCE.md` §3.

## 7. What NW04 explicitly did not touch

- `/studio`, `/studio/career`, `/studio/abroad`'s underlying data/auth architecture (NW05's stated scope).
- Any payment, checkout, pricing, or Razorpay-related code.
- Any Supabase schema, RLS policy, or migration.
- `HomeHero.tsx`, `HomeFinalCTA.tsx` (only read, for the performance-audit root-cause analysis in NW04.6 — never edited).
- `PricingCategoryFilter.tsx`'s own, unrelated "Study Abroad" pricing-category label.
