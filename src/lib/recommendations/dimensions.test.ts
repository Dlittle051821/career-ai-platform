import { describe, it, expect } from "vitest";
import { normalizeStudentProfile } from "./normalize";
import { scoreSubjects } from "./dimensions";
import { buildSnapshot, buildCareer, subjectStrength } from "./fixtures.test-helpers";
import { BELOW_MINIMUM_FIT_CAP } from "./weights";

describe("scoreSubjects — importance weighting", () => {
  it("weights a higher-importance subject more heavily than a lower-importance one", () => {
    // Student is strong (5/5) in the high-importance subject and weak (1/5) in the low-importance one.
    const student = normalizeStudentProfile(
      buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 5), subjectStrength("history", 1)] })
    );
    const careerFavoringMath = buildCareer({
      subjects: [
        { subjectKey: "mathematics", importance: 5, minimumStrength: null },
        { subjectKey: "history", importance: 1, minimumStrength: null },
      ],
    });
    const careerFavoringHistory = buildCareer({
      subjects: [
        { subjectKey: "mathematics", importance: 1, minimumStrength: null },
        { subjectKey: "history", importance: 5, minimumStrength: null },
      ],
    });

    const scoreMathHeavy = scoreSubjects(student, careerFavoringMath).rawScore;
    const scoreHistoryHeavy = scoreSubjects(student, careerFavoringHistory).rawScore;

    // Same two ratings, same two requirement keys — only which one carries more importance differs.
    expect(scoreMathHeavy).toBeGreaterThan(scoreHistoryHeavy);
  });

  it("never mutates the career or student inputs it's given", () => {
    const snapshot = buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 5)] });
    const student = normalizeStudentProfile(snapshot);
    const career = buildCareer({ subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: 3 }] });
    const careerBefore = JSON.parse(JSON.stringify(career));

    scoreSubjects(student, career);

    expect(career).toEqual(careerBefore);
  });
});

describe("scoreSubjects — student strength vs. career minimum strength", () => {
  it("caps fit when the student's rating is below the career's minimum, but doesn't zero it out", () => {
    const student = normalizeStudentProfile(buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 3)] }));
    const career = buildCareer({ subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: 4 }] });

    const result = scoreSubjects(student, career);

    expect(result.hasEvidence).toBe(true);
    expect(result.rawScore).toBeLessThanOrEqual(BELOW_MINIMUM_FIT_CAP);
    expect(result.rawScore).toBeGreaterThan(0);
    // A below-minimum subject should always be surfaced as a matched reason (even if a lukewarm one), not silently dropped.
    expect(result.reasons.some((r) => r.key === "mathematics")).toBe(true);
  });

  it("does not cap fit when the student meets or exceeds the minimum", () => {
    const student = normalizeStudentProfile(buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 5)] }));
    const career = buildCareer({ subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: 4 }] });

    const result = scoreSubjects(student, career);

    expect(result.rawScore).toBe(1);
  });

  it("treats a subject the student hasn't rated as missing evidence, not a penalty — it's excluded, not scored as 0", () => {
    const student = normalizeStudentProfile(buildSnapshot());
    const career = buildCareer({
      subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: 4 }],
    });

    const result = scoreSubjects(student, career);

    expect(result.hasEvidence).toBe(false);
    expect(result.evidenceStrength).toBe(0);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it("produces no NaN or out-of-range scores for a career with no subject requirements at all", () => {
    const student = normalizeStudentProfile(buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 5)] }));
    const career = buildCareer({ subjects: [] });

    const result = scoreSubjects(student, career);

    expect(Number.isNaN(result.rawScore)).toBe(false);
    expect(result.rawScore).toBeGreaterThanOrEqual(0);
    expect(result.rawScore).toBeLessThanOrEqual(1);
    expect(result.hasEvidence).toBe(false);
  });
});
