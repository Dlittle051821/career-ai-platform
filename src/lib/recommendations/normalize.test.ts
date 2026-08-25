import { describe, it, expect } from "vitest";
import { hasMinimumProfileDataForRecommendations, normalizeStudentProfile } from "./normalize";
import { buildSnapshot, subjectStrength, interest, skill } from "./fixtures.test-helpers";

describe("hasMinimumProfileDataForRecommendations", () => {
  it("is false for a completely empty snapshot", () => {
    expect(hasMinimumProfileDataForRecommendations(buildSnapshot())).toBe(false);
  });

  it("is false with only one core signal category filled in", () => {
    const snapshot = buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 5)] });
    expect(hasMinimumProfileDataForRecommendations(snapshot)).toBe(false);
  });

  it("is true once at least two of the five core categories have data", () => {
    const snapshot = buildSnapshot({
      subjectStrengths: [subjectStrength("mathematics", 5)],
      interests: [interest("programming", 4)],
    });
    expect(hasMinimumProfileDataForRecommendations(snapshot)).toBe(true);
  });
});

describe("normalizeStudentProfile", () => {
  it("picks the most-advanced education level when multiple records exist", () => {
    const snapshot = buildSnapshot({
      education: [
        { id: "e1", educationLevel: "class_12", institutionName: null, boardOrUniversity: null, fieldOfStudy: null, specialization: null, startYear: null, endYear: null, status: "completed", scoreType: null, scoreValue: null, backlogs: null },
        { id: "e2", educationLevel: "bachelors", institutionName: null, boardOrUniversity: null, fieldOfStudy: null, specialization: null, startYear: null, endYear: null, status: "ongoing", scoreType: null, scoreValue: null, backlogs: null },
      ],
    });
    expect(normalizeStudentProfile(snapshot).educationLevel).toBe("bachelors");
  });

  it("does not mutate the snapshot it normalizes", () => {
    const snapshot = buildSnapshot({
      subjectStrengths: [subjectStrength("mathematics", 5)],
      interests: [interest("programming", 4)],
      skills: [skill("programming", "advanced")],
    });
    const before = JSON.parse(JSON.stringify(snapshot));
    normalizeStudentProfile(snapshot);
    expect(snapshot).toEqual(before);
  });

  it("returns null educationLevel and empty maps for an empty snapshot, without throwing", () => {
    const normalized = normalizeStudentProfile(buildSnapshot());
    expect(normalized.educationLevel).toBeNull();
    expect(normalized.subjectStrengthByKey.size).toBe(0);
    expect(normalized.interestStrengthByKey.size).toBe(0);
    expect(normalized.skillLevelByKey.size).toBe(0);
  });
});
