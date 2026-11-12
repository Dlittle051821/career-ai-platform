# CC26-04: Homepage accessibility and visual regression

**Summary:** the six "failing chapter-navigation touch targets" (CC-25 H6b) are **not touch targets**. They are the visually hidden keyboard skip links. In their resting state they are clipped to zero area and **cannot receive a tap or click on any device**. Their only interactive state, keyboard focus, is a 162.5 × 36 px pill, which meets WCAG 2.5.8 with room to spare.

The smallest correct fix was therefore **no change to the V5.4 homepage**: no protected file was touched. The CC-25 measurement tool was corrected instead, narrowly, and its correction is itself tested. All 39 V5.4 protected files are unchanged.

## 1. What the six links are

`NextwiseV54Home.tsx` renders `<nav class="nw4-skipnav" aria-label="Homepage sections">` with six links, "Go to: One platform, two pathways", "Go to: Career Intelligence", and so on. The V4 stylesheet hides each link with the standard screen-reader-only pattern until it receives keyboard focus:

```css
.nw4 .nw4-skipnav a:not(:focus){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
```

CC-25's evaluator measured the hidden box as 28 × 1 px (1 px of width plus 28 px of horizontal padding, 1 px tall) and reported it as an undersized target.

## 2. Evidence (CC-26 production build, Chromium)

`qa/probe-skipnav.cjs`; output in `evidence/skipnav/skipnav-report.json`.

| Viewport | Motion | Resting box | Hit-test at centre reaches the link | Real tap/click activates it | Focused pill (smallest) | Focused pill hit-testable |
|---|---|---|---|---|---|---|
| Desktop 1440 × 900 | normal / reduced | 28 × 1, `clip: rect(0,0,0,0)` | 0 / 6 | 0 / 6 | 162.5 × 36 | 6 / 6 |
| iPhone 13 (emulated) | normal / reduced | same | 0 / 6 | 0 / 6 (touch tap) | 162.5 × 36 | 6 / 6 |
| Pixel 7 (emulated) | normal / reduced | same | 0 / 6 | 0 / 6 (touch tap) | 162.5 × 36 | 6 / 6 |
| 320 × 640 touch | normal / reduced | same | 0 / 6 | 0 / 6 (touch tap) | 162.5 × 36 | 6 / 6 |

Only one focused link is shown at a time (no neighbouring targets), so the spacing condition cannot fail either.

WCAG 2.2 SC 2.5.8 measures the area that accepts a pointer action. A box clipped to zero area accepts none; the focused pill is the target, and it passes.

## 3. Evaluator correction (narrow, and tested)

The CC-26 `target-size.cjs` excludes an element only when CSS clips it to **zero area**: `position: absolute|fixed` with `clip: rect(0,0,0,0)` or `clip-path: inset(50%|100%)`. Elements merely covered by something else are still measured.

Control test (`evidence/skipnav/evaluator-control.txt`): two visible 10 × 10 px links placed 2 px apart are still flagged; a zero-area clipped control is ignored.

Result on the homepage, with the corrected evaluator: **0 failures** at desktop, iPhone 13, Pixel 7, 320 px and 768 px tablet, each with and without reduced motion (`evidence/skipnav/homepage-target-size.json`). Suite H, check H6b, uses the same evaluator.

## 4. Before and after screenshots

The homepage itself did not change. The screenshots show the before state (`a1017b9`, the deployed V5.4 build) and the after state (CC-26 build) side by side:

- **Resting:** the skip links are invisible: `evidence/skipnav/*-resting.png`.
- **Focused:** the first skip link as a keyboard user sees it: `evidence/skipnav/*-focused-first.png`.
- **Side by side:** `evidence/skipnav/BEFORE-AFTER-homepage-skipnav.png` (desktop and iPhone 13; resting and focused). The only differences are the floating question cards caught at different animation frames (`before-after-pixel-diff.txt`).
- **Suite V (deterministic, motion paused):** compares the CC-26 homepage with the deployed `a1017b9` build. The rendered DOM is **identical** (73,702 characters on desktop, 73,598 on mobile, the same 28 internal links), and **16/16** scroll frames match: 15 pixel-identical and one with 4 px of anti-aliasing noise. There are 0 console errors. Screenshots: `evidence/final/shots/V-*`.

## 5. Motion and reduced motion

- **Normal motion:** the intro N animation, the Career Intelligence and Study Abroad motion graphics and the scroll chapters are covered by suite V's frame comparison against `a1017b9` (8 scroll positions each on desktop and mobile: 16/16 match).
- **Reduced motion:** the skip links and target sizes were measured with `prefers-reduced-motion: reduce` on every viewport above (no difference). The reduced-motion path is part of the protected V5.4 code and is unchanged (39/39 files byte-identical, checked against `cc24-v54-baseline-hashes.json`).

## 6. If you still want a visible change

To make the skip links measurable as 24 px boxes even while hidden, a 1-line CSS change in the protected `v54.css` would be needed. It brings no user benefit and needs your design approval. I recommend leaving the homepage as it is.
