/**
 * UX10-PR01 — plain-data fixture of the NEW seven-plan active commercial
 * catalogue, sourced verbatim from this milestone's own commercial
 * specification (the user's exact prices, names, descriptions, benefit
 * copy, and CTA text). Mirrors the exact "fixture regression, not a live DB
 * read" convention src/lib/pricing/official-catalog.ts already established
 * for the superseded M12 catalogue — see that file's own docblock.
 *
 * This module is NOT read by any runtime code path.
 * supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql is the actual
 * source of truth that (once a human administrator reviews and runs it)
 * gets written to the database. This module exists so:
 *   1. pr01-catalog.test.ts has one place to assert "the new active
 *      catalogue is exactly these 7 plans, at these exact prices, in this
 *      exact order" as a regression fixture.
 *   2. src/app/dev-preview/pricing/page.tsx (a temporary, pre-packaging-
 *      deleted QA harness — this sandbox has no live Supabase project, the
 *      same limitation every prior milestone's visual QA has had to work
 *      around) can build real `PricingPlanWithVersion[]` objects from this
 *      exact real data, without a second hand-maintained copy of it.
 *
 * If a price, name, or benefit ever needs to change, it must change in the
 * spec, then here, then in a new pricing_plan_versions row via a real
 * admin-reviewed migration — never the other way around.
 */

export interface Pr01InclusionFixture {
  title: string;
  isHighlight: boolean;
}

export interface Pr01PlanFixture {
  slug: string;
  category: "school_counselling" | "bachelor_abroad" | "master_abroad";
  publicTitle: string;
  shortDescription: string;
  amountMinorUnits: number;
  currency: "INR";
  ctaText: string;
  displayOrder: number;
  isRecommended: boolean;
  /** Null for the 4 continuing Bachelor/Master Abroad plans — their real inclusions are unchanged from 0007 and are not duplicated here; see those plans' own seed rows. */
  inclusions: Pr01InclusionFixture[] | null;
}

export const PR01_ACTIVE_CATALOG: Pr01PlanFixture[] = [
  {
    slug: "nextwise-explore",
    category: "school_counselling",
    publicTitle: "Nextwise Explore",
    shortDescription: "Discover your possibilities.",
    amountMinorUnits: 0,
    currency: "INR",
    ctaText: "Start Exploring Free",
    displayOrder: 10,
    isRecommended: false,
    inclusions: [
      { title: "AI-assisted career and interest exploration", isHighlight: false },
      { title: "Course, college and university discovery", isHighlight: false },
      { title: "India vs abroad comparison tools", isHighlight: false },
      { title: "Indicative eligibility and study-cost insights", isHighlight: false },
      { title: "Scholarship and entrance exam resources", isHighlight: false },
      { title: "Personalized student dashboard and saved options", isHighlight: false },
      { title: "Study-planning checklists and educational resources", isHighlight: false },
    ],
  },
  {
    slug: "nextwise-verified",
    category: "school_counselling",
    publicTitle: "Nextwise Verified",
    shortDescription: "Know which options genuinely fit you.",
    amountMinorUnits: 199_900,
    currency: "INR",
    ctaText: "Get My Verified Review",
    displayOrder: 20,
    isRecommended: false,
    inclusions: [
      { title: "Academic profile and eligibility screening", isHighlight: false },
      { title: "Career and education pathway assessment", isHighlight: false },
      { title: "Up to three researched course or program recommendations", isHighlight: false },
      { title: "Admission requirement and skills-gap checklist", isHighlight: false },
      { title: "Study-cost and affordability snapshot", isHighlight: false },
      { title: "Scholarship opportunity screening", isHighlight: false },
      { title: "Personalized Nextwise Decision Summary", isHighlight: true },
      { title: "One short expert clarification session", isHighlight: false },
      { title: "Official information sources and next-step roadmap", isHighlight: false },
    ],
  },
  {
    slug: "nextwise-essential",
    category: "school_counselling",
    publicTitle: "Nextwise Essential",
    shortDescription: "Your Indian college journey, made simpler.",
    amountMinorUnits: 2_499_900,
    currency: "INR",
    ctaText: "Plan My India Admission",
    displayOrder: 30,
    isRecommended: false,
    inclusions: [
      { title: "Everything in Nextwise Verified", isHighlight: true },
      { title: "Personalized shortlist of up to eight Indian colleges/programs", isHighlight: false },
      { title: "Up to five admission application workflows", isHighlight: false },
      { title: "Entrance exam and admission route planning", isHighlight: false },
      { title: "College fee, placement-data and ROI comparison", isHighlight: false },
      { title: "Application forms and document guidance", isHighlight: false },
      { title: "SOP, CV or portfolio guidance where required", isHighlight: false },
      { title: "Scholarship and education loan research", isHighlight: false },
      { title: "Counselling-round and seat-allotment process guidance", isHighlight: false },
      { title: "Admission deadline and application tracking", isHighlight: false },
      { title: "Offer comparison and college selection consultation", isHighlight: false },
      { title: "Parent consultation and pre-enrolment checklist", isHighlight: false },
    ],
  },
  {
    slug: "bachelor-abroad-plus",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Plus",
    shortDescription: "Your first international degree starts with the right plan.",
    amountMinorUnits: 7_000_000,
    currency: "INR",
    ctaText: "Start My Bachelor's Journey",
    displayOrder: 40,
    isRecommended: false,
    inclusions: null,
  },
  {
    slug: "master-abroad-plus",
    category: "master_abroad",
    publicTitle: "Master Abroad Plus",
    shortDescription: "Advance your qualifications with a smarter global study plan.",
    amountMinorUnits: 7_500_000,
    currency: "INR",
    ctaText: "Plan My Master's Abroad",
    displayOrder: 50,
    isRecommended: false,
    inclusions: null,
  },
  {
    slug: "bachelor-abroad-premium",
    category: "bachelor_abroad",
    publicTitle: "Bachelor Abroad Premium",
    shortDescription: "Your global education journey, personally coordinated.",
    amountMinorUnits: 12_000_000,
    currency: "INR",
    ctaText: "Explore Bachelor Premium",
    displayOrder: 60,
    isRecommended: true,
    inclusions: null,
  },
  {
    slug: "master-abroad-premium",
    category: "master_abroad",
    publicTitle: "Master Abroad Premium",
    shortDescription: "A complete, personally coordinated master's admission journey.",
    amountMinorUnits: 12_500_000,
    currency: "INR",
    ctaText: "Explore Master Premium",
    displayOrder: 70,
    isRecommended: true,
    inclusions: null,
  },
];

/** Slugs retired from active sale by this milestone (deactivated, never deleted — see the seed file's own header). */
export const PR01_RETIRED_SLUGS = ["launch-essential", "launch-pro", "bachelor-abroad-essential", "master-abroad-essential"] as const;
