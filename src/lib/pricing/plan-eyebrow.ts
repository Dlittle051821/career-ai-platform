/**
 * UX10-PR01 — the small colored "eyebrow" pill the reference mockup shows
 * above each plan card's title (e.g. "START HERE", "STUDY IN INDIA",
 * "BACHELOR'S · STUDY ABROAD"). Purely descriptive positioning copy, not a
 * price, benefit, or legal term, so — same discipline as
 * `recommended-badge.ts` — it is a presentation-only lookup keyed by the
 * plan's real, stable `slug`, not a new database column. Every plan in the
 * new 7-plan catalogue has a fixed, known slug, so this is a plain literal
 * map rather than a derived/guessed label.
 */
const PLAN_EYEBROW_BY_SLUG: Record<string, string> = {
  "nextwise-explore": "Start here",
  "nextwise-verified": "Personalized decision support",
  "nextwise-essential": "Study in India",
  "bachelor-abroad-plus": "Bachelor's · Study abroad",
  "master-abroad-plus": "Master's · Study abroad",
  "bachelor-abroad-premium": "Bachelor's · High-support service",
  "master-abroad-premium": "Master's · High-support service",
};

export function planEyebrowLabel(slug: string): string | null {
  return PLAN_EYEBROW_BY_SLUG[slug] ?? null;
}
