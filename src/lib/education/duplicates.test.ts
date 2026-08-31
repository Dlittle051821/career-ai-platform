import { describe, expect, it } from "vitest";
import {
  COURSE_DUPLICATE_SCORE_THRESHOLD,
  UNIVERSITY_DUPLICATE_SCORE_THRESHOLD,
  scoreCourseMatch,
  scoreUniversityMatch,
  type CourseMatchInput,
  type UniversityMatchInput,
} from "./duplicates";

function university(overrides: Partial<UniversityMatchInput> = {}): UniversityMatchInput {
  return {
    name: "University of Oxford",
    countryCode: "GB",
    city: "Oxford",
    websiteUrl: "https://www.ox.ac.uk",
    sourceRecordId: "OX-001",
    ...overrides,
  };
}

function course(overrides: Partial<CourseMatchInput> = {}): CourseMatchInput {
  return {
    universityId: "uni-1",
    name: "MSc Computer Science",
    qualificationLevel: "Master of Science",
    campusId: "campus-1",
    programCode: "CS-MSC-01",
    studyMode: "on_campus",
    ...overrides,
  };
}

describe("scoreUniversityMatch", () => {
  it("scores an exact duplicate (same name/country/city/domain/sourceId) at 1.0", () => {
    const result = scoreUniversityMatch(university(), university());
    expect(result.score).toBe(1);
  });

  it("is deterministic — scoring the same pair twice gives the same result", () => {
    const a = university();
    const b = university({ sourceRecordId: null });
    expect(scoreUniversityMatch(a, b)).toEqual(scoreUniversityMatch(a, b));
  });

  it("scores lower (not 1.0) when some signals are absent on both sides, since missing evidence should not inflate confidence", () => {
    const a = university({ websiteUrl: null, sourceRecordId: null, city: null });
    const b = university({ websiteUrl: null, sourceRecordId: null, city: null });
    const result = scoreUniversityMatch(a, b);
    // name (4) + country (2) matched, out of the FULL signal weight (4+2+1+3+2=12) — an absent
    // field still counts against the denominator, it just isn't listed in `signals` for display.
    expect(result.score).toBe(0.5);
  });

  it("is tolerant of superficial name formatting differences (case, 'The', punctuation)", () => {
    const a = university({ name: "The University of Oxford" });
    const b = university({ name: "university of oxford" });
    const result = scoreUniversityMatch(a, b);
    expect(result.score).toBeGreaterThanOrEqual(UNIVERSITY_DUPLICATE_SCORE_THRESHOLD);
  });

  it("scores two unrelated universities with no matching signals at 0", () => {
    const a = university();
    const b = university({
      name: "Massachusetts Institute of Technology",
      countryCode: "US",
      city: "Cambridge",
      websiteUrl: "https://web.mit.edu",
      sourceRecordId: "MIT-001",
    });
    const result = scoreUniversityMatch(a, b);
    expect(result.score).toBe(0);
  });

  it("does not count a field as a matching signal when it is absent on both sides", () => {
    const a = university({ sourceRecordId: null });
    const b = university({ sourceRecordId: null, name: "Completely Different Name", countryCode: "FR", city: "Paris", websiteUrl: "https://x.fr" });
    const result = scoreUniversityMatch(a, b);
    const sourceIdSignal = result.signals.find((s) => s.field === "sourceRecordId");
    expect(sourceIdSignal).toBeUndefined();
  });

  it("includes per-field match signals for review", () => {
    const result = scoreUniversityMatch(university(), university({ city: "Cambridge" }));
    const nameSignal = result.signals.find((s) => s.field === "name");
    const citySignal = result.signals.find((s) => s.field === "city");
    expect(nameSignal?.primaryValue).toBe(nameSignal?.candidateValue);
    expect(citySignal?.primaryValue).not.toBe(citySignal?.candidateValue);
  });
});

describe("scoreCourseMatch", () => {
  it("scores an exact duplicate at 1.0", () => {
    const result = scoreCourseMatch(course(), course());
    expect(result.score).toBe(1);
  });

  it("scores two unrelated courses at a low score", () => {
    const result = scoreCourseMatch(
      course(),
      course({
        universityId: "uni-2",
        name: "BA History",
        qualificationLevel: "Bachelor of Arts",
        campusId: "campus-2",
        programCode: "HIST-BA-01",
        studyMode: "online",
      }),
    );
    expect(result.score).toBe(0);
  });

  it("is deterministic", () => {
    const a = course();
    const b = course({ name: "M.Sc. Computer Science" });
    expect(scoreCourseMatch(a, b)).toEqual(scoreCourseMatch(a, b));
  });

  it("scores above the threshold when university, name, and qualification match even if program code differs", () => {
    const result = scoreCourseMatch(course(), course({ programCode: "CS-2024-INTAKE", campusId: null }));
    expect(result.score).toBeGreaterThanOrEqual(COURSE_DUPLICATE_SCORE_THRESHOLD);
  });
});
