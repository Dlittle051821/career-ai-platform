# NW08.7 · 04 · Technical architecture

## Isolation

- All code lives under three new folders: `src/app/motion-lab/`, `src/components/motion-lab/`, `src/lib/motion-lab/`. No existing component, page, route, config or data file was edited, apart from one added line in `vitest.config.mts`.
- `src/app/motion-lab/layout.tsx` is its own root layout, matching the project's existing per-area root layouts (there is no `src/app/layout.tsx`). It imports the shared `globals.css` and fonts, and sets `robots: { index: false, follow: false, nocache: true }`.
- No link to `/motion-lab` exists in the navigation, sitemap, robots or homepage, and a test asserts this.

## Production guard (server-side)

```ts
// src/lib/motion-lab/guard.ts
export function isMotionLabEnabled(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "development" || nodeEnv === "test";
}
```

Each of the four pages begins with `if (!isMotionLabEnabled()) notFound();`. This runs in the Server Component, so a production build (`NODE_ENV=production`) returns 404 for every Motion Lab URL. No client code decides access. A test checks that every page source contains the guard. The QA report records the 404 check against a real `next build` + `next start`.

## Scroll mechanism

```
<section data-motion-mode="animated" style="height: 520svh">   ← scroll distance (560svh for C)
  <div class="sticky top-0 h-[100svh]">                          ← the stage, pinned by CSS
     <ol class="sr-only"> four stages </ol>
     scene(progress)    ← concept object (transform/opacity only)
     <StoryCaptions/>   ← four captions
     Skip to the paths
  </div>
</section>
<DevScrubber/>          ← development-only controls
<PathsAhead id="paths"/> ← server-rendered, never animated
```

- `useScroll({ target, offset: ["start start", "end end"] })` produces `scrollYProgress` from 0 to 1 across the section. `useSpring` smooths it.
- Every visual value is derived with `useTransform`, so motion values write directly to element styles. **No React state changes per frame**; React renders once.
- Pinning is plain CSS `position: sticky`. There are no wheel or touch listeners and no `preventDefault`, so nothing traps scroll (a test checks this). Native scrolling, momentum and keyboard scrolling all work as normal.
- Reversibility is structural: every value is a pure function of progress, so scrolling back replays exactly.

## Reduced motion

`usePrefersReducedMotion()` subscribes to `(prefers-reduced-motion: reduce)` through `useSyncExternalStore`, which is hydration-safe. When it matches, or when the page is opened with `?motion=reduced` (read on the server and passed down as `forceReduced`), `ScrollStory` renders `StaticStory` instead of the tall section. `StaticStory` shows the four stages as headings, the two CTAs, and the concept's object in its finished state. There is no tall scroll and nothing moves.

## Shared modules

| Module | Role |
|---|---|
| `lib/motion-lab/story.ts` | Stage data and pure maths: `stageIndexAt`, `segment`, easings, `captionKeyframes`, `scrollTopForProgress` |
| `lib/motion-lab/content.ts` | Real labels and links derived from `MAIN_NAV` and `EUROPE_COUNTRIES`; concept catalogue for the gallery |
| `lib/motion-lab/*-geometry.ts` | Per-concept choreography windows and geometry, as testable data |
| `components/motion-lab/ScrollStory.tsx` | Sticky stage, progress, context, reduced-motion switch, skip link |
| `components/motion-lab/StoryCaptions.tsx` | Four captions; opacity, offset and visibility from progress |
| `components/motion-lab/DevScrubber.tsx` | Restart, stage jumps 1–4, a 0–1000 progress slider, hide/show. It drives the real scroll position (`window.scrollTo`), so the scrubber and the wheel never disagree. Readout updated via refs, not state. |
| `components/motion-lab/StaticStory.tsx` | Reduced-motion layout |
| `components/motion-lab/PathsAhead.tsx` | The always-visible list of entry points below each story |
| `components/motion-lab/LabChrome.tsx` | Header with the existing `Logo` and the six-item `MAIN_NAV`, plus a "Motion Lab" link back to the gallery |

## Concept techniques

- **A:** a single inline SVG (viewBox 1000×760). Strokes draw via `pathLength`; depth comes from stacked layers (shadow, underside, gradient top, highlight). Labels are real HTML links positioned in percentages of the same coordinate system, and the official mark is placed with `next/image`.
- **B:** four nested `div` panels, each hinged off its parent's far edge (`transform-origin` left or top), with `preserve-3d`, `backface-visibility: hidden` and a back face. Shading is an opacity layer proportional to the fold angle. Panel content is hidden past 80° so folded links are not focusable.
- **C:** the wall is one rounded-top element whose spread `box-shadow` (220vmax, canvas colour) *is* the wall. Scaling that element by transform carries the whole wall past the viewer. The photograph is `next/image` (`loading="eager"`, since it is the LCP element). Horizon and beams are CSS gradients; the beams animate `scaleY` only.

## Why no heavy library

Motion for React (already a dependency, 14.9.0) covers scroll-linked values, springs and SVG path drawing. CSS 3D covers Concept B's folds. Three.js / React Three Fiber / GSAP would add weight and a second animation model without enabling anything these concepts need, so none was introduced.
