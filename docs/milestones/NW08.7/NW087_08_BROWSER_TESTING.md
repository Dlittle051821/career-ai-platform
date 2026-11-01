# NW08.7 · 08 · Browser-testing evidence

All evidence here is **real browser output**: frames and videos captured by Playwright driving Chromium (build 1194) against the prototypes running under `next dev`. None of it is an AI-generated mockup. The capture scripts scroll the real page to exact story-progress values and wait for the spring to settle. The development scrubber and the Next.js dev overlay are hidden in the captured frames only.

Environment: Linux cloud container, headless Chromium, no GPU, device scale factor 1. Safari, Firefox and real phones were **not** tested (see "Not covered").

## Viewports

| Width | Height used | Represents |
|---|---|---|
| 375 | 667 | iPhone SE class |
| 390 | 844 | iPhone 12–15 class |
| 768 | 1024 | Tablet portrait |
| 1024 | 768 | Tablet landscape / small laptop |
| 1440 | 900 | Desktop |

## Files in `evidence/`

| Path | Contents |
|---|---|
| `living-path-contact-sheet.jpg`, `unfolding-future-contact-sheet.jpg`, `window-to-tomorrow-contact-sheet.jpg` | One sheet per concept. Rows are the five viewports; columns are progress 0, 0.15, 0.35, 0.60, 0.85 and 1.00. |
| `frames/<concept>-<width>-pNNN.jpg` | The 90 individual frames behind the sheets (3 concepts × 5 viewports × 6 points) |
| `frames/<concept>-1440-focus-skip.jpg` | Keyboard focus on "Skip to the paths" |
| `reduced/` | Full-page reduced-motion captures: `-query` (`?motion=reduced`) at 1440, and `-media` (emulated OS preference) at 390 and 1440 |
| `gallery/gallery-390.jpg`, `gallery-1440.jpg` | The `/motion-lab` comparison gallery, full page |
| `video/<concept>-1280.webm`, `video/<concept>-390.webm` | Screen recordings of each concept scrolled forward from start to finish, then **backwards** to the midpoint, at 1280×800 and 390×844. Plays in any browser. |
| `qa-results.json` | Machine-readable results of every automated browser check below |

## Automated browser checks (final run)

| Check | Scope | Result |
|---|---|---|
| Console errors and warnings | Every page load in the run (frames, gallery, reduced, behaviour, keyboard) | **0** |
| Horizontal overflow | 3 concepts × 5 viewports × 6 progress points, plus each page end, plus the gallery at 390 and 1440 | **None** |
| Reduced motion | 3 concepts × {390, 1440} × {query flag, OS preference} | **12/12** rendered the static view and no animated section |
| Reversibility | Captions at progress 0.10, 0.35 and 0.62 going forward, then again after scrolling back from 0.90 | **6/6** identical, with exactly one headline visible each time |
| Scroll trapping | Continuous mouse-wheel scroll from the top | **6/6** reached "Explore the paths ahead" |
| Layout shift | Load plus full scroll | max **0.0003** |
| Keyboard | 30 Tab presses from load at 1440 | **0** invisible focus targets, **0** stops without a focus indicator, skip link works **3/3** |
| Production isolation | `next build` + `next start`, curl | All five Motion Lab URLs return **404**; their responses contain no lab or concept names; sitemap.xml and robots.txt contain no `motion-lab`; `/`, `/abroad`, `/career` and `/how-it-works` return 200 |

The production check needed the two public Supabase variables to be present for the *existing* middleware to start. Placeholder values (`https://placeholder.invalid`, `placeholder-not-a-key`) were set in the shell for that one build only. No file was changed and no real key was used.

## Issues found by these checks and fixed

| Found | Fix |
|---|---|
| Reduced mode threw a Motion error (`useScroll` target not rendered) | Scroll hooks mounted only in the animated branch |
| B: CLS 0.034 on phones (axis switch after hydration) | Object invisible until hydrated |
| C at 1440: one reversibility mismatch | Caused by the spring not having settled before sampling; re-verified with a longer settle time (the motion itself is a pure function of progress) |
| C at 1440: dropped frames | Shadow spread reduced, opacity layers promoted (see `NW087_06_PERFORMANCE.md`) |
| Production 404 page still carried the concept name in `<title>` | Page and layout metadata made conditional on the guard; a test now enforces this |
| Gallery headings rendered blue and bold (site-wide `h1–h4` rule) | Explicit heading colour and family |
| Earlier visual rounds | See `NW087_03_DESIGN_DECISIONS.md` ("Iterations made from captured frames") |

## Not covered

- Real iOS Safari, Android Chrome, desktop Safari and Firefox. Run `npm run dev -- -H 0.0.0.0` and open the lab from a phone on the same network (see the install guide).
- GPU-accelerated frame timing, Lighthouse, and manual screen-reader passes.
