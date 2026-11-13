# CIUX-01B: Testing evidence

## Set-up

- Both builds ran side by side in a Linux container, using production builds (`next build` + `next start`) and a local disposable Supabase stack. No QA or production project was used.
  - Before: CIUX-01 at `b15c162`, port 3031.
  - After: CIUX-01B, port 3032.
- The owner's Finish script repeats the static checks on Windows before the local commit.
- The scripts are in the delivery package (`evidence/`): `cap.cjs`, `interact.cjs`, `homecmp.cjs`, `matrix.cjs`, `hit.cjs`, `perf.cjs`.

## Automated suites

| Check | Result |
|---|---|
| Vitest, full suite | **184 files, 3157 passed, 1 skipped, 0 failed** |
| New: `header-geometry.test.ts` | Inline pre-paint script equals `headerGeometry()` at 24 viewports, 360 × 640 to 3840 × 2160. Mode rule equals the homepage's `stageModeFor`. The constants match the homepage engine's source. |
| New: `ciux01b-global-header.test.ts` | The homepage renders `SiteHeader`. The layout renders the header once. No page imports a header. No other public `<header>` exists. `v54.css` no longer styles the header. One `NAV_GROUPS` source. The six heroes use `PageHero` with no own `<h1>` and no old backdrop images. Explorer and compare pages open with the hero. How It Works copy and routes. Display face and reduced motion. |
| New: `active-nav-resolve.test.ts` | One active place for 11 routes, including nested ones |
| TypeScript | 0 errors |
| ESLint | 0 errors, 6 warnings (all pre-existing `<img>`; 18 before, the removed heroes accounted for the rest) |
| Production build | Succeeds |

## D. Visual comparison (1440 × 900 and iPhone 13; the same viewports before and after)

Images are in `compare/` in the package.

- **Homepage against How It Works:** `home-vs-how-it-works-before-1440.png` and `home-vs-how-it-works-after-1440.png`.
- **Every in-scope page, before and after:** `<page>-before-after-1440.png` for How It Works, Abroad, Study in Europe, Careers, Universities, Courses, Pricing, Contact, About, Parents, Trust, Book counselling, Career discovery and Privacy.
- **Phones:** `mobile-before-390.png` and `mobile-after-390.png` (home, How It Works, Abroad, Pricing, Contact, menu open).
- **Navigation states:** `nav-hover-*.png` and `nav-dropdown-*.png` (homepage on top, How It Works below).
- **Raw captures:** `before/` and `after/`.

### Header geometry and typography

Measured from the DOM on 15 pages at 1440 px and 5 pages at 390 px. Tolerance: 1 px.

| | Homepage | Every other page, before | Every other page, after |
|---|---|---|---|
| Header box (1440) | 40, 24, 1360 × 86 | 0, 0, 1440 × 73 | **40, 24, 1360 × 86** |
| Corner radius | 30 px | 0 | **30 px** |
| Logo box | 84, 49, height 36 | 92, 19, height 34 | **84, 49, height 36** |
| Nav item | 14.5 px Jakarta, 30 px pill | 14.5 px, 40 px link | **14.5 px Jakarta, 30 px pill** |
| Primary header button | Sign up, 38 px, #FF4D6D | Sign up, 40 px | **Sign up, 38 px, #FF4D6D** |
| Header box (390) | 53, 11, 285 × 48 | 0, 0, 390 × 73 | **53, 11, 285 × 48** |
| Hero headline | Space Grotesk 68 px | Jakarta 49.6 / Sora 52 px | **Space Grotesk 64 px** (46 px compact) |

Result: **0 geometry mismatches over 1 px across 20 page and viewport combinations**.

- The navigation capsule's x position varies by 1–3 px only where a section is active, because the active label is bold. That is the intended active state.
- The coral hover pill was checked by computed style on the homepage, How It Works, Careers and Pricing: `::before` is rgb(255, 77, 109) at opacity 1.

## E. Navigation interaction (`interact.cjs`): 99 of 99 passed

| Area | What was checked |
|---|---|
| Desktop: homepage, How It Works, Careers, Pricing | Enter opens. Panel inside the viewport. Arrow Down moves into the panel. Arrow, Home and End never scroll the page or move chapters. Escape closes and focus returns. Outside click closes. Hover opens. A click right after hover keeps it open. The pointer travelling from trigger into panel keeps it open. Leaving closes. Coral hover pill. Exactly one visible header. |
| Scroll state | Transparent 86 px at the top; frosted white at 60 px once scrolled. The headline starts below the header. |
| Route to route | Client-side navigation homepage → How It Works → Abroad → Careers → Pricing → Contact. Header box, logo and nav within 1 px of the homepage at every step. Menus closed after each navigation. |
| Active state | `/careers/ai-engineer`: Explore. `/courses/compare`: Free tools only. `/how-it-works`: How it works. `/pricing`: Pricing. `/study-europe`: Explore. `/privacy`: none. |
| Touch (1180 × 820 with touch) | Tap opens a menu; tapping a link navigates. |
| Phones: homepage, How It Works, Abroad, Pricing (iPhone 13) | One header with homepage geometry. Menu opens. Every target ≥ 44 px. Free session first. No overflow. Escape closes and focus returns. A link navigates and the menu closes. |
| Reduced motion | Hero entrance off; header transitions off. |
| Errors | No client errors or React hydration warnings on any page visited (production build) |
| Development mode | `next dev` without `.env.local` (the Finish script's default review mode): 23 public routes respond 200, with **0 React hydration warnings**. The header geometry script sets attributes on `<html>` before hydration by design; `<html>` therefore carries `suppressHydrationWarning`, which covers that element's own attributes only. Data lists show their empty or error states, because no database is configured in that mode. |

Earlier runs found two real issues, both fixed and re-tested:

- **Two sections active at once on `/courses/compare`.** The fix is `resolveActiveNavHref`, which picks the most specific link.
- **A menu that stayed open while a slow page loaded.** Panels now close as soon as a link is chosen.

### Target size (`hit.cjs`, hit-tested with `elementFromPoint`)

The header follows the homepage stage down to 0.62 scale on small landscape screens. In CIUX-01 the homepage pills were 19 px tall there. Hit areas are now enlarged without changing anything drawn.

| Viewport | Logo | Nav pill | Log in | Sign up |
|---|---|---|---|---|
| 768 × 800 | 30.5 px | 25.5 px | 30 px | 32 px |
| 1024 × 768 | 35 px | 29.5 px | 34.5 px | 36.5 px |
| 1440 × 900 | 48.5 px | 40.5 px | 48.5 px | 50.5 px |

All are at least 24 px (WCAG 2.2 target size, AA).

## F. Homepage regression (`homecmp.cjs`)

Method: CIUX-01 against CIUX-01B, reduced motion, 8 scroll positions, desktop 1440 × 900 and iPhone 13. **The header is not masked.**

| Viewport | Frames | Pixels differing (> 8/255) | Max delta | Page height | Story DOM (header removed) |
|---|---|---|---|---|---|
| Desktop | 8 | 0 in every frame | 1/255 | 12114 = 12114 | 59309 = 59309 |
| iPhone 13 | 8 | 0 in every frame | 0 | 10613 = 10613 | 58296 = 58296 |

- The homepage, its header included, is pixel-identical to CIUX-01 even though the header is now the global component.
- No engine file changed. The N intro, chapters, Career Intelligence and Study Abroad scenes, CTAs and storytelling are untouched; only `v54.css`'s header block moved.
- The open menu and hover states differ only by a slightly different panel shadow and one description line wrapping one word earlier (`nav-dropdown-*`, `nav-hover-*`).

## Responsive and accessibility (`matrix.cjs`)

25 routes (including `/careers/ai-engineer` and `/abroad`) × 360, 390, 768, 1024 and 1440 px = 125 checks per build. axe-core rules: wcag2a, wcag2aa, wcag21aa and wcag22aa, at 390 and 1440 px.

| | Before | After |
|---|---|---|
| Horizontal overflow | 0 | 0 |
| axe violations | 0 | 0 |
| Route responses | All 200 (404 page 404) | All 200 (404 page 404) |

## Performance (`perf.cjs`)

Median of 3 loads, local production builds, gzip sizes.

| Page | Device | LCP ms | CLS | JS KB | CSS KB |
|---|---|---|---|---|---|
| `/` | desktop | 620 → 552 | 0.128 → 0.127 | 238.0 → 235.1 | 32.5 → 34.3 |
| `/how-it-works` | desktop | 436 → **184** | 0.0034 → **0** | 236.8 → 241.5 | 32.5 → 34.3 |
| `/careers` | desktop | 464 → **248** | 0.0034 → **0** | 244.4 → 241.5 | 32.5 → 34.3 |
| `/abroad` | desktop | 188 → 188 | 0.0034 → 0 | 236.8 → 233.8 | 32.5 → 34.3 |
| `/pricing` | desktop | 496 → 588 | 0.0034 → 0 | 239.6 → 244.4 | 32.5 → 34.3 |
| `/universities` | desktop | 168 → 244 | 0.0034 → 0 | 238.9 → 234.9 | 32.5 → 34.3 |
| `/how-it-works` | mobile | 304 → **164** | 0 → 0 | 236.8 → 240.4 | 32.5 → 34.3 |
| `/careers` | mobile | 472 → **256** | 0 → 0 | 235.7 → 232.8 | 32.5 → 34.3 |
| `/pricing` | mobile | 480 → 204 | 0 → 0 | 239.6 → 236.7 | 32.5 → 34.3 |

Reading:

- Internal pages no longer shift at all (CLS 0).
- Pages that had the photo hero load their largest element much sooner, because the backdrop, cut-out and annotation images are gone.
- JS changes within ±5 KB; CSS grows by 1.8 KB.
- Small LCP differences on text-only heroes are local-machine noise.
- Space Grotesk is now loaded site-wide. It is the same font file the homepage already used.

## Not done here

- Real-device testing (iOS Safari, Android Chrome) and screen-reader passes (VoiceOver, NVDA): recommended during the offline review.
- Signed-in header states were checked in code and unit tests only. The browser runs were signed out, to avoid creating accounts.

## Final navigation correction: Home (2026-11-13)

**`home-nav.cjs`: 45 of 45 passed**

| Area | Result |
|---|---|
| Desktop order | Home, Explore, Free tools, How it works, Pricing. Home is active on `/`, and is the only active item there. |
| Flows | Homepage → How It Works → Home. Study Abroad → Home. Pricing → Home. Logo → Home (from Contact). Browser Back and Forward work. |
| Home hover | The same coral pill (rgb 255, 77, 109; opacity 1; 0.2 s timing) |
| Keyboard | Tab from the logo lands on Home. The focus pill shows the navy ring. Enter goes home. |
| Capsule clearance | Clear of the logo and account actions (≥ 12 px) at 768 × 800, 1024 × 768, 1280 × 720, 1366 × 768, 1440 × 900 and 1920 × 1080, on `/` and `/how-it-works` |
| Phones (360, 390 px) | Home is the first destination in the menu. The row is ≥ 44 px. Its active state is correct. No overflow. Home in the phone menu goes home. |
| Errors | None |

**Regression**
- **Interaction suite:** 99 of 99 passed.
- **Layout and accessibility:** no horizontal overflow in 125 checks (25 routes at 360, 390, 768, 1024 and 1440 px); axe found 0 violations.
- **Hit areas:** still at least 24 px.
- **Homepage story:** identical to the approved CIUX-01B in 16 of 16 frames. Only the header strip was masked, because it now holds the Home item; page height and story markup are identical.
- **Hydration:** 0 warnings in development mode with a fresh browser, across 13 routes.

**Gates**
- **Vitest:** 184 files, 3160 passed, 1 skipped.
- **TypeScript:** 0 errors.
- **ESLint:** 0 errors, 6 pre-existing warnings.
- **Production build:** passes.
