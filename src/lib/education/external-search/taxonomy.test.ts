import { describe, expect, it } from "vitest";
import {
  resolveSubject,
  resolveDegreeLevel,
  educationLevelToCanonicalDegree,
  CANONICAL_DEGREE_TO_EDUCATION_LEVELS,
  DEGREE_LEVEL_LABELS,
  getSubjectById,
} from "./taxonomy";

describe("resolveSubject — exact matches", () => {
  it.each(["mechanical engineering", "Mechanical Engineering", "MECHANICAL ENGINEERING", "  mechanical   engineering  "])(
    "%s resolves to the canonical Mechanical Engineering entry",
    (input) => {
      const result = resolveSubject(input);
      expect(result.exactMatch?.id).toBe("mechanical-engineering");
      expect(result.exactMatch?.canonicalLabel).toBe("Mechanical Engineering");
      expect(result.matchSource).toBe("exact_alias");
    },
  );

  it("recognizes 'mechanical engineer' and 'mechanical' as exact aliases", () => {
    expect(resolveSubject("mechanical engineer").exactMatch?.id).toBe("mechanical-engineering");
    expect(resolveSubject("mechanical").exactMatch?.id).toBe("mechanical-engineering");
  });
});

describe("resolveSubject — related vs exact (never silently substituted)", () => {
  it("attaches mechatronics/automotive/manufacturing as related subjects of Mechanical Engineering, not as the exact match", () => {
    const result = resolveSubject("mechanical engineering");
    const relatedIds = result.relatedSubjects.map((s) => s.id).sort();
    expect(relatedIds).toEqual(["automotive-engineering", "manufacturing-engineering", "mechatronics"].sort());
    // The exact match itself must never be one of the related subjects.
    expect(relatedIds).not.toContain("mechanical-engineering");
  });

  it("searching 'mechatronics' directly exact-matches Mechatronics, NOT Mechanical Engineering", () => {
    const result = resolveSubject("mechatronics");
    expect(result.exactMatch?.id).toBe("mechatronics");
    expect(result.exactMatch?.id).not.toBe("mechanical-engineering");
  });

  it("searching 'automotive engineering' exact-matches Automotive Engineering, not Mechanical Engineering", () => {
    const result = resolveSubject("automotive engineering");
    expect(result.exactMatch?.id).toBe("automotive-engineering");
  });

  it("searching 'manufacturing engineering' exact-matches Manufacturing Engineering, not Mechanical Engineering", () => {
    const result = resolveSubject("manufacturing engineering");
    expect(result.exactMatch?.id).toBe("manufacturing-engineering");
  });
});

describe("resolveSubject — misspelling normalization", () => {
  it.each(["machanical engineering", "mechnical engineering", "mechanical engg"])(
    "%s is corrected to the canonical Mechanical Engineering entry",
    (input) => {
      const result = resolveSubject(input);
      expect(result.exactMatch?.canonicalLabel).toBe("Mechanical Engineering");
      expect(result.matchSource).toBe("misspelling_correction");
    },
  );

  it("canonical display value is always exactly 'Mechanical Engineering', regardless of which alias/misspelling matched", () => {
    for (const input of ["mechanical engineering", "mechanical engineer", "mechanical", "machanical engineering", "mechnical engineering", "mechanical engg"]) {
      expect(resolveSubject(input).exactMatch?.canonicalLabel).toBe("Mechanical Engineering");
    }
  });
});

describe("resolveSubject — unmatched input", () => {
  it("returns no exact match and no related subjects for an empty or unrecognized query", () => {
    expect(resolveSubject("").exactMatch).toBeNull();
    expect(resolveSubject("   ").exactMatch).toBeNull();
    expect(resolveSubject("underwater basket weaving").exactMatch).toBeNull();
    expect(resolveSubject("underwater basket weaving").relatedSubjects).toEqual([]);
  });

  it("does not throw or return a coerced 'closest' match for null/undefined input", () => {
    expect(resolveSubject(null).exactMatch).toBeNull();
    expect(resolveSubject(undefined).exactMatch).toBeNull();
  });
});

describe("getSubjectById", () => {
  it("returns the entry for a known id and null for an unknown id", () => {
    expect(getSubjectById("mechanical-engineering")?.canonicalLabel).toBe("Mechanical Engineering");
    expect(getSubjectById("not-a-real-subject-id")).toBeNull();
  });
});

describe("resolveDegreeLevel — exact matches", () => {
  it.each(["bachelor's", "bachelors", "Bachelor's", "undergraduate", "BSc"])("%s resolves to canonical bachelors", (input) => {
    const result = resolveDegreeLevel(input);
    expect(result.canonicalLevel).toBe("bachelors");
  });

  it("Master's and Bachelor's are kept clearly separate — never conflated", () => {
    expect(resolveDegreeLevel("master's").canonicalLevel).toBe("masters");
    expect(resolveDegreeLevel("bachelor's").canonicalLevel).toBe("bachelors");
    expect(resolveDegreeLevel("master's").canonicalLevel).not.toBe(resolveDegreeLevel("bachelor's").canonicalLevel);
  });

  it("recognizes doctorate and diploma/certificate variants", () => {
    expect(resolveDegreeLevel("phd").canonicalLevel).toBe("doctorate");
    expect(resolveDegreeLevel("doctoral").canonicalLevel).toBe("doctorate");
    expect(resolveDegreeLevel("diploma").canonicalLevel).toBe("diploma_certificate");
    expect(resolveDegreeLevel("certificate").canonicalLevel).toBe("diploma_certificate");
  });
});

describe("resolveDegreeLevel — misspelling normalization", () => {
  it.each(["bachlors", "bachelor", "bachelors"])("%s normalizes to canonical Bachelor's", (input) => {
    const result = resolveDegreeLevel(input);
    expect(result.canonicalLevel).toBe("bachelors");
    expect(DEGREE_LEVEL_LABELS[result.canonicalLevel!]).toBe("Bachelor's");
  });
});

describe("resolveDegreeLevel — unmatched input", () => {
  it("returns null for empty or unrecognized input, never a guessed level", () => {
    expect(resolveDegreeLevel("").canonicalLevel).toBeNull();
    expect(resolveDegreeLevel("some made up degree").canonicalLevel).toBeNull();
  });
});

describe("CANONICAL_DEGREE_TO_EDUCATION_LEVELS mapping", () => {
  it("maps each canonical degree level onto the existing courses.education_level CHECK-constrained values", () => {
    expect(CANONICAL_DEGREE_TO_EDUCATION_LEVELS.bachelors).toEqual(["undergraduate"]);
    expect(CANONICAL_DEGREE_TO_EDUCATION_LEVELS.masters).toEqual(["postgraduate"]);
    expect(CANONICAL_DEGREE_TO_EDUCATION_LEVELS.doctorate).toEqual(["doctorate"]);
    expect(CANONICAL_DEGREE_TO_EDUCATION_LEVELS.diploma_certificate).toEqual(["diploma", "certificate"]);
    expect(CANONICAL_DEGREE_TO_EDUCATION_LEVELS.other).toEqual(["other"]);
  });

  it("round-trips education_level -> canonical degree for every mapped value", () => {
    expect(educationLevelToCanonicalDegree("undergraduate")).toBe("bachelors");
    expect(educationLevelToCanonicalDegree("postgraduate")).toBe("masters");
    expect(educationLevelToCanonicalDegree("doctorate")).toBe("doctorate");
    expect(educationLevelToCanonicalDegree("diploma")).toBe("diploma_certificate");
    expect(educationLevelToCanonicalDegree("certificate")).toBe("diploma_certificate");
    expect(educationLevelToCanonicalDegree("other")).toBe("other");
    expect(educationLevelToCanonicalDegree(null)).toBeNull();
    expect(educationLevelToCanonicalDegree("nonsense")).toBeNull();
  });
});
