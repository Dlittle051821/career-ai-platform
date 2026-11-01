# NW08.7 · 03 · Design decisions

## One story, three objects

The words, their order, their position and their timing are identical in all three prototypes, and only the object changes. That makes the comparison fair: a reviewer judges the motion, not differences in copy or layout.

## Layout

- **Desktop (≥1024px):** a split stage. Captions sit in a left column 42vw wide, vertically centred; the object sits in the right-hand area. An earlier version layered captions over the object, and the captured frames showed collisions, so the layout was changed.
- **Phones and tablets:** the object sits in the upper part of the stage, and captions are anchored to the bottom with a reserved minimum height, so the eye always knows where the words are.
- **Object framing:** `ObjectFrame` sizes the object from the available height (`--frame-h`) and the object's aspect ratio, so it never stretches. This fixed an aspect distortion found in early captures.

## Palette (brief §)

Canvas `#FAFAF8`, white `#FFFFFF`, text `#161922`, secondary `#666B76`, borders `#E6E7EA`, blue `#2563EB`. Plum `#5A3B8C` is used sparingly: only on the Study Abroad branch (A), the Study Abroad panel accent (B) and the faint horizon glow (C). Concept A's ribbon uses a darker blue `#1E3A8A` and a cyan highlight `#22C7F2` within the blue family, purely for depth.

## Typography

Story lines use Fraunces (already loaded in the project) at weight 300 with high optical size and a softened axis. This gives a calm, editorial voice that contrasts with the product UI. Everything else uses the existing Plus Jakarta Sans.

## Brand

The official logo files are used untouched: the `Logo` component in the header and `BRAND_LOGO.icon` in Concept A. Nothing is redrawn, stretched or recoloured. Concept A *echoes* the N-arrow idea with its own ribbon, but it never imitates or replaces the mark.

## Content integrity

Every label and link comes from `MAIN_NAV` (`src/config/site.ts`) and `EUROPE_COUNTRIES` (`src/data/europe-explorer.ts`), through `src/lib/motion-lab/content.ts`. The supporting lines describe only what Nextwise offers today. Concept C's photograph (`public/hero/campus-sky-backdrop.png`) is an existing, already-published repository asset; no AI imagery was generated for this milestone.

## Motion principles applied (ui-ux-pro-max and the brief)

- At most one or two elements change meaningfully at a time.
- Only transform and opacity are animated, plus `visibility` toggled at an opacity threshold.
- Scrubbed motion uses symmetric easing with no overshoot (easeInOutCubic), so reversing never bounces. Arrivals decelerate (easeOutQuart).
- A light spring (stiffness 160, damping 34) smooths the scroll value itself. Scroll position is never hijacked.
- The final state is always readable and actionable, and reduced motion shows that final state directly.

## Iterations made from captured frames

| Finding | Change |
|---|---|
| A: round linecaps left stray dots before a path started drawing | Paths are hidden until they have length. |
| A: Career label collided with the ribbon | Label moved clear and right-aligned. |
| A: logo too small and clipped on phones | Enlarged and anchored above-left of the arrow tip. |
| All: two headlines superimposed during crossfades | Captions now hand over sequentially. |
| B: folded state read as a flat box | Fold angle reduced from 172° to 156° and perspective tightened, so the layered edges show. |
| B: object too small on desktop; heavy shadow band on phones | Larger panel sizes; shadow and heading shown at md and wider only. |
| B: "Universities and Courses" wrapped awkwardly | Two separate links, stacked on tablet and desktop, side by side on phones. |
| C: on phones the window framed only sky | The photograph layer is shortened on phones so the campus sits inside the arch. |
