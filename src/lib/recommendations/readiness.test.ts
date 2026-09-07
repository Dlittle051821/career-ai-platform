import { describe, expect, it } from "vitest";
import { calculateCompletion } from "@/lib/profile/completion";
import { computeAllRecommendationReadiness, computeRecommendationReadiness, type RecommendationVerificationOverride } from "./readiness";
import { RECOMMENDATION_TYPES } from "@/types/recommendation-readiness";
import type { ProfileSectionKey, SectionProvenance } from "@/types/profile-provenance";
import { buildSnapshot, studentProfile, subjectStrength, interest, skill, fullWorkPreferences, partialCareerPriorities, educationRecord, studyPreferences } from "./fixtures.test-helpers";

/** Builds a Milestone-11-C section-provenance map with COUNSELLOR_VERIFIED for exactly the given keys, SELF_ENTERED (the real default) for everything else — mirrors the shape getSectionProvenanceMap()/getMySectionProvenanceMap() actually return. */
function provenanceMap(verifiedKeys: ProfileSectionKey[]): Partial<Record<ProfileSectionKey, SectionProvenance>> {
  const result: Partial<Record<ProfileSectionKey, SectionProvenance>> = {};
  for (const key of verifiedKeys) {
    result[key] = {
      sectionKey: key,
      provenance: "COUNSELLOR_VERIFIED",
      verifiedByCounsellorId: "counsellor-1",
      verifiedByCounsellorName: "Priya Sharma",
      verifiedAt: "2026-01-01T00:00:00.000Z",
      lastUpdatedBy: "counsellor-1",
      note: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }
  return result;
}

const EMPTY_SNAPSHOT = buildSnapshot();

const CAREER_SECTIONS_ONLY_SNAPSHOT = buildSnapshot({
  profile: studentProfile({ currentStatus: "school_12" }),
  subjectStrengths: [subjectStrength("mathematics", 4), subjectStrength("physics", 4), subjectStrength("chemistry", 3)],
  interests: [interest("programming"), interest("ai_data"), interest("design")],
  skills: [skill("programming", "intermediate"), skill("problem_solving", "advanced")],
  workPreferences: fullWorkPreferences(),
  careerPriorities: partialCareerPriorities({ high_salary: 5, remote_work: 4, job_security: 4, work_life_balance: 3, growth_opportunities: 4 }),
  careerGoals: { clarity: "not_sure", dreamJobTitle: null, dreamIndustry: null, dreamReason: null, careerIdeas: [], lifeGoalsText: null },
});

const FULLY_COMPLETE_SNAPSHOT = buildSnapshot({
  ...CAREER_SECTIONS_ONLY_SNAPSHOT,
  education: [educationRecord()],
  studyPreferences: studyPreferences({ studyFurther: "yes", studyAbroad: "maybe", relocateWithinIndia: "yes", relocateInternational: "no" }),
  fundingPreferences: { budgetBand: "10_20l", fundingSource: "family_self_funded", loanOpenness: "yes" },
});

describe("recommendations/readiness", () => {
  describe("computeRecommendationReadiness", () => {
    it("is NOT_READY / LOW for every type on a completely empty profile", () => {
      const completion = calculateCompletion(EMPTY_SNAPSHOT);
      for (const type of RECOMMENDATION_TYPES) {
        const readiness = computeRecommendationReadiness(type, completion);
        expect(readiness.level).toBe("NOT_READY");
        expect(readiness.confidence).toBe("LOW");
        expect(readiness.relevantCompletionPercent).toBe(0);
        expect(readiness.missingSectionKeys.length).toBeGreaterThan(0);
      }
    });

    it("differentiates readiness by type when only career-relevant sections are filled", () => {
      const completion = calculateCompletion(CAREER_SECTIONS_ONLY_SNAPSHOT);

      const career = computeRecommendationReadiness("career", completion);
      expect(career.level).toBe("READY");
      expect(career.confidence).toBe("HIGH");
      expect(career.relevantCompletionPercent).toBe(100);
      expect(career.missingSectionKeys).toEqual([]);

      const course = computeRecommendationReadiness("course", completion);
      expect(course.level).toBe("PRELIMINARY");
      expect(course.confidence).toBe("MEDIUM");
      expect(course.missingSectionKeys).toEqual(expect.arrayContaining(["education", "study_location"]));

      const college = computeRecommendationReadiness("college", completion);
      expect(college.level).toBe("NOT_READY");
      expect(college.confidence).toBe("LOW");

      const pathway = computeRecommendationReadiness("pathway", completion);
      expect(pathway.level).toBe("PRELIMINARY");
      expect(pathway.confidence).toBe("MEDIUM");
    });

    it("is READY / HIGH for every type on a fully-complete profile (regression guard against an empty/zero-weight RELEVANT_SECTION_KEYS entry)", () => {
      const completion = calculateCompletion(FULLY_COMPLETE_SNAPSHOT);
      for (const type of RECOMMENDATION_TYPES) {
        const readiness = computeRecommendationReadiness(type, completion);
        expect(readiness.level).toBe("READY");
        expect(readiness.confidence).toBe("HIGH");
        expect(readiness.relevantCompletionPercent).toBe(100);
        expect(readiness.missingSectionKeys).toEqual([]);
      }
    });

    it("a counsellor override always wins as COUNSELLOR_VERIFIED / HIGH, even over an empty profile", () => {
      const completion = calculateCompletion(EMPTY_SNAPSHOT);
      const override: RecommendationVerificationOverride = {
        verifiedByCounsellorId: "counsellor-1",
        verifiedByCounsellorName: "Priya Sharma",
        verifiedAt: "2026-01-01T00:00:00.000Z",
        note: "Discussed in session",
      };
      const readiness = computeRecommendationReadiness("course", completion, override);
      expect(readiness.level).toBe("COUNSELLOR_VERIFIED");
      expect(readiness.confidence).toBe("HIGH");
      expect(readiness.verifiedByCounsellorId).toBe("counsellor-1");
      expect(readiness.verifiedByCounsellorName).toBe("Priya Sharma");
      expect(readiness.verifiedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(readiness.note).toBe("Discussed in session");
      // The override does not change the underlying completion math — it
      // only overrides level/confidence, so callers can still show "why".
      expect(readiness.relevantCompletionPercent).toBe(0);
    });

    it("exposes a plain-language next action for every missing relevant section, in the same order as missingSectionKeys", () => {
      const completion = calculateCompletion(EMPTY_SNAPSHOT);
      const readiness = computeRecommendationReadiness("college", completion);
      expect(readiness.nextActions).toHaveLength(readiness.missingSectionKeys.length);
      expect(readiness.missingSectionKeys).toContain("study_location");
      const studyLocationIndex = readiness.missingSectionKeys.indexOf("study_location");
      expect(readiness.nextActions[studyLocationIndex]).toBe("Tell us whether you prefer India, abroad, or both.");
      expect(readiness.relevantSectionCount).toBeGreaterThan(0);
    });

    it("is an empty array when nothing relevant is missing", () => {
      const completion = calculateCompletion(FULLY_COMPLETE_SNAPSHOT);
      const readiness = computeRecommendationReadiness("career", completion);
      expect(readiness.nextActions).toEqual([]);
    });

    it("Milestone 11-C: counsellor-verified section provenance raises confidence one tier (never level) when at least half of the relevant sections are verified", () => {
      const completion = calculateCompletion(CAREER_SECTIONS_ONLY_SNAPSHOT);
      // course's relevant sections are about_you/education/subject_strengths/career_goals/study_location;
      // about_you, subject_strengths, and career_goals are already complete on this fixture (3 of 5 = 60%).
      const verified = provenanceMap(["about_you", "subject_strengths", "career_goals"]);

      const withoutProvenance = computeRecommendationReadiness("course", completion);
      expect(withoutProvenance.level).toBe("PRELIMINARY");
      expect(withoutProvenance.confidence).toBe("MEDIUM");

      const withProvenance = computeRecommendationReadiness("course", completion, null, verified);
      expect(withProvenance.level).toBe("PRELIMINARY"); // unchanged — verification never moves the level
      expect(withProvenance.confidence).toBe("HIGH"); // bumped one tier: MEDIUM -> HIGH
      expect(withProvenance.verifiedRelevantSectionCount).toBe(3);
      expect(withProvenance.relevantSectionCount).toBe(5);
    });

    it("Milestone 11-C: verified provenance alone does NOT force NOT_READY to READY, even if every relevant section (however empty) is marked verified", () => {
      const completion = calculateCompletion(EMPTY_SNAPSHOT);
      const collegeKeys: ProfileSectionKey[] = ["about_you", "education", "study_location", "budget_funding"];
      const readiness = computeRecommendationReadiness("college", completion, null, provenanceMap(collegeKeys));

      expect(readiness.level).toBe("NOT_READY"); // the data still isn't there — provenance can't manufacture it
      expect(readiness.confidence).toBe("MEDIUM"); // LOW -> MEDIUM, one tier, same rule as any other case
      expect(readiness.relevantCompletionPercent).toBe(0);
    });

    it("Milestone 11-C: a below-threshold share of verified sections does not move confidence at all", () => {
      const completion = calculateCompletion(CAREER_SECTIONS_ONLY_SNAPSHOT);
      // Only 1 of course's 5 relevant sections verified (20%, below the 50% threshold).
      const readiness = computeRecommendationReadiness("course", completion, null, provenanceMap(["about_you"]));
      expect(readiness.confidence).toBe("MEDIUM"); // unchanged from the no-provenance case
    });
  });

  describe("computeAllRecommendationReadiness", () => {
    it("returns all four types, applying an override only to the type it targets", () => {
      const completion = calculateCompletion(EMPTY_SNAPSHOT);
      const override: RecommendationVerificationOverride = {
        verifiedByCounsellorId: "counsellor-1",
        verifiedByCounsellorName: null,
        verifiedAt: "2026-01-01T00:00:00.000Z",
        note: null,
      };
      const result = computeAllRecommendationReadiness(completion, { career: override });

      expect(Object.keys(result).sort()).toEqual([...RECOMMENDATION_TYPES].sort());
      expect(result.career.level).toBe("COUNSELLOR_VERIFIED");
      expect(result.course.level).toBe("NOT_READY");
      expect(result.college.level).toBe("NOT_READY");
      expect(result.pathway.level).toBe("NOT_READY");
    });
  });
});
