import { describe, it, expect } from "vitest";
import { buildComparisonMatrix, careerDetailToMatchProfile, MAX_COMPARE_CAREERS, MIN_COMPARE_CAREERS } from "./compare";
import type { CareerDetail, CareerScores } from "@/types/career";
import type { RecommendationResult, MatchBand } from "@/lib/recommendations";

const EMPTY_SCORES: CareerScores = {
  internationalMobility: null,
  remoteWork: null,
  entrepreneurship: null,
  salaryPotential: null,
  jobSecurity: null,
  creativity: null,
  socialImpact: null,
  leadershipOpportunity: null,
  travel: null,
  researchIntensity: null,
  technicalDepth: null,
};

function buildCareer(overrides: Partial<CareerDetail> = {}): CareerDetail {
  return {
    id: overrides.id ?? "career-1",
    careerKey: overrides.careerKey ?? "software_engineer",
    familyKey: overrides.familyKey ?? "technology",
    familyName: overrides.familyName ?? "Technology",
    title: overrides.title ?? "Software Engineer",
    shortTitle: overrides.shortTitle ?? null,
    slug: overrides.slug ?? "software-engineer",
    summary: overrides.summary ?? "Builds software.",
    whatYouDo: overrides.whatYouDo ?? "Writes code.",
    typicalEnvironment: overrides.typicalEnvironment ?? "Office.",
    careerOutlookSummary: overrides.careerOutlookSummary ?? null,
    typicalEntryLevel: overrides.typicalEntryLevel ?? "Entry level",
    minimumEducationKey: overrides.minimumEducationKey ?? null,
    scores: { ...EMPTY_SCORES, ...overrides.scores },
    isFeatured: overrides.isFeatured ?? false,
    dataQualityStatus: overrides.dataQualityStatus ?? "approved",
    subjects: overrides.subjects ?? [],
    interests: overrides.interests ?? [],
    skills: overrides.skills ?? [],
    workPreferences: overrides.workPreferences ?? [],
    careerPriorities: overrides.careerPriorities ?? [],
    educationRoutes: overrides.educationRoutes ?? [],
    industries: overrides.industries ?? [],
    tags: overrides.tags ?? [],
    aliases: overrides.aliases ?? [],
  };
}

function buildMatch(careerId: string, band: MatchBand): RecommendationResult {
  return {
    careerId,
    careerKey: careerId,
    slug: careerId,
    title: careerId,
    shortTitle: null,
    summary: "",
    familyKey: "",
    familyName: "",
    isFeatured: false,
    matchBand: band,
    evidenceLevel: "high",
    reasons: [],
    gaps: [],
    matched: { subjects: [], interests: [], skills: [], workPreferences: [], careerPriorities: [] },
    internalScore: 0,
    internalEvidenceCoverage: 0,
  };
}

describe("buildComparisonMatrix — basic shape", () => {
  it("returns one header per career, in the given order", () => {
    const a = buildCareer({ id: "a", slug: "a-career", title: "Alpha" });
    const b = buildCareer({ id: "b", slug: "b-career", title: "Beta" });
    const matrix = buildComparisonMatrix([a, b]);
    expect(matrix.careers.map((c) => c.slug)).toEqual(["a-career", "b-career"]);
  });

  it("works with exactly MIN_COMPARE_CAREERS careers", () => {
    const careers = Array.from({ length: MIN_COMPARE_CAREERS }, (_, i) => buildCareer({ id: `c${i}`, slug: `c${i}` }));
    expect(() => buildComparisonMatrix(careers)).not.toThrow();
  });

  it("works with MAX_COMPARE_CAREERS careers", () => {
    const careers = Array.from({ length: MAX_COMPARE_CAREERS }, (_, i) => buildCareer({ id: `c${i}`, slug: `c${i}` }));
    const matrix = buildComparisonMatrix(careers);
    expect(matrix.careers.length).toBe(MAX_COMPARE_CAREERS);
  });

  it("never mutates the careers it's given", () => {
    const a = buildCareer({ id: "a", subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: 4 }] });
    const b = buildCareer({ id: "b" });
    const before = JSON.parse(JSON.stringify([a, b]));
    buildComparisonMatrix([a, b]);
    expect([a, b]).toEqual(before);
  });

  it("handles careers with no data anywhere without throwing or producing NaN-like output", () => {
    const a = buildCareer({ id: "a" });
    const b = buildCareer({ id: "b" });
    const matrix = buildComparisonMatrix([a, b]);
    expect(matrix.sections.every((s) => Array.isArray(s.rows))).toBe(true);
    // Every section still exists (possibly with zero rows), nothing crashes on sparse data.
    expect(matrix.sections.length).toBeGreaterThan(0);
  });
});

describe("buildComparisonMatrix — subjects/interests core vs. also-relevant", () => {
  it("bins importance >= 4 as Core and below as Also relevant, never showing a raw number", () => {
    const a = buildCareer({ id: "a", subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: null }] });
    const b = buildCareer({ id: "b", subjects: [{ subjectKey: "mathematics", importance: 2, minimumStrength: null }] });
    const matrix = buildComparisonMatrix([a, b]);
    const row = matrix.sections.find((s) => s.key === "subjects")!.rows.find((r) => r.key === "mathematics")!;

    expect(row.cells[0]).toBe("Core");
    expect(row.cells[1]).toBe("Also relevant");
    for (const cell of row.cells) {
      expect(cell).not.toMatch(/\d/); // no digits anywhere in a displayed cell
    }
  });

  it("highlights every career for which a subject is Core, including ties", () => {
    const a = buildCareer({ id: "a", subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: null }] });
    const b = buildCareer({ id: "b", subjects: [{ subjectKey: "mathematics", importance: 4, minimumStrength: null }] });
    const matrix = buildComparisonMatrix([a, b]);
    const row = matrix.sections.find((s) => s.key === "subjects")!.rows.find((r) => r.key === "mathematics")!;
    expect(row.highlightIndexes.sort()).toEqual([0, 1]);
  });

  it("leaves the cell empty (not a fabricated 'No') when a career doesn't have the subject at all", () => {
    const a = buildCareer({ id: "a", subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: null }] });
    const b = buildCareer({ id: "b", subjects: [] });
    const matrix = buildComparisonMatrix([a, b]);
    const row = matrix.sections.find((s) => s.key === "subjects")!.rows.find((r) => r.key === "mathematics")!;
    expect(row.cells[1]).toBe("");
    expect(row.highlightIndexes).toEqual([0]);
  });
});

describe("buildComparisonMatrix — row ordering is deterministic", () => {
  it("unions keys in first-seen order across careers, stable across repeated calls", () => {
    const a = buildCareer({
      id: "a",
      subjects: [
        { subjectKey: "physics", importance: 5, minimumStrength: null },
        { subjectKey: "mathematics", importance: 4, minimumStrength: null },
      ],
    });
    const b = buildCareer({ id: "b", subjects: [{ subjectKey: "chemistry", importance: 5, minimumStrength: null }] });

    const first = buildComparisonMatrix([a, b]).sections.find((s) => s.key === "subjects")!.rows.map((r) => r.key);
    const second = buildComparisonMatrix([a, b]).sections.find((s) => s.key === "subjects")!.rows.map((r) => r.key);

    expect(first).toEqual(["physics", "mathematics", "chemistry"]);
    expect(first).toEqual(second);
  });
});

describe("buildComparisonMatrix — skills", () => {
  it("shows the recommended skill level as a label, and highlights the career requiring the most advanced level", () => {
    const a = buildCareer({ id: "a", skills: [{ skillKey: "programming", importance: 5, recommendedLevel: "advanced" }] });
    const b = buildCareer({ id: "b", skills: [{ skillKey: "programming", importance: 5, recommendedLevel: "beginner" }] });
    const matrix = buildComparisonMatrix([a, b]);
    const row = matrix.sections.find((s) => s.key === "skills")!.rows.find((r) => r.key === "programming")!;

    expect(row.cells).toEqual(["Advanced", "Beginner"]);
    expect(row.highlightIndexes).toEqual([0]);
  });
});

describe("buildComparisonMatrix — education", () => {
  it("always includes a minimum-education row, blank when unset", () => {
    const a = buildCareer({ id: "a", minimumEducationKey: "bachelors" });
    const b = buildCareer({ id: "b", minimumEducationKey: null });
    const matrix = buildComparisonMatrix([a, b]);
    const row = matrix.sections.find((s) => s.key === "education")!.rows.find((r) => r.key === "minimum_education")!;
    expect(row.cells[1]).toBe("");
    expect(row.cells[0]).not.toBe("");
  });

  it("deduplicates identical (level, field) routes across careers into one row", () => {
    const a = buildCareer({
      id: "a",
      educationRoutes: [{ educationLevel: "bachelors", fieldKey: "computer_science", specializationKey: null, relevance: "primary", notes: null }],
    });
    const b = buildCareer({
      id: "b",
      educationRoutes: [{ educationLevel: "bachelors", fieldKey: "computer_science", specializationKey: null, relevance: "common", notes: null }],
    });
    const matrix = buildComparisonMatrix([a, b]);
    const rows = matrix.sections.find((s) => s.key === "education")!.rows.filter((r) => r.key !== "minimum_education");
    expect(rows.length).toBe(1);
    expect(rows[0].cells).toEqual(["Primary route", "Common route"]);
    expect(rows[0].highlightIndexes).toEqual([0]);
  });
});

describe("buildComparisonMatrix — personalized match section", () => {
  it("is omitted entirely when no match data is supplied", () => {
    const a = buildCareer({ id: "a" });
    const b = buildCareer({ id: "b" });
    const matrix = buildComparisonMatrix([a, b], null);
    expect(matrix.hasPersonalizedMatch).toBe(false);
    expect(matrix.sections.some((s) => s.key === "match")).toBe(false);
  });

  it("shows each career's qualitative band and highlights the best one(s), never a raw score", () => {
    const a = buildCareer({ id: "a" });
    const b = buildCareer({ id: "b" });
    const c = buildCareer({ id: "c" });
    const matches = new Map([
      ["a", buildMatch("a", "worth_exploring")],
      ["b", buildMatch("b", "strong_match")],
      ["c", buildMatch("c", "strong_match")],
    ]);
    const matrix = buildComparisonMatrix([a, b, c], matches);
    const row = matrix.sections.find((s) => s.key === "match")!.rows[0];

    expect(row.cells).toEqual(["Worth exploring", "Strong match", "Strong match"]);
    expect(row.highlightIndexes.sort()).toEqual([1, 2]);
    for (const cell of row.cells) expect(cell).not.toMatch(/\d/);
  });

  it("never mutates the matches map or its RecommendationResult values", () => {
    const a = buildCareer({ id: "a" });
    const match = buildMatch("a", "strong_match");
    const matches = new Map([["a", match]]);
    const before = JSON.parse(JSON.stringify(match));
    buildComparisonMatrix([a], matches);
    expect(match).toEqual(before);
  });
});

describe("careerDetailToMatchProfile", () => {
  it("flattens industries/tags to bare key arrays and carries every other field through unchanged", () => {
    const detail = buildCareer({
      id: "a",
      minimumEducationKey: "bachelors",
      subjects: [{ subjectKey: "mathematics", importance: 5, minimumStrength: 4 }],
      industries: [{ id: "ind-1", industryKey: "software", name: "Software", description: null }],
      tags: [{ id: "tag-1", tagKey: "high_growth", label: "High growth" }],
    });

    const profile = careerDetailToMatchProfile(detail);

    expect(profile.id).toBe("a");
    expect(profile.minimumEducationKey).toBe("bachelors");
    expect(profile.subjects).toEqual(detail.subjects);
    expect(profile.industryKeys).toEqual(["software"]);
    expect(profile.tagKeys).toEqual(["high_growth"]);
  });

  it("does not mutate the CareerDetail it's given", () => {
    const detail = buildCareer({ id: "a", industries: [{ id: "ind-1", industryKey: "software", name: "Software", description: null }] });
    const before = JSON.parse(JSON.stringify(detail));
    careerDetailToMatchProfile(detail);
    expect(detail).toEqual(before);
  });
});
