/**
 * UX10-PR01B "Pricing Visual Correction Pass" — per-plan accent color for
 * the standard (non-Premium) cards, reusing the SAME six-family pastel
 * "surface-soft-*" system already defined in globals.css for
 * DiscoveryPillars.tsx/HeroProductPreview.tsx (see that file's own comment
 * block: "one per UX10A accent role... exploration=blue, courses/
 * learning=pink, universities=mint, personalisation/guidance=lavender/
 * amber"). This is a visual-only presentation lookup — same "don't touch
 * the schema/logic for a presentation-only decision" discipline as
 * `recommended-badge.ts` / `plan-eyebrow.ts` / `plan-icon.ts` — and does not
 * create any new color token; it only re-references the existing CSS
 * custom properties by name, exactly as the brief's own category-accent
 * request (Explore=blue, Verified=blue/lavender, Essential=amber,
 * Bachelor/Master Plus=cyan/blue) maps onto that already-approved palette.
 */
export interface PlanAccent {
  /** Pale background tone — safe for a chip/icon-circle fill. */
  pale: string;
  /** The paired darker tone — safe for text/icon strokes drawn on `pale`. */
  strong: string;
}

const PLAN_ACCENT_BY_SLUG: Record<string, PlanAccent> = {
  "nextwise-explore": { pale: "var(--surface-soft-blue)", strong: "var(--surface-soft-blue-strong)" },
  "nextwise-verified": { pale: "var(--surface-soft-lavender)", strong: "var(--surface-soft-lavender-strong)" },
  "nextwise-essential": { pale: "var(--surface-soft-amber)", strong: "var(--surface-soft-amber-strong)" },
  "bachelor-abroad-plus": { pale: "var(--surface-soft-cyan)", strong: "var(--surface-soft-cyan-strong)" },
  "master-abroad-plus": { pale: "var(--surface-soft-cyan)", strong: "var(--surface-soft-cyan-strong)" },
};

export const DEFAULT_PLAN_ACCENT: PlanAccent = { pale: "var(--surface-soft-blue)", strong: "var(--surface-soft-blue-strong)" };

export function planAccent(slug: string): PlanAccent {
  return PLAN_ACCENT_BY_SLUG[slug] ?? DEFAULT_PLAN_ACCENT;
}
