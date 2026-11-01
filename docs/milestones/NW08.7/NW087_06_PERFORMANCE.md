# NW08.7 · 06 · Performance

## What was measured, and how

All numbers below were measured by automated headless Chromium (Playwright, Chromium 1194) against `next dev` in a Linux cloud container **with no GPU**, so compositing was done in software. Development mode is unminified and runs extra checks. Treat these numbers as a *relative* comparison between the three concepts and as a regression baseline. They are not a prediction of real-device performance.

**No Lighthouse scores were measured.** Lighthouse needs a production build, and the Motion Lab returns 404 in production by design. Lighthouse should be run when the chosen concept is moved to a staging route (see `NW087_10_RECOMMENDATION.md`).

Raw data: `evidence/qa-results.json`.

## Engineering constraints (met)

| Constraint | How |
|---|---|
| Transform and opacity only | Every animated property is `transform` (translate/scale/rotate), `opacity`, SVG `pathLength` (drawn as stroke-dash on the GPU-friendly SVG path) or `visibility` toggled at a threshold. No width, height, top/left, filter or colour is animated. |
| No per-frame React state | Values flow from `useScroll` → `useSpring` → `useTransform` straight to styles. React renders once. A test fails if a `useMotionValueEvent` handler calls a state setter. |
| No heavy libraries | No new dependencies. A test fails on any import of gsap, three, `@react-three/*` or lottie. |
| No scroll-jacking | CSS `position: sticky` only. A test fails on wheel/touchmove listeners or `preventDefault`. |
| No CLS | Layout is reserved up front (fixed-height sticky stage, caption box with min-height, aspect-ratio frames). |

## Layout shift (CLS)

Measured with a `PerformanceObserver` (`layout-shift`, buffered) from page load through a full wheel scroll of the story.

| Concept | 390px | 1440px |
|---|---|---|
| A · Living Path | 0.0003 | 0 |
| B · Unfolding Future | 0.0003 | 0 |
| C · Window to Tomorrow | 0.0003 | 0 |

The good threshold is 0.1. An earlier build of B measured **0.034** on phones: the fold axis (horizontal or vertical) depends on a media query the server cannot know, so the server rendered the horizontal layout and the client then switched. This was fixed by keeping B's object invisible until hydration (`useHydrated`), so nothing visible shifts.

## Frame timing during a continuous wheel scroll

`requestAnimationFrame` intervals while scrolling the whole story with the mouse wheel. 16.7 ms is 60 fps.

| Concept | Width | Frames | Median | p95 | Frames > 50 ms |
|---|---|---|---|---|---|
| A · Living Path | 390 | 148 | 16.7 | 16.7 | 0 |
| A · Living Path | 1440 | 144 | 16.7 | 33.4 | 0 |
| B · Unfolding Future | 390 | 160 | 16.7 | 16.7 | 0 |
| B · Unfolding Future | 1440 | 160 | 16.7 | 16.8 | 0 |
| C · Window to Tomorrow | 390 | 170 | 16.7 | 16.7 | 0 |
| C · Window to Tomorrow | 1440 | 135 | 16.7 | 50.1 | 7 |

### Concept C at desktop width

C is the only concept with dropped frames in this environment. Investigation, by disabling layers one at a time:
- The photograph is not the cost: holding it still made no difference.
- The cost comes from the large full-screen layers that software compositing has to blend every frame: the wall (a box-shadow spread) and the radial-gradient light layers. Disabling the shadow roughly halved slow-frame time; disabling the radial gradients removed about half of the remainder.

Mitigations applied: the shadow spread was cut from 220vmax to 90vmax (still more than the about 60vmax the farthest viewport corner needs), and each opacity-animated overlay (veil, scrim, quiet) was promoted to its own compositor layer, so changing its opacity no longer repaints the wall.

On real hardware with GPU compositing these layers are normally cheap. This **must be verified on a mid-range Android phone and a laptop** before C could be considered for production. It is one of the reasons C is not the recommended concept.

## Weight

- **A** adds no assets beyond the existing logo icon (already in `public/brand/`).
- **B** adds no assets.
- **C** loads one existing photograph (`public/hero/campus-sky-backdrop.png`, 1672×941), served through `next/image` (resized and modern formats). It is the LCP element, so it is marked `loading="eager"`.

All three share the Motion runtime, which the project already ships.
