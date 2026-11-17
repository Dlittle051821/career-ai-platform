import type { CareerScores } from "@/types/career";

/**
 * Career Explorer V5 — "What may appeal" / "Things to weigh up".
 *
 * Both lists are read from the career's own curated characteristic scores
 * (the same 1–5 heuristics deriveCareerCharacteristics already turns into
 * chips). No number is shown and nothing is ranked: a high score becomes a
 * plain statement of what the work tends to offer, a low score a plain
 * statement of what it tends not to. They are general tendencies, not
 * guarantees, and the UI says so wherever they appear.
 */
type Rule = { key: keyof CareerScores; text: string };

const APPEAL_RULES: Rule[] = [
  { key: "technicalDepth", text: "Deep technical work you can keep specialising in" },
  { key: "internationalMobility", text: "Skills that tend to transfer across countries" },
  { key: "creativity", text: "Room for creative and original work" },
  { key: "socialImpact", text: "Work with a visible benefit to other people" },
  { key: "leadershipOpportunity", text: "Clear routes into leading teams or projects" },
  { key: "jobSecurity", text: "Roles that tend to stay in steady demand" },
  { key: "remoteWork", text: "Often possible to do part of the work remotely" },
  { key: "entrepreneurship", text: "Possible to build your own practice or business" },
  { key: "researchIntensity", text: "Close to research and new knowledge" },
  { key: "salaryPotential", text: "Pay that tends to grow well with experience" },
];

const CONSIDERATION_HIGH_RULES: Rule[] = [
  { key: "travel", text: "Regular travel or time away from home" },
  { key: "researchIntensity", text: "A long study or research path before senior roles" },
  { key: "technicalDepth", text: "Calls for sustained, demanding technical study" },
];

const CONSIDERATION_LOW_RULES: Rule[] = [
  { key: "remoteWork", text: "Mostly on-site work, with little remote flexibility" },
  { key: "jobSecurity", text: "Demand can rise and fall with the market" },
  { key: "creativity", text: "Much of the work follows set standards and procedures" },
  { key: "internationalMobility", text: "Qualifications may need re-recognition in another country" },
  { key: "salaryPotential", text: "Pay tends to grow more slowly than in some other fields" },
];

const HIGH = 4;
const LOW = 2;

export interface CareerBalance {
  appeal: string[];
  considerations: string[];
}

export function deriveCareerBalance(scores: CareerScores, limit = 3): CareerBalance {
  const value = (key: keyof CareerScores) => scores[key];
  const appeal = APPEAL_RULES.filter((r) => (value(r.key) ?? 0) >= HIGH)
    .sort((a, b) => (value(b.key) ?? 0) - (value(a.key) ?? 0))
    .slice(0, limit)
    .map((r) => r.text);
  const considerations = [
    ...CONSIDERATION_HIGH_RULES.filter((r) => (value(r.key) ?? 0) >= HIGH),
    ...CONSIDERATION_LOW_RULES.filter((r) => {
      const v = value(r.key);
      return v !== null && v !== undefined && v <= LOW;
    }),
  ]
    .slice(0, limit)
    .map((r) => r.text);
  return { appeal, considerations };
}
