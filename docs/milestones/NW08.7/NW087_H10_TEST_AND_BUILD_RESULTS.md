# NW08.7 · H10 · Test and build results

Run on 1 November 2026, at `release/m10` `e014164` ("Fix public SEO metadata and sitemap consistency") plus the uncommitted NW08.7 work. The run was in a cloud working copy proven equivalent to `C:\carrier.ai`: the same commit, a byte-identical `package.json` and lockfile, the same untracked Supabase fixtures, and byte-identical copies of the three files this milestone edits.

## Project checks (brief §15)

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **Pass**, 0 errors |
| Lint | `npm run lint` | **0 errors**, 18 warnings, all `@next/next/no-img-element` in existing files this milestone did not touch (`HomeHero.tsx`, `HomeFinalCTA.tsx`, `HowItWorksHero.tsx` and others). Every file this milestone touched lints clean. |
| Tests | `npx vitest run` | **2,518 passed, 147 files.** That is 2,408 at `e014164`, plus 61 Motion Lab tests and 49 signature-hero tests. **No existing test was changed.** |
| Build | `npm run build` (default: flag unset) | **Pass.** 101 static pages. `/homepage-preview` and the Motion Lab routes prerender as 404s. |
| Build | `NEXTWISE_HOMEPAGE_HERO=signature npm run build` | **Pass** |

## Production checks (`next build` + `next start`, curl)

| | Default build | Opted-in build |
|---|---|---|
| `/` | 200, **current hero** ("Know What's Next."), no signature markup | 200, **signature hero** in the server HTML (headline, both actions, `/career-discovery` link), **no dev bar** |
| `/homepage-preview` | 404; response contains no preview title and no hero text | 404 |
| `/motion-lab` | 404 | 404 |
| `/career-discovery`, `/study-europe`, `/career`, `/abroad` | 200 | 200 |
| `sitemap.xml` mentions `homepage-preview` or `motion-lab` | No | No |

## New tests: `src/lib/home/signature-hero/signature-hero.test.ts` (49)

| Group | Proves |
|---|---|
| Homepage integration (7) | The flag defaults to the current hero and only the exact value `signature` switches it. The flag is server-only and set nowhere. `page.tsx` keeps `HomeHero` as the default and the full section order. The homepage never receives dev controls. The preview is dev/test-only, `noindex`, mirrors the homepage's section order, and is linked from nowhere public. |
| Navigation and destinations (6) | The six-item `MAIN_NAV` is unchanged. Every hero and pathway link resolves to an existing route file. Pathway labels come from `MAIN_NAV` and the destination count from the registry. No digits in the copy. Photographs exist and are described as illustrative. The hero never references logo files. |
| Ribbon geometry (21) | Profile interpolation; arc-length resampling; shading (top surface vs underside); determinism. Per layout: front/back layer split and a real turn-over; the ribbon stays inside its board; thin-to-thick growth; a large closed lobe; **the portrait's face is never cut by the ribbon across the whole drift**; photographs always cover the lobe; pathway nodes sit on the opening line. Also, the two compositions are genuinely different. |
| Scroll mapping (7) | Six scenes tile 0–1 in order; all windows valid; story order holds and the portrait is held, not flashed; the reveal is monotonic from the resting line to complete; reversibility (pure functions); the front/back mask split has no gap; dev-bar scroll maths. |
| Reduced motion, fallback, performance (6) | The reduced branch shows the finished composition without pinning. The headline and actions are server markup, and the CSS reveal never hides text. Native scrolling only. No per-frame React state. No heavy libraries. Only the visible layout downloads photographs. |
| Registration prompt coexistence (3) | The hold reducer; the timed path waits while a hold is raised while the contextual path and eligibility are unchanged; the hero raises the hold only while on screen and always releases it. |
| Hygiene (1) | All component files exist as documented |

## Browser verification (brief §15): performed, headless Chromium

Raw results: `evidence/homepage/qa-results.json` and `reversibility.json`. Screenshots and videos: `evidence/homepage/`.

| Check | Scope | Result |
|---|---|---|
| Every scene at multiple scroll positions | 6 widths (375, 390, 768, 1024, 1280, 1440) × 9 progress points | 54 frames captured; contact sheets in `evidence/homepage/` |
| Forward and reverse scrolling | The same 54 points captured again in reverse order, then pixel-compared | 48 of 54 pairs differ in ≤ 0.175% of pixels (antialiasing). The 6 p = 0 pairs (one per width) show a uniform ~2px page offset, caused by the **existing header** changing height (72 → 64px) once the page has scrolled; it is not hero motion. |
| Console errors and warnings | All loads in the run | **0** |
| Horizontal overflow | All widths, all points, plus page end | **None** |
| Layout shift | Load plus full wheel scroll | 0.0001 (390), 0.0039 (1440) |
| Scroll trapping | Continuous mouse-wheel scroll from the top | Both widths reached "Choose where to start" |
| Keyboard | 16 Tab presses at 1440 and 390 | 0 hidden focus targets; a visible focus indicator on every stop |
| Reduced motion | OS preference emulated, at 1440 / 768 / 390 | Static composition, not pinned, pathways visible, no dev bar |
| Registration-prompt hold | Hold events recorded in the page | Hold raised while the hero is on screen |
| Image-mask seams, flicker, jitter, text wrapping | Visual review of all frames and both videos | One seam at the front/back layer join, and an exposed tail end, were found during development and fixed (clip blended under the front band; tail tapered and tucked). No flicker, jitter or bad wraps in the final frames. |
| Recording | 1280×800 and 390×844, forward through the story then back | `evidence/homepage/video/signature-hero-*.webm`: actual browser rendering, not generated animation |

**Not performed:** real iOS/Android devices, Safari, Firefox, and manual screen-reader passes (see H11).
