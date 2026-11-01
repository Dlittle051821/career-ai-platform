# NW08.7 · 07 · Accessibility

## Reduced motion

- **Detection:** `usePrefersReducedMotion()` reads `(prefers-reduced-motion: reduce)` via `useSyncExternalStore`. It is hydration-safe and updates live if the OS setting changes.
- **Review override:** `?motion=reduced` forces the static view without changing OS settings.
- **What changes:** the tall scroll section, sticky stage, scroll-linked motion and scrubber are not rendered at all. `StaticStory` shows the four stages as an `h1` and three `h2` headings with their lines, the two CTAs, and the concept's object in its finished state as a labelled `figure`. "Explore the paths ahead" follows as on every page. The story is not removed, and no content is lost.
- **Verified in the browser** for all three concepts at 390px and 1440px, both via `?motion=reduced` and via Playwright's emulated `prefers-reduced-motion: reduce`. In every case the page had `data-motion-mode="reduced"`, no animated section, the h1 "What comes next?" and five headings. Screenshots: `evidence/reduced/`.
- An earlier build raised a Motion error ("Target ref is defined but not hydrated") in reduced mode, because `useScroll` ran even though the section wasn't rendered. This was fixed by mounting the scroll hooks only in the animated branch (`AnimatedStory`). The final run had zero console errors.

## Keyboard

Measured by pressing Tab 30 times from page load at 1440px, for each concept. Results are in `evidence/qa-results.json`.

Tab order (Living Path; the others match):
1. Logo (home), then the six `MAIN_NAV` items, then the "Motion Lab" link
2. **Skip to the paths**
3. Scrubber: progress slider (labelled "Story progress" through a visually hidden `<label>`), Restart, 1, 2, 3, 4, Hide
4. The five entry points in "Explore the paths ahead"
5. Focus then wraps back to the header (the lab has no footer).

Findings:
- **No focus ever landed on an invisible element** (0 of 29 stops across all three concepts). Captions and labels below 4% opacity are set to `visibility: hidden`, which removes their links from the tab order. The final stage's CTAs become focusable only once they are visible.
- In B, the first panel's "Explore Careers" link is focusable from the start, because that panel is visible and readable from the start. The folded panels' links are hidden past 80° of fold.
- **Every stop showed a visible focus indicator** (outline or ring).
- **Skip to the paths works:** focusing it and pressing Enter brought `#paths` into view in all three concepts. Screenshot: `evidence/frames/*-1440-focus-skip.jpg`.
- Space, Page Down and the arrow keys scroll the story natively, because nothing intercepts scrolling.

## Screen readers

- Each story section has an `aria-label` (the concept name) and contains a visually hidden ordered list of all four stages, so the whole story is read once, in order.
- Moving captions (all but the last) are `aria-hidden`, so they are not announced repeatedly. The final caption, with its CTAs, is exposed.
- Decorative scene layers are `aria-hidden`. Concept C's photograph has an empty `alt` in the animated scene (decorative) and is described by the `figure`'s `aria-label` in the reduced view.
- Concept C's final panel is a `nav` labelled "Where to start".

## Scroll trapping

None. In a continuous wheel scroll from the top, all three concepts reached "Explore the paths ahead" at 390px and 1440px. There are no wheel or touch listeners, and a test enforces this.

## Contrast and type

Story text is `#161922` on `#FAFAF8`, and secondary text is `#666B76` on `#FAFAF8` (5.1:1, which passes WCAG AA for body text; white on the blue CTA is 5.2:1). Where Concept C's scenery passes behind captions, a canvas-coloured scrim fades in first. Headings in the lab set their colour explicitly, because the site's global `h1–h4` rule would otherwise make them blue and bold. This was found in the gallery screenshot and fixed.

## Not done (out of scope or not possible here)

- No manual screen-reader pass with NVDA, VoiceOver or TalkBack. It should be done on the chosen concept.
- No axe or Lighthouse accessibility score (see `NW087_06_PERFORMANCE.md` on why Lighthouse wasn't run).
