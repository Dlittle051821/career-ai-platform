import type { PricingPackage } from "@/types";

/**
 * Provisional package pricing. All figures are sample/illustrative until
 * commercially finalised — see the "provisional" flag and the disclosure
 * copy rendered alongside every price on the Pricing page.
 */
export const PRICING_PACKAGES: PricingPackage[] = [
  {
    id: "admit",
    name: "Admit",
    price: 29999,
    currency: "INR",
    tagline: "Get a clear, well-documented plan for course and admission decisions.",
    bestFor: "Students who mainly need structured India-focused admission support.",
    provisional: true,
    scope: [
      "Profile review",
      "Course and university shortlist support",
      "Application-planning support",
      "Document checklist",
      "Defined counselling touchpoints",
    ],
    notIncluded: [
      "Country comparison beyond India",
      "Visa preparation",
      "Job-readiness roadmap",
    ],
  },
  {
    id: "global",
    name: "Global",
    price: 49999,
    currency: "INR",
    tagline: "Compare India and abroad pathways with finance and visa preparation support.",
    bestFor: "Students actively weighing international study alongside India.",
    provisional: true,
    scope: [
      "Everything in Admit",
      "Deeper country/pathway comparison",
      "Finance and application planning",
      "Visa-preparation guidance",
      "Pre-departure planning",
    ],
    notIncluded: ["Internship/job-readiness roadmap", "Ongoing parent progress reviews"],
  },
  {
    id: "global-360",
    name: "Global 360",
    price: 89999,
    currency: "INR",
    tagline: "End-to-end coordination from course selection through job readiness.",
    bestFor: "Families who want higher-touch support across the full journey.",
    provisional: true,
    scope: [
      "Everything in Global",
      "Higher-touch end-to-end coordination",
      "Skills and employability roadmap",
      "Internship/job-readiness planning",
      "Parent progress reviews",
    ],
    notIncluded: [],
  },
];

export const PRICING_DISCLOSURE = [
  "All prices shown are provisional and illustrative until commercially finalised.",
  "We do not fabricate taxes, exclusions, session counts, refund percentages, or third-party charges.",
  "A full written scope, applicable taxes, exclusions, third-party fees, and refund terms will be shared and confirmed before any payment.",
];
