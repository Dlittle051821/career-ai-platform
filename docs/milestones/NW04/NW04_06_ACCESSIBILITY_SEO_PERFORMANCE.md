# NW04.6 — Responsive, Accessibility, SEO & Performance

Status: **COMPLETE WITH NONBLOCKING ISSUES DOCUMENTED**

All numbers in this document are real, measured results from a production build (`npm run build` + `npm run start`) running locally in this container, captured with Lighthouse CLI (Chromium headless) and Playwright. Per the brief's own instruction, nothing here is an estimate or a target restated as a result — targets (≥90 performance, ≥95 accessibility/best-practices/SEO) are quoted only for comparison against what was actually measured.

## 1. Responsive validation (375 / 390 / 768 / 1024 / 1440px)

Ran a full-page Playwright screenshot pass for `/`, `/career`, and `/abroad` at all five required viewport widths (15 screenshots total), plus targeted captures of the mobile nav drawer and each of the three new desktop dropdowns (Products, Resources, About).

**Method used to detect real layout bugs, not just "did it render":** at every viewport/page combination, `document.documentElement.scrollWidth` was compared against `clientWidth` — any positive difference means horizontal overflow, a genuine responsive defect (content wider than its viewport).

**Result: zero horizontal overflow at any of the 15 combinations.** All pages returned HTTP 200 and rendered without layout breakage at every target width.

Visual spot-checks (not just the overflow metric) confirmed:
- `ProductEntryCards` and `StudioIntro` (new homepage sections) stack correctly to a single column below `sm` and lay out as designed at `lg`.
- `ProductSubNav`'s sticky tab row scrolls horizontally without wrapping on narrow viewports, and sits correctly below the sticky header at both header heights (scrolled/unscrolled).
- The new `NavDropdown`-based Products/Resources/About menus open without overlapping the viewport edge or clipping at 1440px.
- The restructured mobile nav drawer renders Home → Career Intelligence → Nextwise Abroad → For Students → Resources (collapsed) → How It Works/Counselling/Pricing/About → Account → Get Started, matching the planned IA, at 390px.

## 2. SEO / indexability

- Confirmed (not assumed) that the site-wide blanket `robots: { index: false, follow: false }` that existed during a prior milestone was already removed (M17A Step 6, pre-NW04) after an independent per-route noindex audit — public pages are indexable by default today, and this was true before NW04 started.
- `/career` and `/abroad` both carry their own `alternates.canonical` and declare no `robots` override — both indexable, both canonical-tagged.
- **Gap found and fixed:** `src/app/sitemap.ts`'s static entries did not include `/career` or `/abroad`. Added both (`changeFrequency: "weekly"`, `priority: 0.8`, matching the other primary discovery entry points) — `/studio` correctly remains excluded, since it is authenticated.
- Lighthouse SEO category: **1.00 / 1.00 / 1.00** on `/`, `/career`, `/abroad` respectively (target: ≥0.95). All measured post-fix.

## 3. Accessibility

Lighthouse accessibility category (axe-core-based): **0.96 / 0.96 / 0.96** on `/`, `/career`, `/abroad` (target: ≥0.95 — met on all three).

The only failing audit on any of the three pages, on all three, is `color-contrast`. Breaking down what was actually found:

**Fixed during this stage (one genuine NW04-introduced regression):** `StudioIntro.tsx`'s "Student Studio" eyebrow label used `text-secondary` (`#0d7d6f`) on the section's `tone="muted"` background (`#f3efe7`) — measured contrast 4.38:1 against a 4.5:1 requirement. Changed to `text-secondary-dark` (`#0a5f54`), which measures 6.59:1 against the same background (verified with a WCAG relative-luminance calculation, not estimated). Re-measured after the fix: this element no longer appears in Lighthouse's contrast-failure list.

**Found, not fixed — pre-existing, outside NW04's scope:** the remaining contrast failures on all three pages trace to shared, pre-existing design-system components that predate NW04 and are used across dozens of pages sitewide, not introduced by this milestone's edits:
- `Footer.tsx`'s muted link/text color (`text-on-primary-muted`, `#aab4cc`) on the footer's `bg-primary` (`#2563eb`) background — measures 2.48:1. This affects every footer link on every page of the site (26 occurrences on the homepage alone), not specifically anything NW04 touched. NW04.5 only changed footer *label text* ("Study Abroad" → "Nextwise Abroad"), never this component's styling.
- The `SectionHeading`/`PageHero` "eyebrow" treatment (`text-secondary` on a muted/surface-alt background) — the same underlying pattern just fixed in `StudioIntro.tsx`, but present in the pre-existing `SectionHeading`/`PageHero` components themselves, which NW04.3/NW04.4 reused with new copy, not new styling. Flagged on `/career`'s and `/abroad`'s own eyebrows for this reason.
- `CTASection`'s primary button and `Badge tone="accent"` (the abroad page's pre-existing "Popular" country badge, unchanged by NW04.4) — both pre-existing components used unmodified.

**Why this was not fixed in NW04:** every one of these is a shared component's existing color-token choice, not a one-off string in a file NW04 owns. Fixing them correctly means auditing and adjusting a shared design token across every page that uses `Footer`, `SectionHeading`, `PageHero`, `CTASection`, or `Badge` — a cross-cutting design-system change well outside this stage's "two product pages + homepage + nav" scope, and exactly the kind of unrelated refactoring the brief's own execution protocol instructs against ("avoid unrelated refactoring... do not turn NW04 into NW05/NW06"). Recorded here as a real, measured, nonblocking finding for a dedicated future design-system accessibility pass, not silently left out of the report.

**Reduced motion / 200% zoom / landmarks:** the existing `motion-reduce:` convention (`src/lib/ui/motion.ts`) was confirmed to cover every animation used by the two new homepage sections (`FADE_UP_CLASSES`, `HOVER_LIFT_CLASSES`) — both pair their animated state with an explicit `motion-reduce:` override, consistent with the codebase's established pattern. No new landmark, heading-hierarchy, or focus-order issue was introduced: `ProductSubNav` uses a labelled `<nav>` with `aria-current="page"`; `NavDropdown` carries the same reviewed `aria-haspopup`/`aria-expanded`/`role="menu"` pattern `ExploreMenu` already used. Zoom-to-200% was not separately instrumented in this pass (no automated 200%-zoom checker was available); the responsive screenshots at 375px — narrower than most 200%-zoom reflow widths on a common desktop viewport — did not surface any clipped or overlapping content, which is a reasonable proxy but not a substitute for a dedicated zoom test.

## 4. Performance

Lighthouse performance category, measured against a local production server (no CDN, no real network latency — these numbers are directionally useful, not a substitute for a real hosted measurement):

| Page | Score | Target |
|---|---|---|
| `/` | **0.80** | ≥0.90 |
| `/career` | **0.90** | ≥0.90 |
| `/abroad` | **0.90** | ≥0.90 |

`/career` and `/abroad` meet the target. `/` does not, measured honestly rather than rounded up.

**Root cause, confirmed not assumed:** the homepage's Largest Contentful Paint (4.0s, scoring 0.50 on that sub-metric) and elevated Total Blocking Time are driven by `HomeHero.tsx` and `HomeFinalCTA.tsx` requesting several image assets that return HTTP 404 in this environment (`/hero/campus-sky-backdrop.png`, `/hero/nextwise-student-cutout.png`, `/hero/annotation-clearer-brighter.png`, `/hero/annotation-curiosity-global.png`, `/cta/final-cta-vista.png`) — confirmed via Lighthouse's own console-error audit and a direct grep of `HomeHero.tsx`, which already contains its own `existsSync()` fallback-detection logic for exactly this "asset not yet supplied" scenario (a pattern from an earlier milestone, not something NW04 added). **This is pre-existing and outside NW04's scope** — `HomeHero.tsx` and `HomeFinalCTA.tsx` were deliberately left untouched in NW04.2 (see `NW04_01_UX_AUDIT.md` §1), and no new image or asset reference was added by `ProductEntryCards.tsx` or `StudioIntro.tsx` (both are icon-only, using `lucide-react`, no `<img>`/`next/image` usage at all). Supplying the missing hero/CTA image assets is a content/asset task, not a code task, and fabricating a stock photo to fill the gap is explicitly against this project's standing rules.

## 5. Acceptance criteria addressed

- **AC-11** (responsive validation at 375/390/768/1024/1440px) — met: zero overflow across all 15 page/viewport combinations, screenshots captured as evidence.
- **AC-12** (accessibility, WCAG 2.2 AA target) — met at the Lighthouse-measured level (≥0.95 on all three pages); the one NW04-introduced contrast defect was found and fixed, and all remaining findings are honestly disclosed as pre-existing and out of scope rather than omitted.
- **AC-10** (SEO/indexability) — met: sitemap gap for `/career`/`/abroad` closed; SEO category scores 1.00 on all three pages.
- Performance target is **not fully met on `/`** (0.80 vs ≥0.90) for a documented, pre-existing, non-NW04 reason. `/career` and `/abroad` meet target. This is reported as a nonblocking issue per the brief's own COMPLETE WITH NONBLOCKING ISSUES category, not inflated to COMPLETE.
