# NEXTWISE UI/UX BASELINE V5.6.3 (canonical)

**Selected by the founder on 14 November 2026 as the one approved visual baseline for the whole website.**
This supersedes every older visual baseline wherever they conflict. It does not weaken any security
control, and it does not discard later approved backend, security or legal fixes.

| | |
|---|---|
| Version name | NEXTWISE UI/UX BASELINE V5.6.3 |
| Canonical commit | `893d816543f92b6538ee5037991a858d1231bcb5` |
| Source branch | `feature/v563-career-intelligence-refinement` |
| Protected tag | `nextwise-ui-v563-approved` (annotated, points to `893d816`) |
| Reference deployment | https://nextwise-world-58p81wrss-nextwise.vercel.app/ |
| Vercel deployment id | `AUjzMD4XB3AjPBJXyhB8HH8yqKPq` (Preview; source `feature/v563-career-intelligence-refinement` @ `893d816`; verified in the Vercel dashboard on 14 Nov 2026) |
| Parent | `3f8c59d` (`preview/v562-approved`, V5.6.2 Two Pathways on CIUX-01B + Home) |

> The reference deployment is a **Preview**. It was built with Preview environment variables (QA
> Supabase), so it must **never** be promoted or given the public domain. Its only role is to show
> the approved look. Vercel deletes Preview deployments after 30 days on this project; the reference
> images and video in `docs/ui-reference/` and `tests/visual/__baseline__/` stay valid without it.

## 1. What the baseline contains (all preserved exactly)

| Element | Where it lives | Locked by |
|---|---|---|
| Official pink-arrow Nextwise logo (Master Logo v2) on every logo surface, plus favicons and app icons | `src/lib/brand/master-logo.ts`, `public/brand/master-v2/`, `public/brand/nextwise-icon-*.png`, `src/app/{favicon.ico,icon.png,apple-icon.png}`, owner sources in `docs/brand/master-v2-source/` | manifest (brand-and-logo), `v563-baseline.test.ts` › branding |
| Global site header with Home first: Home, Explore, Free tools, How it works, Pricing; Log in, Sign up | `src/components/navigation/*`, `src/styles/site-header.css`, `src/lib/navigation/`, `src/config/site.ts` | manifest, navigation tests, visual `nav-01-menu-open` |
| Responsive desktop and phone navigation (Home first in the phone menu) | `NavMenus.tsx`, `MobileNav.tsx`, `MobileNavGroups.tsx` | manifest, navigation tests, visual `nav-01` at 768 and 390 |
| Automatic homepage opening animation | `src/components/sections/home/v54/V54Motion.tsx`, `src/lib/home/v54/engine.ts` | manifest, visual `home-01-intro-n-1200ms` |
| Original locked animated N (cyan N artwork and engine) | `public/brand/nextwise-icon.png`, `src/lib/home/v4/engine.ts`, `src/lib/home/v54/*` | manifest, CC-24 hash pins, visual `home-01` |
| Two Pathways (Dreamscape Binoculars, Journey Ticket, coral transition) | `src/components/sections/home/v562/`, `src/lib/home/v562/`, `public/home-v562/` | manifest, approved-baseline test, visual `home-03` |
| Career Intelligence heading and N alignment | `src/components/sections/home/v54/NextwiseV54Home.tsx`, `v563/career-intelligence.css` | manifest, visual `home-04` |
| Robotics & Autonomous Systems Engineer showcase; Climate & Energy and Space Systems tabs | `src/components/sections/home/v563/CareerPreview.tsx`, `src/lib/home/v563/career-preview.ts` | manifest, showcase-order test, visual `home-04/05/06` |
| Typography and brand colours | `src/lib/fonts.ts`, tokens in `src/app/globals.css` and `v54.css` | manifest (94 tokens), every visual checkpoint |
| Shared page-hero design language | `src/components/sections/PageHero.tsx`, `src/styles/page-hero.css` | manifest, visual `page-01`, `page-02` |
| Approved routes | the 22 public routes listed in `v563-baseline.test.ts` | route tests |
| Official contacts | `src/config/contact.ts`: founder@nextwise.com, co-founder@nextwise.com, +91 7205 7204 37, www.nextwise.world | contact tests |

Not part of the visual baseline, and not changed by it: database, authentication, payments, AI,
legal texts and the server-side release controls. Those keep their own gates (§6).

## 2. Rules

1. **Never recreate** the N animation, the logo or any locked asset from screenshots or video.
   The source files are the baseline.
2. **Never replace** an approved component with an older version, and never merge an older
   baseline (anything before `893d816`, including live production `a1017b9`) over this one.
3. **Do not modify** the official logo assets or the animation assets.
4. Shared branding, the header and the homepage change **only** through an owner-approved baseline
   change (`docs/UI-UX-DEVELOPMENT-PROTOCOL.md` §6), never as a side effect of page work.

## 3. Enforcement

| Check | Command | Runs |
|---|---|---|
| Locked files (238) and brand tokens (94) byte-identical; navigation order and destinations; Master Logo v2 references; homepage scenes; showcase order; 22 routes; contacts; no legacy homepage | `npm run verify:baseline` | CI (every push and pull request), and inside `npm test` |
| Visual regression: 10 checkpoints × desktop 1440, tablet 768, phone 390 (30 reference images, including a strict header-only image) | `npm run build && npm run verify:visual` | CI (Linux Chromium) |
| Older guards still in force | `src/config/approved-baseline.test.ts`, `src/components/sections/cc24-*` | `npm test` |

Manifest: `src/config/ui-baseline/v563-manifest.json` (generator: `scripts/baseline/ui-baseline.mjs`).
Text files are hashed with CRLF normalised, so Windows and Linux checkouts agree.

**Proof that the lock works:**

| Commit | Result |
|---|---|
| `893d816` (canonical) | 238 files and 94 tokens match; 38/38 tests; visual 21/21 tests (30 images) |
| `e37220f` (`release/v563-production`, built in production mode) | 238 files and 94 tokens match; 38/38 tests; visual 21/21 tests (30 images) |
| `3f8c59d` (V5.6.2, older baseline) | **fails**: 26 locked items differ; visual fails 9 of 21 (Career Intelligence, header, pages) |
| `a1017b9` (live production) | **fails**: 118 locked items differ |

## 4. Visual regression method

- **Clock.** The pages run on Playwright's virtual clock, installed and **paused** before
  navigation (`clock.install` + `clock.pauseAt`). Fonts, images and hydration (`data-v54-ready`)
  complete before any virtual time passes. Each checkpoint is then a fixed point in time: the
  opening animation at 1.2 s, the hero at 6 s, each chapter 3 s after its gesture.
- **Chapters.** They are reached with one wheel gesture, the way visitors do. Key presses can't
  be used, because the chapter controller compares real event timestamps.
- **CSS.** CSS animations and transitions are settled or stopped (`animations: "disabled"`). The
  pointer rests in a fixed corner.
- **Tolerances.** They are per checkpoint: 0.1 % of pixels for pages, the header and menus, and
  0.5 % for the homepage scenes. Run-to-run noise on the canonical build, measured with zero
  tolerance over 3 runs, is reported in `docs/ui-reference/visual-calibration.md`. No mask is
  used.
- **Platform.** The images are rendered by Linux Chromium (the CI image). Run the suite in CI or
  Linux; Windows font rendering differs.

## 5. History

| Date | Change | Approved by |
|---|---|---|
| 14 Nov 2026 | V5.6.3 selected as the canonical UI/UX baseline (supersedes `3f8c59d` as the visual baseline) | Founder |
