import type { StudentProfileSnapshot } from "@/types/student-profile";
import { PROFILE_SECTION_KEYS, PROFILE_SECTION_LABELS, type ProfileSectionKey, type ProvenanceValue } from "@/types/profile-provenance";
import { calculateCompletion } from "@/lib/profile/completion";
import type { CareerIntelligenceReport } from "./schema";

/**
 * NW09.2 — classify every profile section the analysis uses, from the
 * EXISTING section-level provenance system (Milestone 11-C1,
 * student_profile_section_provenance) and the existing completion rules
 * (src/lib/profile/completion.ts). Deterministic; no AI.
 *
 *   source        student      — self-entered (the default when no provenance row exists)
 *                 counsellor   — entered by a counsellor (COUNSELLOR_ENTERED / COUNSELLOR_VERIFIED)
 *                 none         — the section is empty
 *   verification  verified     — a counsellor verified it (COUNSELLOR_VERIFIED)
 *                 unverified   — provided but not verified
 *                 missing      — the section is empty
 *   completeness  complete / partial / missing — the profile's own completion rules
 *
 * The classification is sent to the model with the profile (so it can weigh
 * unverified or missing inputs) and stored on the report for the counsellor.
 * When provenance could not be read, every provided section is treated as
 * student-provided and unverified — the safe assumption.
 */
export type InputProvenance = CareerIntelligenceReport["inputProvenance"][number];

export function sectionHasData(snapshot: StudentProfileSnapshot, key: ProfileSectionKey): boolean {
  const g = snapshot.careerGoals;
  const s = snapshot.studyPreferences;
  const f = snapshot.fundingPreferences;
  switch (key) {
    case "about_you":
      return Boolean(snapshot.profile.currentStatus || snapshot.profile.dateOfBirth);
    case "education":
      return snapshot.education.length > 0;
    case "subject_strengths":
      return snapshot.subjectStrengths.length > 0;
    case "interests":
      return snapshot.interests.length > 0;
    case "skills":
      return snapshot.skills.length > 0;
    case "work_preferences":
      return snapshot.workPreferences.length > 0;
    case "career_priorities":
      return snapshot.careerPriorities.length > 0;
    case "career_goals":
      return Boolean(g && (g.clarity || g.dreamJobTitle || g.dreamIndustry || g.dreamReason || g.careerIdeas.length > 0 || g.lifeGoalsText));
    case "study_location":
      return Boolean(s && (s.studyFurther || s.studyAbroad || s.preferredStudyDestinations.length > 0 || s.relocateWithinIndia || s.relocateInternational));
    case "budget_funding":
      return Boolean(f && (f.budgetBand || f.fundingSource || f.loanOpenness));
    case "experience":
      return snapshot.experience.length > 0;
  }
}

export function classifyInputs(snapshot: StudentProfileSnapshot, provenance: Partial<Record<ProfileSectionKey, ProvenanceValue>> | null): InputProvenance[] {
  const completion = new Map(calculateCompletion(snapshot).sections.map((s) => [s.key, s.complete]));
  return PROFILE_SECTION_KEYS.map((key) => {
    const has = sectionHasData(snapshot, key);
    const p = provenance?.[key] ?? "SELF_ENTERED";
    if (!has) return { section: key, label: PROFILE_SECTION_LABELS[key], source: "none", verification: "missing", completeness: "missing" };
    return {
      section: key,
      label: PROFILE_SECTION_LABELS[key],
      source: p === "COUNSELLOR_ENTERED" || p === "COUNSELLOR_VERIFIED" ? "counsellor" : "student",
      verification: p === "COUNSELLOR_VERIFIED" ? "verified" : "unverified",
      completeness: completion.get(key) ? "complete" : "partial",
    };
  });
}

export const INPUT_SOURCE_LABELS: Record<InputProvenance["source"], string> = { student: "Student provided", counsellor: "Counsellor entered", none: "Not provided" };
export const INPUT_VERIFICATION_LABELS: Record<InputProvenance["verification"], string> = { verified: "Verified", unverified: "Unverified", missing: "Missing" };

/** The compact form sent to the model: label → reliability (no ids, no names). */
export function provenanceForPrompt(inputs: InputProvenance[]): Array<{ section: string; reliability: string }> {
  return inputs.map((i) => ({
    section: i.label,
    reliability:
      i.verification === "missing"
        ? "missing — not provided"
        : `${i.source === "counsellor" ? "entered by counsellor" : "self-reported by student"}, ${i.verification}${i.completeness === "partial" ? ", partially completed" : ""}`,
  }));
}
