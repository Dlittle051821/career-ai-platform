/**
 * UX10-PR01 — distinct public badge text for the two plans marked
 * `is_recommended` in the new 7-plan catalogue. Per the user's own
 * instruction: "Bachelor Abroad Premium should be 'Most Recommended' and
 * Master Abroad Premium should be positioned as the strongest full-support
 * option." `pricing_plans.is_recommended` is a single boolean (shared by
 * both plans), so the two different headline strings are a presentation-
 * layer decision keyed by slug, not a new database column — adding a
 * second "badge text" column would be an unnecessary schema change for a
 * copy-only distinction, same "don't touch the schema for a presentation
 * question" discipline the M12 catalogue's own category-reuse decision
 * already used (see official-catalog.ts's docblock).
 *
 * A plan's `is_recommended` flag still drives whether we even call this
 * (see PublicPricingPlanCard's `highlight`/`recommendedLabel` props) — this
 * module only answers "which exact words" for the two plans that currently
 * have it set. Any other plan that becomes recommended in the future falls
 * back to the neutral "Recommended" label already used everywhere else in
 * the app, rather than silently getting no badge at all.
 */
const RECOMMENDED_BADGE_BY_SLUG: Record<string, string> = {
  "bachelor-abroad-premium": "Most Recommended",
  "master-abroad-premium": "Best for Full Support",
};

export function recommendedBadgeLabel(slug: string): string {
  return RECOMMENDED_BADGE_BY_SLUG[slug] ?? "Recommended";
}
