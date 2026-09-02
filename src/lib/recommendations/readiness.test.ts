import { describe, expect, it } from "vitest";
import { calculateCompletion } from "@/lib/profile/completion";
import { computeAllRecommendationReadiness, computeRecommendationReadiness, type RecommendationVerificationOverride } from "./readiness";
import { RECOMMENDATION_TYPES } from "@/types/recommendation-readiness";
import { buildSnapshot, studentProfile, subjectStrength, interest, skill, fullWorkPreferences, partialCareerPriorities, educationRecord, studyPreferences } from "./fixtures.test-helpers";

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
