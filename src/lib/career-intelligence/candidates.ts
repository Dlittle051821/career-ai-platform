import type { CareerMatchProfile } from "@/types/career";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import { getRecommendations, MATCH_BAND_LABELS, EVIDENCE_LEVEL_LABELS, type RecommendationResult } from "@/lib/recommendations";
import { cleanText, looksLikeInstruction } from "@/lib/ai/text-safety";
import { LABELS, label } from "./labels";

/**
 * NW09 — catalogue-backed candidate retrieval.
 *
 * The CANDIDATE SET is chosen deterministically by the existing, audited
 * Milestone 5 engine (src/lib/recommendations/engine.ts — subjects,
 * interests, skills, work preferences, priorities, education, mobility),
 * from the Nextwise catalogue only. The model never chooses, adds or
 * invents careers; it explains, qualifies and questions THESE. Results the
 * engine itself rates "limited evidence" are excluded. Every candidate gets
 * an opaque reference ("C1".."Cn") — the model sees that, never a database
 * id — and the server maps it back.
 *
 * Catalogue text is treated as untrusted (it can be imported/edited): it is
 * cleaned and capped, and anything that looks like an instruction to a
 * model is flagged and withheld.
 */
export const MAX_CANDIDATES = 6;

export interface Candidate {
  ref: string;
  result: RecommendationResult;
  career: CareerMatchProfile;
  educationRoutes: string[];
  /** Catalogue text withheld because it looked like an instruction. */
  catalogueTextFlagged: boolean;
}

export interface CandidatePacket {
  ref: string;
  title: string;
  family: string;
  summary: string;
  heuristicBand: string;
  evidenceCoverage: string;
  engineReasons: string[];
  engineGaps: string[];
  educationRoutes: string[];
  minimumEducation: string | null;
}

function humanise(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function describeRoute(route: CareerMatchProfile["educationRoutes"][number]): string {
  const level = label(LABELS.educationLevel, route.educationLevel) ?? humanise(route.educationLevel);
  const field = label(LABELS.field, route.fieldKey) ?? humanise(route.fieldKey);
  const relevance = route.relevance === "primary" ? "most common route" : route.relevance === "common" ? "common route" : "alternative route";
  return `${level} — ${field} (${relevance})`;
}

export function selectCandidates(snapshot: StudentProfileSnapshot, catalogue: CareerMatchProfile[], limit = MAX_CANDIDATES): Candidate[] {
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  // Score the WHOLE catalogue: the engine's own order is by raw score, which
  // can rank a low-evidence match (few overlapping answers) above a strong,
  // well-evidenced one — so the candidate set must not be cut by that order.
  const { results } = getRecommendations(snapshot, catalogue, catalogue.length);
  // Strongest evidence first: the engine's band, then how much of the
  // profile the match rests on (coverage), then the engine's score.
  const bandRank: Record<string, number> = { strong_match: 0, promising_match: 1, worth_exploring: 2 };
  return results
    .filter((r) => r.matchBand !== "limited_evidence" && byId.has(r.careerId))
    .sort(
      (a, b) =>
        (bandRank[a.matchBand] ?? 9) - (bandRank[b.matchBand] ?? 9) ||
        b.internalEvidenceCoverage - a.internalEvidenceCoverage ||
        b.internalScore - a.internalScore ||
        a.careerId.localeCompare(b.careerId),
    )
    .slice(0, limit)
    .map((result, i) => {
      const career = byId.get(result.careerId)!;
      const summary = career.summary ?? "";
      return {
        ref: `C${i + 1}`,
        result,
        career,
        educationRoutes: career.educationRoutes.slice(0, 4).map(describeRoute),
        catalogueTextFlagged: looksLikeInstruction(summary) || looksLikeInstruction(career.title),
      };
    });
}

export function toPacket(c: Candidate): CandidatePacket {
  return {
    ref: c.ref,
    title: cleanText(c.career.title, 100),
    family: cleanText(c.career.familyName, 80),
    summary: c.catalogueTextFlagged ? "(catalogue summary withheld for review)" : cleanText(c.career.summary, 320),
    heuristicBand: MATCH_BAND_LABELS[c.result.matchBand],
    evidenceCoverage: EVIDENCE_LEVEL_LABELS[c.result.evidenceLevel],
    engineReasons: c.result.reasons.slice(0, 6).map((r) => cleanText(r.label, 160)),
    engineGaps: c.result.gaps.slice(0, 5).map((g) => cleanText(g.label, 160)),
    educationRoutes: c.educationRoutes,
    minimumEducation: c.career.minimumEducationKey ? (label(LABELS.educationLevel, c.career.minimumEducationKey) ?? humanise(c.career.minimumEducationKey)) : null,
  };
}
