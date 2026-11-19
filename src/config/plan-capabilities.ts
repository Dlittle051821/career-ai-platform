/**
 * Plan capabilities — the one place that says what each commercial plan unlocks.
 *
 * A capability is granted by the plan's stable SLUG, listed explicitly here.
 * Never by plan name, never by a substring, never by price or category: a new
 * plan unlocks nothing until someone adds it to this table on purpose
 * (plan-capabilities.test.ts fails when a catalogue plan is missing here).
 *
 * Career Intelligence (`career_intelligence`) is the personalised analysis:
 * ranked career matches, fit explanations, strengths/gaps, roadmaps and
 * reports built from a student's own assessment answers. It is separate from
 * Career Explorer, which is free for everyone, permanently.
 *
 *   nextwise-explore   ₹0 — the free tier. Grants no paid capability, whatever
 *                      the state of any ₹0 invoice attached to it.
 *   nextwise-verified  ₹1,999 incl. GST — the minimum qualifying plan
 *                      ("Career and education pathway assessment").
 *   nextwise-essential "Everything in Nextwise Verified".
 *   abroad plans       included by the owner's access rule (17 Nov 2026 brief):
 *                      paid Abroad / Bachelor Abroad / Master Abroad plans qualify.
 *   study-abroad-lite / study-abroad-premium
 *                      NW-PRICING-V3 (₹44,999 / ₹74,999): the two Study Abroad
 *                      packages include Career Intelligence.
 *
 * Retired plans stay listed: students who bought them keep what they paid for
 * (the catalogue migration retires plans; it never removes entitlements).
 *
 * Holding a plan is necessary, not sufficient: access also needs a confirmed
 * payment (src/lib/career-intelligence/access.ts).
 */
export const CAPABILITIES = ["career_intelligence"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const PLAN_CAPABILITIES: Readonly<Record<string, readonly Capability[]>> = Object.freeze({
  "nextwise-explore": [],
  "nextwise-verified": ["career_intelligence"],
  "nextwise-essential": ["career_intelligence"],
  "bachelor-abroad-plus": ["career_intelligence"],
  "master-abroad-plus": ["career_intelligence"],
  "bachelor-abroad-premium": ["career_intelligence"],
  "master-abroad-premium": ["career_intelligence"],
  "study-abroad-lite": ["career_intelligence"],
  "study-abroad-premium": ["career_intelligence"],
});

/** True only for a slug listed above with that capability. Unknown slugs get nothing. */
export function planHasCapability(planSlug: string | null | undefined, capability: Capability): boolean {
  if (!planSlug || !Object.hasOwn(PLAN_CAPABILITIES, planSlug)) return false;
  return PLAN_CAPABILITIES[planSlug].includes(capability);
}

/** Slugs of every plan that carries the capability, in table order. */
export function plansWithCapability(capability: Capability): string[] {
  return Object.keys(PLAN_CAPABILITIES).filter((slug) => PLAN_CAPABILITIES[slug].includes(capability));
}

/** The cheapest plan that unlocks Career Intelligence — what the upgrade screen leads with. */
export const CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG = "nextwise-verified";
