# NW04.7 — Automated Tests, QA & Validation Gate

Status: **COMPLETE**

## 1. New regression test coverage

Added `src/lib/navigation/nw04-public-website-audit.test.ts` — a static source-text audit, following this codebase's established convention (`src/lib/auth/nw03-studio-reference-audit.test.ts`, `src/lib/navigation/mobile-nav-reference-audit.test.ts`): no React Testing Library/jsdom, every assertion reads real component/config source as text. Picked up automatically by the existing `"src/lib/navigation/**/*.test.ts"` glob in `vitest.config.mts` — no config change needed.

21 tests across 7 groups:

1. **Homepage wiring** — `ProductEntryCards`/`StudioIntro` render after `HomeHero` in the right order; `HomeHero.tsx`'s own CTAs are provably untouched; both product cards link out with equal weight and no "recommended" markup; `StudioIntro` never reproduces the mockup's fabricated name/counts in its actual rendered output (comments are stripped before this check, so the docblock explaining *why* those strings are excluded can't produce a false pass); the contrast fix (`text-secondary-dark`) is asserted directly.
2. **Product sub-navigation** — `/career` and `/abroad` both import the one shared `ProductSubNav`; the Abroad flag map is keyed off the real `EuropeCountryCode` type and the real `EUROPE_COUNTRIES` registry, never a re-typed list; `/career`'s new recommendations link is real.
3. **Nav-IA restructuring** — `Header.tsx`'s rendered order is exactly Home → Products → For Students → Resources → About; "For Students" points at the real `/studio`; `ExploreMenu`'s visible label changed to "Resources" while still rendering the unchanged `EXPLORE_NAV` data; exactly two `NavDropdown` instances render in `Header.tsx` (Products + About — Resources goes through `ExploreMenu`'s own wrapper around the same component); `MobileNav` keeps every pre-NW04 destination and adds "For Students"; no `href` was dropped from `site.ts` during the restructuring.
4. **Product-naming rename** — every product-facing "Study Abroad" occurrence is now "Nextwise Abroad" in all 4 renamed files; the unrelated pricing-category label is confirmed still untouched.
5. **Sitemap/SEO** — `/career` and `/abroad` are present in `sitemap.ts`; `/studio` is correctly absent (authenticated); the 6-country Abroad allowlist is unchanged.
6. **Safe-redirect preservation** — `RegisterForm.tsx` still uses `getSafeRedirectPath`, not a hardcoded `/welcome`; the new `StudioIntro` CTA exercises `?next=/studio` rather than a bare `/register`.

## 2. Full validation gate

Run after every substantive NW04 change, and again as the final gate for this stage:

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | **Clean — 0 errors** |
| Unit/regression tests | `npx vitest run` | **130 test files, 2136 tests — all passing** (up from the pre-NW04 baseline of 129 files / 2115 tests — the +21 delta is exactly this stage's new audit file) |
| Lint | `npm run lint` | **0 errors, 18 warnings** — all 18 are pre-existing `@next/next/no-img-element` warnings in files NW04 never touched (hero/CTA sections using plain `<img>`); none introduced by this milestone |
| Production build | `npm run build` | **Succeeds** — every route compiles, including `/`, `/career`, `/abroad`, `/studio`, `/studio/abroad`, `/studio/career` |

No test was removed, skipped, or weakened to reach this result — the full pre-NW04 suite (2115 tests) still passes unchanged, plus 21 new ones.

## 3. What NW04.7 did not need to add

- No new Supabase/RLS/migration-security test was needed — NW04 made no schema, RLS, or migration change (prohibited by the brief and not attempted).
- No payment/checkout test was needed — NW04 made no payment-provider or checkout-flow change (prohibited by the brief and not attempted).
- No new React-rendering test harness was introduced — this codebase has never used React Testing Library/jsdom (documented repeatedly in `vitest.config.mts`'s own comments), and NW04 follows that same established convention rather than introducing a new one for one milestone.

## 4. Known, honestly-disclosed nonblocking issues (carried from NW04.6)

- Homepage Lighthouse performance score (0.80) is below the 0.90 target, root-caused to pre-existing missing hero/CTA image assets in `HomeHero.tsx`/`HomeFinalCTA.tsx` (both files NW04 deliberately left untouched). `/career` and `/abroad` meet the 0.90 target.
- 26 pre-existing `color-contrast` findings in the shared `Footer`, `SectionHeading`/`PageHero` eyebrow treatment, `CTASection`, and `Badge tone="accent"` components, present across many pages sitewide before NW04 and not introduced by it. The one contrast defect NW04 itself introduced (`StudioIntro`'s eyebrow) was found and fixed in NW04.6.

Full detail on both in `NW04_06_ACCESSIBILITY_SEO_PERFORMANCE.md`.
