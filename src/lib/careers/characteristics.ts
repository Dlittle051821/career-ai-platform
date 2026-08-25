import type { CareerScores } from "@/types/career";

/**
 * Turns a career's internal 1-5 heuristic scores into a short list of
 * qualitative characteristic chips (e.g. "Strong salary potential") — never
 * the raw numbers themselves.
 *
 * Milestone 4 §5 and §18 are explicit that these scores are curated
 * internal matching metadata for a future recommendation engine, not
 * verified facts or psychometric measurements, and must not be presented
 * to students as precise figures. Showing a qualitative label only when a
 * dimension scores 4 or 5 keeps the page honest (no invented precision, no
 * "63% match"-style claims) while still surfacing something useful.
 */
const CHARACTERISTIC_LABELS: { key: keyof CareerScores; label: string }[] = [
  { key: "salaryPotential", label: "Strong salary potential" },
  { key: "jobSecurity", label: "High job security" },
  { key: "internationalMobility", label: "Good international mobility" },
  { key: "remoteWork", label: "Remote-work friendly" },
  { key: "entrepreneurship", label: "Entrepreneurial path available" },
  { key: "creativity", label: "Creativity-driven" },
  { key: "socialImpact", label: "High social impact" },
  { key: "leadershipOpportunity", label: "Strong leadership opportunities" },
  { key: "travel", label: "Travel-heavy" },
  { key: "researchIntensity", label: "Research-intensive" },
  { key: "technicalDepth", label: "Deep technical specialisation" },
];

const HIGH_THRESHOLD = 4;

export function deriveCareerCharacteristics(scores: CareerScores, limit = 6): string[] {
  return CHARACTERISTIC_LABELS.filter((c) => (scores[c.key] ?? 0) >= HIGH_THRESHOLD)
    .sort((a, b) => (scores[b.key] ?? 0) - (scores[a.key] ?? 0))
    .slice(0, limit)
    .map((c) => c.label);
}
