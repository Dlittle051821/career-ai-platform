# NW08.7 · 09 · QA report

Run on 1 November 2026. Code: `release/m10` at `f52c750` plus the NW08.7 files (uncommitted). It was run in a cloud working copy proven equivalent to `C:\carrier.ai`: the same commit, a byte-identical `package.json` and `package-lock.json`, and the same untracked Supabase fixture files, giving the same 2,405-test baseline.

## Summary

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **Pass**, 0 errors |
| Lint (new code) | `npx eslint src/app/motion-lab src/components/motion-lab src/lib/motion-lab` | **Pass**, 0 problems |
| Motion Lab tests | `npx vitest run src/lib/motion-lab` | **61/61 pass** |
| Full suite | `npm test` | **2,466/2,466 pass**, 145 files (baseline 2,405 / 144) |
| Production build | `npm run build` | **Pass**. The four lab routes compile and are prerendered as 404s. |
| Production isolation | `next start` + curl | **Pass**. See `NW087_08_BROWSER_TESTING.md`. |
| Browser checks | Playwright, 5 viewports | **Pass**. 0 console errors, 0 overflow, reduced motion 12/12, reversibility 6/6, no scroll trap, CLS ≤ 0.0003, keyboard clean |
| Homepage unchanged | Source audit and test | **Pass**. `src/app/(site)/page.tsx` and all existing files untouched, except one line in `vitest.config.mts` |

## New tests (`src/lib/motion-lab/motion-lab.test.ts`, 61)

| Group | What it proves |
|---|---|
| Route protection | Guard is false in production and for an empty `NODE_ENV`; every lab page calls `isMotionLabEnabled()` then `notFound()`; noindex is always set; no prototype title is exposed when disabled; `motion-lab` appears nowhere in sitemap, robots, `site.ts` or the homepage |
| Navigation and content preservation | `MAIN_NAV` is still the six items, in order; every lab entry point is derived from it; destinations are exactly the six approved countries; the lab header uses the shared `MAIN_NAV` and `Logo`; no digits appear in story copy; three concepts with four-beat storyboards |
| Story maths | Four stages in the brief's order tile 0–1; stage lookup and clamping; easings stay in 0–1 with no overshoot; **captions never overlap** (500 sampled points); scrubber position maths |
| Choreography data | Every timeline window across the three concepts lies within 0–1 and runs forwards; fold angles alternate; recentring maths; B's panels open in order; C's beams stagger in order and the frame fades before the step-through ends |
| Reduced motion and performance audits | Static path exists and is wired to both the media query and `?motion=reduced`; invisible captions use `visibility`; sticky pinning with no wheel/touch interception or `preventDefault`; no state setters in motion-value handlers; no gsap, three, R3F or lottie imports |

## Constraints checklist

| Brief constraint | Status |
|---|---|
| Three working, scroll-controlled, reversible prototypes | Done |
| Routes `/motion-lab`, `/motion-lab/living-path`, `/unfolding-future`, `/window-to-tomorrow` | Done |
| Inaccessible in production via a server-side guard | Done and verified (404) |
| Working controls, restart, dev-only scrubber | Done (`DevScrubber`) |
| Reduced-motion alternative | Done and verified |
| Story stages in order | Done and tested |
| Palette; plum used sparingly | Done |
| Six-item navigation, URLs and SEO preserved | Done and tested; no existing file touched |
| Only the six destinations; no invented statistics | Done and tested |
| 375 / 390 / 768 / 1024 / 1440, no overflow, no scroll trap, no CLS, keyboard, reduced motion | Done and verified |
| Transform and opacity only; no per-frame React state; no heavy libraries | Done and tested |
| Homepage not changed; no commit, push, deploy, env or migration changes | Confirmed |

## Known limitations

1. Testing was headless Chromium only, with no Safari, Firefox or real devices.
2. Concept C drops frames at 1440px under software compositing. It needs a real-GPU check.
3. No Lighthouse scores, by design (the lab is 404 in production).
4. Concept B's object is not visible until hydration. This avoids a layout shift, but its first paint is caption-only.
5. Scroll length (520svh, and 560svh for C) is a prototype choice and needs user review.
