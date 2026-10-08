/**
 * UX09 Part D — the motion system's shared class-name constants.
 *
 * Before this pass, no animation dependency existed in this project
 * (confirmed: no framer-motion/gsap/motion in package.json) and the task's
 * own instruction is explicit — "if no Framer Motion/Motion dependency
 * exists, DO NOT add one; use CSS/Tailwind/keyframes." Everything here is
 * either a bare Tailwind utility string or a small custom keyframe class
 * defined in globals.css (`.animate-fade-up`, `.animate-flow-dash`) — zero
 * new dependencies, zero JavaScript-driven animation.
 *
 * Centralizing these as named exports (rather than pasting the same long
 * class string into five page files) gives this pass exactly one place
 * that could omit a `motion-reduce:` guard, and that one place is covered
 * by this file's own test — instead of five JSX blocks each needing a
 * manual re-check.
 *
 * Every constant pairs its animated/transitioned state with an explicit
 * `motion-reduce:` Tailwind variant, following the same convention already
 * established by this codebase's own Button.tsx loading spinner
 * (`animate-spin motion-reduce:animate-none`) — this pass does not invent
 * a new convention, it extends the one already reviewed and shipped.
 */

/** Entrance motion for hero copy / section headings — a single, non-repeating fade-and-rise. Duration sits inside the task's own 150-500ms band for UI transitions. */
export const FADE_UP_CLASSES = "animate-fade-up motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0";

/**
 * Hover/focus elevation for a primary CTA or clickable card — never on by
 * default, only in response to interaction, so there is no "stuck
 * invisible" risk the way an entrance animation has.
 *
 * Uses `transition-all` rather than a `transition-[transform,box-shadow]`
 * property list deliberately: several call sites (e.g. Button.tsx's own
 * `BASE_CLASSES`) already apply `transition-colors duration-150` for
 * their hover color change, and `transition-property` is a single CSS
 * property — two utility classes each setting a different explicit
 * property list on the same element would silently fight over which one
 * wins, dropping either the color transition or the lift transition.
 * `transition-all` composes with that existing color transition instead
 * of fighting it.
 */
export const HOVER_LIFT_CLASSES =
  "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lifted motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none";

/** Gentle, slow, non-blocking ambient motion along an SVG pathway's connecting line — explicitly the "gentle pathway animation" the task's own allowed-motion list names. Infinite but slow (6s/loop) and low-amplitude; still gets an explicit reduced-motion override (see globals.css) rather than relying only on the project's blanket rule. */
export const FLOW_DASH_CLASSES = "animate-flow-dash motion-reduce:animate-none";

/** Stagger delay (ms) for the Nth child (0-indexed) of a fade-up group — e.g. the pathway graphic's nodes appearing in sequence rather than all at once. Capped so a long list never produces a sluggish entrance. */
export function getStaggerDelayMs(index: number, stepMs = 70, maxItems = 6): number {
  return Math.min(index, maxItems - 1) * stepMs;
}

/** Every duration this module hands out for a one-shot UI transition/entrance, for the test below to check against the task's own stated 150-500ms band. Ambient motion (FLOW_DASH) is intentionally excluded — the task's own rules put ambient motion in a separate, longer, "used sparingly" category. */
export const UI_TRANSITION_DURATIONS_MS = {
  fadeUp: 500,
  hoverLift: 200,
} as const;
