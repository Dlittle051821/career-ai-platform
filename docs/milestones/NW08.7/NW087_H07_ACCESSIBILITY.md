# NW08.7 · H07 · Accessibility and reduced-motion implementation

## Reduced motion

- **Detection:** `useReducedMotion()` from Motion for React. It follows `prefers-reduced-motion: reduce` and updates live.
- **Behaviour:** no pin, no tall section and no scroll-linked motion. The stage is a normal block, `calc(100svh − 4rem)` tall with a minimum of 40rem, showing the **finished composition**: ribbon fully formed, photograph in its loop, both pathways visible. The opening CSS reveal of the headline is disabled by `@media (prefers-reduced-motion: reduce)`. The preview dev bar is not rendered. The registration-prompt hold is not raised, because nothing is animating.
- **Verified in the browser** with Playwright's emulated `reducedMotion: "reduce"` at 1440, 768 and 390 (`evidence/homepage/reduced/`). Every case reported `data-motion-mode="reduced"`, a non-sticky stage, a section the height of one screen, no dev bar, and visible pathway links.
- **Tested in source:** `signature-hero.test.ts`, "reduced motion, fallback and performance".

## Keyboard

Measured with 16 Tab presses from load (`evidence/homepage/qa-results.json`).

| Width | Order |
|---|---|
| 1440 | Skip to main content → logo → the six `MAIN_NAV` items → search → language → Sign In → Get Started → **Start your journey → Study in Europe** → the next section |
| 390 | Skip to main content → logo → Open menu → **Start your journey → Study in Europe** → the next section |

- No focus ever landed on an invisible element: 0 of 32 stops. The pathway links (scene 5) use `visibility: hidden` until they appear, so they never steal focus mid-story. Their destinations are the first two links in the next section ("Explore Career Intelligence" and "Explore Nextwise Abroad"), so keyboard users lose nothing.
- Every stop showed a visible focus indicator. The hero's links use a 2px `#1454D9` outline with a 2px offset (`evidence/homepage/frames/focus-cta-*.png`).
- The existing "Skip to main content" link is untouched.
- Space, Page Down and the arrow keys scroll through the story natively.

## Screen readers

- The hero is a `<section aria-labelledby>` pointing at its `<h1>` ("Turn ambition into opportunity."). It is the page's only `h1`, because `HomeHero` is not rendered when the signature hero is.
- The ribbon SVG is `aria-hidden` and `focusable="false"`; it is decorative.
- What the photographs show is given once, as visually hidden text inside the hero. Both descriptions begin "Illustrative image:", so neither image is passed off as a real student.
- Links are real `<a>` elements with descriptive text. The arrow icons are `aria-hidden`.

## Targets, contrast, text

- **Tap targets:** the primary action is 48px tall, the secondary 44px, and the phone pathway links 44px.
- **Contrast** on `#FAFAF8`:
  - headline `#101827`: 17.0:1
  - body `#566174`: 6.0:1
  - white on the `#1454D9` button: 6.4:1

  Lighthouse reported no contrast issues in the hero. The page's contrast findings are in the existing final CTA section.
- **Weight:** the headline is weight 450, not hairline, so it holds up on phones (brief §05).

## Coexistence with the registration prompt

While the hero section is on screen and animating, it raises a named hold (`setRegistrationPromptHold("signature-hero", true)`). The prompt's **timed** path waits until the hold is released. The browser QA saw the hold events fire.

Everything else is unchanged:
- contextual requests still open immediately;
- never for signed-in visitors;
- never on excluded routes;
- once per visit;
- 7-day suppression;
- the native `<dialog>` with its focus trap.

## Not done

- No manual screen-reader pass (NVDA, VoiceOver, TalkBack).
- No real-device check of the iOS reduced-motion setting (see H11).
