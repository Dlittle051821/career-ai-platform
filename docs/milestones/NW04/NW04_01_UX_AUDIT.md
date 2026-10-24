# NW04.1 — Public UX Audit

Status: **COMPLETE**

This audit was conducted before any NW04 implementation work, to establish what already exists, what the brief's 7 stages actually need to change, and — per the brief's own anti-fabrication rule — which parts of the attached mockup must NOT be reproduced literally. It covers the public homepage, the Career Intelligence and Nextwise Abroad product pages, the header/mobile navigation, and SEO/indexability baseline. NW04.6 covers the deeper accessibility/SEO/performance pass; this section only records the baseline this audit found, used to scope that later stage.

## 1. Homepage inventory (pre-NW04)

`src/app/(site)/page.tsx` rendered, in order: `HomeHero`, `DiscoveryPillars`, `TrustedStudyExplorer`, `HowItWorks`, `WhyNextwise`, `HomeFinalCTA`. All six are asserted by name in `homepage-source-audit.test.ts`'s `SECTION_FILES` allowlist, and `HomeHero.tsx` specifically is further pinned by exact href/label strings across four separate test files (`orbit-journey-audit.test.ts`, `homepage-source-audit.test.ts`, `premium-refinement-audit.test.ts`, `hero-composition-audit.test.ts`) — it has its own prior iteration history (UX10A → H07 → EU02) and is treated as the most regression-sensitive file on the homepage.

**Finding:** the brief asks for a premium homepage with "two equal product entry points" and a "Student Studio" introduction section (AC-01, AC-02). `HomeHero`'s existing CTAs point at `/career-discovery` and `/study-europe` (pre-product-architecture routes, predating NW03) — rewriting them to point at `/career`/`/abroad` would touch all four of the above test files on a component that is deliberately the least-touched file in the codebase.

**Decision:** leave `HomeHero.tsx` byte-for-byte unchanged. Add two new, additive sections directly beneath it — `ProductEntryCards.tsx` (the two-product entry point) and `StudioIntro.tsx` (the Student Studio introduction) — which satisfy AC-01/AC-02 without touching `SECTION_FILES` or any hero-pinned test. Verified empirically: `npx vitest run src/lib/home` (88/88) passed unchanged after both new sections were added and wired into `page.tsx`.

## 2. Mockup anti-fabrication check

The attached mockup's center-panel "My Workspace" panel shows a named student ("Aarav Sharma") and specific saved-item counts. The brief is explicit: "DO NOT copy fictional student information, fabricated account metrics, unsupported claims, or mock feature availability into the real website."

**Finding/Decision:** `StudioIntro.tsx`'s Studio preview deliberately shows two generic, unlabelled workspace tiles (Career Workspace / Abroad Workspace) with no name and no counts, plus an explicit caption — "Illustrative preview — your own Studio fills in with your real saved items once you create an account" — so a visitor cannot mistake the preview for real data. This is the same discipline already established elsewhere in this codebase (`journey-progress.ts`, `europe-explorer.ts`, the NW03 `/studio/abroad` `ComingSoon`/`DemoNotice` pattern) and is now applied to the new homepage section too.

## 3. Career Intelligence (`/career`) and Nextwise Abroad (`/abroad`) — pre-NW04 state

Both pages already existed from NW03.2 as additive front doors — `/career` linking out to existing Career surfaces (career discovery, careers, courses) and `/abroad` linking out to the existing `/study-europe` six-country explorer. Neither had an in-product sub-navigation row (the mockup's right panel shows one for Abroad: Overview/Destinations/Programs/Universities/Guidance/Resources), and neither page's hero copy matched the mockup's framing.

**Decision (NW04.3/NW04.4):** build one reusable `ProductSubNav` component (server component, no client hooks — `activeHref` passed statically per page) rather than two bespoke sticky-tab implementations, and use it on both pages. Update hero copy/eyebrow on both pages to match the brief's framing while keeping every underlying link target unchanged. For Abroad, add a purely decorative Unicode flag emoji next to each of the six countries sourced from the existing `EUROPE_COUNTRIES` registry (`src/data/europe-explorer.ts`) — never a re-typed or expanded country list, so the page cannot silently drift from the NW02 six-country launch allowlist (Germany, Ireland, Netherlands, France, Sweden, Denmark).

## 4. Header/mobile navigation — pre-NW04 state

`Header.tsx` rendered: Home → flat `PRODUCT_NAV` row (Career Intelligence, Study Abroad) → `ExploreMenu` ("Explore," a bespoke dropdown with its own open/close/ARIA implementation) → flat `PRIMARY_NAV` row (How It Works, Counselling, Pricing, About). `MobileNav.tsx` mirrored this with an expandable "Explore" section.

The brief's target desktop IA is `Logo | Products | For Students | Resources | About | [search] | Sign in | Get Started` — a more consolidated structure than the pre-NW04 flat layout.

**Findings that made this safe to restructure:**
- Grepped every `*.test.ts` file for `ExploreMenu`, `EXPLORE_NAV`, `PRIMARY_NAV`, `PRODUCT_NAV`, and `FOOTER_NAV` — zero matches. None of this nav config or its rendering components is under test-pinned regression protection (unlike `HomeHero.tsx`).
- `ExploreMenu.tsx`'s existing dropdown implementation (outside-click/Escape/route-change close, `aria-haspopup`/`aria-expanded`, `role="menu"`/`role="menuitem"`) was already a reviewed, working pattern — worth generalizing rather than reimplementing twice more for the new Products and About menus.

**Decision (NW04.5):** extract that implementation into a generic `NavDropdown` component; convert `ExploreMenu` into a thin wrapper around it (and rename its visible label "Explore" → "Resources"); restructure `Header.tsx` into Home → Products (dropdown) → For Students (plain link to `/studio`) → Resources (dropdown) → About (dropdown, wrapping the four `PRIMARY_NAV` entries). Full detail and verification in `NW04_05_NAVIGATION_CONVERSION.md`.

## 5. Product-naming consistency

**Finding:** the Abroad product was labelled "Study Abroad" in six user-facing places (nav, footer, two page titles, one page heading, one dashboard heading) despite the NW03-established product name being "Nextwise Abroad," and the mockup uses "Nextwise Abroad" exclusively. A seventh match, in `PricingCategoryFilter.tsx`, is a distinct, pre-existing pricing-category concept (`plan.category` being `bachelor_abroad`/`master_abroad`) unrelated to the product name and was confirmed out of scope.

**Decision:** rename the six product-name occurrences to "Nextwise Abroad," leave the pricing-category label untouched. Detail in `NW04_05_NAVIGATION_CONVERSION.md` §2.5.

## 6. SEO/indexability baseline

Checked `src/app/sitemap.ts`, `src/app/robots.ts`, and `src/app/(site)/layout.tsx` directly (not from memory) before scoping NW04.6:

- The site-wide blanket `robots: { index: false, follow: false }` that existed during a prior milestone (M17A Steps 1–5) was already removed in M17A Step 6, after an independent per-route-category noindex audit. Public pages under `src/app/(site)` carry no `robots` field of their own, so they inherit Next.js/Google's implicit `index: true, follow: true` default already — this is a pre-existing, already-released state, not something NW04 needs to fix.
- `/career` and `/abroad` each declare their own `alternates: { canonical: "/career" }` / `{ canonical: "/abroad" }` and no `robots` override — both are indexable and canonical-tagged as-is.
- `sitemap.ts`'s static entries do not yet include `/career`, `/abroad`, or `/studio` (the last correctly, since `/studio` is authenticated). This is a real gap for NW04.6 to close for `/career` and `/abroad`.

## 7. Accessibility conventions baseline

The codebase's existing disclosure pattern (now generalized into `NavDropdown`) already implements `aria-haspopup`/`aria-expanded`/`role="menu"`/`role="menuitem"` and keyboard Escape-to-close. `ProductSubNav` uses a plain `<nav aria-label="Product sections">` with `aria-current="page"` on the active tab, consistent with the active-nav pattern used elsewhere. No new heading-hierarchy, landmark, or contrast issues were introduced by the additive sections built in NW04.2–NW04.4; the full accessibility pass (contrast, reduced-motion, 200% zoom, focus order) is NW04.6's job, not re-litigated here.

## 8. Scope boundary

Per the brief's explicit instruction, this audit and the stages that follow it do not rebuild `/studio`, `/studio/career`, or `/studio/abroad`'s underlying architecture (NW05's job), do not touch payment/checkout logic, and do not perform any schema or Supabase change.
