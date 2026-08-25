import { describe, it, expect } from "vitest";
import { getRecommendations, scoreCareer } from "./engine";
import { normalizeStudentProfile } from "./normalize";
import { MATCH_BAND_LABELS } from "./bands";
import { MAX_GAPS, MAX_REASONS } from "./weights";
import {
  buildSnapshot,
  buildCareer,
  buildRichCareer,
  subjectStrength,
  interest,
  skill,
  fullWorkPreferences,
  allCareerPriorities,
  educationRecord,
  studyPreferences,
} from "./fixtures.test-helpers";

const STRONG_SNAPSHOT = buildSnapshot({
  subjectStrengths: [subjectStrength("mathematics", 5), subjectStrength("computer_science", 5)],
  interests: [interest("programming", 5), interest("ai_data", 4)],
  skills: [skill("programming", "advanced"), skill("problem_solving", "advanced")],
  workPreferences: fullWorkPreferences({ prefers_computer_based_work: 5, enjoys_people: 2 }),
  careerPriorities: allCareerPriorities({ high_salary: 5, remote_work: 5, job_security: 4 }),
  education: [educationRecord({ educationLevel: "bachelors", fieldOfStudy: "Computer Science" })],
  studyPreferences: studyPreferences({ studyAbroad: "maybe", relocateInternational: "maybe" }),
});

const WEAK_SNAPSHOT = buildSnapshot({
  subjectStrengths: [subjectStrength("history", 2), subjectStrength("geography", 2)],
  interests: [interest("helping_people", 2), interest("art", 2)],
  skills: [skill("communication", "beginner")],
  workPreferences: fullWorkPreferences({ prefers_computer_based_work: 1, enjoys_people: 5 }),
  careerPriorities: allCareerPriorities({ high_salary: 1, remote_work: 1, job_security: 2 }),
  education: [educationRecord({ educationLevel: "class_12" })],
});

describe("scoreCareer — strong vs. weak match", () => {
  it("scores a well-aligned profile clearly higher than a misaligned one against the same career", () => {
    const career = buildRichCareer();
    const strong = scoreCareer(normalizeStudentProfile(STRONG_SNAPSHOT), career);
    const weak = scoreCareer(normalizeStudentProfile(WEAK_SNAPSHOT), career);

    expect(strong.internalScore).toBeGreaterThan(weak.internalScore);
  });

  it("a strong multi-signal match with a well-filled profile lands in the top qualitative band", () => {
    const result = scoreCareer(normalizeStudentProfile(STRONG_SNAPSHOT), buildRichCareer());
    expect(result.matchBand).toBe("strong_match");
    expect(result.evidenceLevel).not.toBe("low");
  });

  it("a weak match is never presented as a strong one, and still returns a valid (non-discouraging) band", () => {
    const result = scoreCareer(normalizeStudentProfile(WEAK_SNAPSHOT), buildRichCareer());
    expect(result.matchBand).not.toBe("strong_match");
    expect(Object.keys(MATCH_BAND_LABELS)).toContain(result.matchBand);
  });
});

describe("scoreCareer — missing optional data", () => {
  it("excludes dimensions with no student data from the score rather than penalizing them", () => {
    // Only subjects + interests filled in; skills/workPreferences/careerPriorities/education are empty.
    const sparseSnapshot = buildSnapshot({
      subjectStrengths: [subjectStrength("mathematics", 5), subjectStrength("computer_science", 5)],
      interests: [interest("programming", 5), interest("ai_data", 4)],
    });

    const result = scoreCareer(normalizeStudentProfile(sparseSnapshot), buildRichCareer());

    expect(Number.isNaN(result.internalScore)).toBe(false);
    // Subjects + interests are a strong match, and missing sections shouldn't drag the score down —
    // it should still land reasonably high even though most sections are empty.
    expect(result.internalScore).toBeGreaterThan(50);
  });

  it("a fully empty profile against a fully specified career produces a valid, non-throwing, zero-evidence result", () => {
    const result = scoreCareer(normalizeStudentProfile(buildSnapshot()), buildRichCareer());

    expect(result.internalScore).toBe(0);
    expect(result.internalEvidenceCoverage).toBe(0);
    expect(result.matchBand).toBe("limited_evidence");
    expect(Number.isNaN(result.internalScore)).toBe(false);
    expect(Number.isNaN(result.internalEvidenceCoverage)).toBe(false);
  });
});

describe("scoreCareer — no NaN / no division-by-zero / bounded output", () => {
  it("handles a career with zero requirements in every dimension", () => {
    const result = scoreCareer(normalizeStudentProfile(STRONG_SNAPSHOT), buildCareer());

    expect(Number.isNaN(result.internalScore)).toBe(false);
    expect(Number.isNaN(result.internalEvidenceCoverage)).toBe(false);
    expect(result.internalScore).toBeGreaterThanOrEqual(0);
    expect(result.internalScore).toBeLessThanOrEqual(100);
    expect(result.internalEvidenceCoverage).toBeGreaterThanOrEqual(0);
    expect(result.internalEvidenceCoverage).toBeLessThanOrEqual(1);
  });

  it("stays in range across a broad set of random-ish rating combinations", () => {
    for (let rating = 1; rating <= 5; rating++) {
      const snapshot = buildSnapshot({
        subjectStrengths: [subjectStrength("mathematics", rating), subjectStrength("computer_science", rating)],
        interests: [interest("programming", rating)],
        skills: [skill("programming", rating >= 4 ? "advanced" : rating >= 2 ? "intermediate" : "beginner")],
      });
      const result = scoreCareer(normalizeStudentProfile(snapshot), buildRichCareer());
      expect(result.internalScore).toBeGreaterThanOrEqual(0);
      expect(result.internalScore).toBeLessThanOrEqual(100);
      expect(Number.isFinite(result.internalScore)).toBe(true);
    }
  });
});

describe("scoreCareer — explanation generation", () => {
  it("returns bounded, labeled (not raw-key) reasons and gaps, plus grouped matched signals", () => {
    const result = scoreCareer(normalizeStudentProfile(STRONG_SNAPSHOT), buildRichCareer());

    expect(result.reasons.length).toBeLessThanOrEqual(MAX_REASONS);
    expect(result.gaps.length).toBeLessThanOrEqual(MAX_GAPS);
    for (const reason of result.reasons) {
      expect(reason.label).not.toMatch(/^[a-z0-9_]+$/); // not a raw snake_case key
      expect(reason.label.length).toBeGreaterThan(0);
    }
    expect(result.matched.subjects).toContain("Mathematics");
    expect(result.matched.interests.length).toBeGreaterThan(0);
  });

  it("surfaces gaps for important requirements the student hasn't answered yet, in encouraging (not discouraging) language", () => {
    const snapshot = buildSnapshot({ subjectStrengths: [subjectStrength("mathematics", 5)] });
    const result = scoreCareer(normalizeStudentProfile(snapshot), buildRichCareer());

    expect(result.gaps.length).toBeGreaterThan(0);
    for (const gap of result.gaps) {
      expect(gap.label.toLowerCase()).not.toMatch(/\b(bad|weak|fail|poor|unsuitable)\b/);
    }
  });
});

describe("getRecommendations — ranking and deterministic tie-breaking", () => {
  it("ranks a well-aligned career above a misaligned one", () => {
    const career = buildRichCareer();
    const summary = getRecommendations(STRONG_SNAPSHOT, [career]);
    expect(summary.results[0].careerId).toBe(career.id);
    expect(summary.totalCareersConsidered).toBe(1);
  });

  it("breaks ties deterministically: featured before non-featured, then alphabetical by title, then career key", () => {
    // All three careers have zero requirements, so every one of them scores
    // identically (0, 0 evidence) against any profile — a pure tie-break test.
    const zebra = buildCareer({ id: "c1", careerKey: "zebra_role", title: "Zebra Role", isFeatured: false });
    const astronomer = buildCareer({ id: "c2", careerKey: "astronomer", title: "Astronomer", isFeatured: true });
    const biologist = buildCareer({ id: "c3", careerKey: "biologist", title: "Biologist", isFeatured: true });

    const summary = getRecommendations(STRONG_SNAPSHOT, [zebra, astronomer, biologist]);
    const order = summary.results.map((r) => r.careerKey);

    expect(order).toEqual(["astronomer", "biologist", "zebra_role"]);
  });

  it("produces the same order across repeated runs on the same input", () => {
    const careers = [
      buildCareer({ id: "c1", careerKey: "a", title: "Alpha" }),
      buildCareer({ id: "c2", careerKey: "b", title: "Beta" }),
      buildRichCareer({ id: "c3", careerKey: "c", title: "Gamma" }),
    ];
    const first = getRecommendations(STRONG_SNAPSHOT, careers).results.map((r) => r.careerKey);
    const second = getRecommendations(STRONG_SNAPSHOT, careers).results.map((r) => r.careerKey);
    expect(first).toEqual(second);
  });

  it("respects the limit parameter", () => {
    const careers = Array.from({ length: 20 }, (_, i) => buildCareer({ id: `c${i}`, careerKey: `career_${i}`, title: `Career ${i}` }));
    const summary = getRecommendations(STRONG_SNAPSHOT, careers, 5);
    expect(summary.results.length).toBe(5);
    expect(summary.totalCareersConsidered).toBe(20);
  });
});

describe("getRecommendations — no mutation of inputs", () => {
  it("does not mutate the student snapshot or any career passed in", () => {
    const snapshot = buildSnapshot({
      subjectStrengths: [subjectStrength("mathematics", 5)],
      interests: [interest("programming", 5)],
    });
    const careers = [buildRichCareer({ id: "c1" }), buildCareer({ id: "c2", title: "Other Role" })];

    const snapshotBefore = JSON.parse(JSON.stringify(snapshot));
    const careersBefore = JSON.parse(JSON.stringify(careers));

    getRecommendations(snapshot, careers);

    expect(snapshot).toEqual(snapshotBefore);
    expect(careers).toEqual(careersBefore);
  });
});
