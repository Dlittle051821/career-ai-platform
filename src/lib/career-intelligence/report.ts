import type { AiDataClass, AiProviderName, AiUsage } from "@/lib/ai/types";
import type { RecommendationDraftContent } from "@/lib/recommendations/drafts";
import type { Candidate } from "./candidates";
import { screenList, screenText, type ScreenTally } from "./claims";
import { CareerIntelligenceReportSchema, PROMPT_VERSION, REPORT_SCHEMA_VERSION, SUITABILITY_LABELS, type CareerIntelligenceReport, type ModelOutput } from "./schema";

/**
 * NW09 — assemble the stored report from (a) the validated model output and
 * (b) OUR catalogue records. Career ids, keys, slugs, titles, families,
 * heuristic bands and catalogue education routes all come from the
 * deterministic candidate list; the model contributes only explanatory
 * text, which is screened (claims.ts). A model reference that does not map
 * to a candidate is impossible by schema, and duplicates are dropped here.
 * The result is validated against CareerIntelligenceReportSchema again.
 */
export interface GenerationMeta {
  provider: AiProviderName;
  model: string;
  dataClass: AiDataClass;
  usage: AiUsage | null;
  estimatedCostUsd: number;
  attempts: number;
  latencyMs: number;
  generatedAt: Date;
}

/** Small, stable FNV-1a fingerprint of the minimised profile (lets a counsellor see whether the profile changed since the analysis). */
export function fingerprint(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function assembleReport(
  output: ModelOutput,
  candidates: Candidate[],
  meta: GenerationMeta,
  ctx: { studentUserId: string; profileFingerprint: string; extraFlags: Array<{ code: CareerIntelligenceReport["counsellorFlags"][number]["code"]; note: string }> },
): CareerIntelligenceReport {
  const byRef = new Map(candidates.map((c) => [c.ref, c]));
  const tally: ScreenTally = { removed: 0, reasons: new Set() };
  const seen = new Set<string>();
  const careers: CareerIntelligenceReport["careers"] = [];
  for (const a of output.careers) {
    const c = byRef.get(a.candidateRef);
    if (!c || seen.has(a.candidateRef)) continue;
    seen.add(a.candidateRef);
    careers.push({
      careerId: c.career.id,
      careerKey: c.career.careerKey,
      slug: c.career.slug,
      title: c.career.title,
      familyName: c.career.familyName,
      matchBand: c.result.matchBand,
      evidenceLevel: c.result.evidenceLevel,
      engineReasons: c.result.reasons.map((r) => r.label),
      engineGaps: c.result.gaps.map((g) => g.label),
      catalogueEducationRoutes: c.educationRoutes,
      suitability: a.suitability,
      fitExplanation: screenText(a.fitExplanation, tally) || "(The explanation contained unverified claims and was removed — please write your own.)",
      supportingEvidence: screenList(a.supportingEvidence, tally),
      alignedInterests: screenList(a.alignedInterests, tally),
      skillsDemonstrated: screenList(a.skillsDemonstrated, tally),
      skillGaps: screenList(a.skillGaps, tally),
      unmetRequirements: screenList(a.unmetRequirements, tally),
      educationPathways: screenList(a.educationPathways, tally),
      nextActions: screenList(a.nextActions, tally),
      assumptionsToVerify: screenList(a.assumptionsToVerify, tally),
      sourceRefs: [{ type: "career_catalogue", careerId: c.career.id, slug: c.career.slug }],
    });
  }
  const flags = [...output.counsellorFlags.map((f) => ({ code: f.code, note: screenText(f.note, tally) || "(note removed)" })), ...ctx.extraFlags];
  const report: CareerIntelligenceReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    studentProfileRef: { studentUserId: ctx.studentUserId, profileFingerprint: ctx.profileFingerprint },
    outcome: careers.length > 0 ? output.outcome : "insufficient_data",
    overview: screenText(output.overview, tally) || "(Overview removed — it contained unverified claims.)",
    careers,
    missingInformation: screenList(output.missingInformation, tally),
    followUpQuestions: screenList(output.followUpQuestions, tally),
    uncertainties: screenList(output.uncertainties, tally),
    counsellorFlags:
      tally.removed > 0
        ? [...flags, { code: "removed_unsupported_claim", note: `${tally.removed} sentence(s) removed automatically (${[...tally.reasons].join(", ")}). Check the explanations before approving.` }]
        : flags,
    sources: [
      { type: "career_catalogue", detail: `${careers.length} career(s) from the Nextwise career catalogue (ids recorded per career).` },
      { type: "matching_engine", detail: "Candidates selected and banded by the deterministic Milestone 5 matching engine (heuristic, not a measurement)." },
      { type: "student_profile", detail: "Minimised student profile: stage, age group, education levels/fields, subjects, interests, skills, preferences, goals, study and budget preferences, experience titles." },
    ],
    courseRecommendations: {
      status: "not_included",
      reason: "University and course suggestions are not generated in this version: only verified, published education records may be recommended, and course matching is a later phase. Pathways are described generally and must be verified by the counsellor.",
    },
    generation: {
      provider: meta.provider,
      model: meta.model,
      promptVersion: PROMPT_VERSION,
      matchingEngine: "m5-deterministic",
      dataClass: meta.dataClass,
      candidateCount: candidates.length,
      inputTokens: meta.usage?.inputTokens ?? 0,
      outputTokens: meta.usage?.outputTokens ?? 0,
      estimatedCostUsd: meta.estimatedCostUsd,
      attempts: meta.attempts,
      latencyMs: Math.max(0, Math.round(meta.latencyMs)),
      generatedAt: meta.generatedAt.toISOString(),
    },
  };
  return CareerIntelligenceReportSchema.parse(report);
}

const bullet = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

/**
 * The STUDENT-FACING first draft, in the existing NW07 content shape, so the
 * Counsellor Studio editor and the Student Studio report page need no
 * changes to show it. Internal material (flags, assumptions to verify,
 * engine scores) is NOT copied here — it stays on the staff-only run record.
 * The counsellor edits this, then the normal review → approve → release
 * workflow applies.
 */
export function toDraftContent(report: CareerIntelligenceReport): RecommendationDraftContent {
  const careers = report.careers
    .map((c, i) => {
      const parts = [`${i + 1}. ${c.title} — ${SUITABILITY_LABELS[c.suitability]}`, `Why it may suit you: ${c.fitExplanation}`];
      if (c.skillsDemonstrated.length) parts.push(`What you already bring:\n${bullet(c.skillsDemonstrated)}`);
      if (c.skillGaps.length) parts.push(`Skills worth building:\n${bullet(c.skillGaps)}`);
      if (c.nextActions.length) parts.push(`Next steps:\n${bullet(c.nextActions)}`);
      return parts.join("\n");
    })
    .join("\n\n");
  const pathways = report.careers
    .filter((c) => c.educationPathways.length || c.catalogueEducationRoutes.length)
    .map((c) => `${c.title}:\n${bullet(c.educationPathways.length ? c.educationPathways : c.catalogueEducationRoutes)}`)
    .join("\n\n");
  const caveat =
    "These suggestions are a starting point for a conversation with your counsellor. They are based on what you told us and are not a guarantee of admission, employment or income. Specific courses and universities must be checked with your counsellor.";
  const open = report.followUpQuestions.length ? `\n\nTo make this more useful, we would like to know:\n${bullet(report.followUpQuestions)}` : "";
  return {
    summary: `${report.overview}\n\n${caveat}${open}`,
    careerGuidance: careers || undefined,
    pathwayGuidance: pathways || undefined,
    aiAssisted: true,
  };
}
