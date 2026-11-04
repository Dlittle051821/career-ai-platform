import { z } from "zod";

/**
 * NW09 — the shared, VERSIONED Career Intelligence output contract.
 *
 * Two schemas:
 *  1. ModelOutput — what a provider must return. Built per request with the
 *     exact set of opaque candidate references ("C1".."Cn") the deterministic
 *     matcher selected, so a model can only talk about careers it was given.
 *     It never sees or returns a database id.
 *  2. CareerIntelligenceReport — what the application stores and renders.
 *     Assembled on the server by joining validated model output back to the
 *     catalogue records (ids, titles, slugs come from OUR data, never from
 *     the model). Student Studio and Counsellor Studio depend only on this,
 *     so swapping mock ↔ Gemini ↔ OpenAI changes nothing above this file.
 */
export const REPORT_SCHEMA_VERSION = "nw09.career-intelligence.v1" as const;
export const PROMPT_VERSION = "nw09.career-intelligence.prompt.v1" as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const list = (max: number, itemMax: number) => z.array(text(itemMax)).max(max);

export const COUNSELLOR_FLAG_CODES = [
  "verify_profile_fact",
  "conflicting_preferences",
  "budget_constraint",
  "minor_student",
  "limited_evidence",
  "education_requirement_unclear",
  "student_text_contained_instructions",
  "removed_unsupported_claim",
  "other",
] as const;

export const SUITABILITY = ["worth_discussing", "possible_fit", "weak_fit"] as const;
export const SUITABILITY_LABELS: Record<(typeof SUITABILITY)[number], string> = {
  worth_discussing: "Worth discussing",
  possible_fit: "Possible fit",
  weak_fit: "Weak fit — keep in view",
};

export function buildModelOutputSchema(candidateRefs: readonly string[]) {
  if (candidateRefs.length === 0) throw new Error("At least one candidate reference is required.");
  const ref = z.enum(candidateRefs as [string, ...string[]]);
  const career = z.object({
    candidateRef: ref,
    suitability: z.enum(SUITABILITY),
    fitExplanation: text(900),
    supportingEvidence: list(6, 240).min(1),
    alignedInterests: list(8, 80),
    skillsDemonstrated: list(8, 80),
    skillGaps: list(8, 140),
    unmetRequirements: list(6, 200),
    educationPathways: list(5, 240),
    nextActions: list(5, 200).min(1),
    assumptionsToVerify: list(5, 200),
  });
  return z.object({
    outcome: z.enum(["recommendations", "insufficient_data"]),
    overview: text(1200),
    careers: z.array(career).max(candidateRefs.length),
    missingInformation: list(8, 200),
    followUpQuestions: list(6, 200),
    uncertainties: list(6, 240),
    counsellorFlags: z.array(z.object({ code: z.enum(COUNSELLOR_FLAG_CODES), note: text(240) })).max(8),
  });
}
export type ModelOutput = z.infer<ReturnType<typeof buildModelOutputSchema>>;

const reportCareer = z.object({
  careerId: z.string().min(1),
  careerKey: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  familyName: z.string(),
  /** Deterministic engine output — a heuristic estimate, never a percentage. */
  matchBand: z.enum(["strong_match", "promising_match", "worth_exploring", "limited_evidence"]),
  evidenceLevel: z.enum(["high", "moderate", "low"]),
  engineReasons: z.array(z.string()),
  engineGaps: z.array(z.string()),
  catalogueEducationRoutes: z.array(z.string()),
  suitability: z.enum(SUITABILITY),
  fitExplanation: z.string(),
  supportingEvidence: z.array(z.string()),
  alignedInterests: z.array(z.string()),
  skillsDemonstrated: z.array(z.string()),
  skillGaps: z.array(z.string()),
  unmetRequirements: z.array(z.string()),
  educationPathways: z.array(z.string()),
  nextActions: z.array(z.string()),
  assumptionsToVerify: z.array(z.string()),
  sourceRefs: z.array(z.object({ type: z.literal("career_catalogue"), careerId: z.string(), slug: z.string() })),
});

export const CareerIntelligenceReportSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  /** Internal reference to the student (never sent to a provider). */
  studentProfileRef: z.object({ studentUserId: z.string(), profileFingerprint: z.string() }),
  outcome: z.enum(["recommendations", "insufficient_data"]),
  overview: z.string(),
  careers: z.array(reportCareer),
  missingInformation: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  uncertainties: z.array(z.string()),
  counsellorFlags: z.array(z.object({ code: z.enum(COUNSELLOR_FLAG_CODES), note: z.string() })),
  sources: z.array(z.object({ type: z.enum(["career_catalogue", "student_profile", "matching_engine"]), detail: z.string() })),
  /** University/course matching is deliberately NOT part of v1 (see docs/milestones/NW09). */
  courseRecommendations: z.object({ status: z.literal("not_included"), reason: z.string() }),
  generation: z.object({
    provider: z.enum(["mock", "gemini", "openai"]),
    model: z.string(),
    promptVersion: z.literal(PROMPT_VERSION),
    matchingEngine: z.literal("m5-deterministic"),
    dataClass: z.enum(["fictional", "real_student"]),
    candidateCount: z.number().int().min(0),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    estimatedCostUsd: z.number().min(0),
    attempts: z.number().int().min(0),
    latencyMs: z.number().int().min(0),
    generatedAt: z.string(),
  }),
});
export type CareerIntelligenceReport = z.infer<typeof CareerIntelligenceReportSchema>;
