import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { educationLevelToCourseSearchDegree } from "./labels";

/**
 * NW02 §12.17/§12.18 — career-to-course pathways use real supported
 * education-route data, and course-to-career claims are never fabricated.
 *
 * `educationLevelToCourseSearchDegree` and the career detail page's own
 * "Search courses" link (src/app/(site)/careers/[slug]/page.tsx) are the
 * NW02 addition this file protects: a direct transition from a career's
 * own already-published `education_routes` rows into the Course
 * Explorer's existing subject/degree search — never a new claim about
 * admission or employment outcomes.
 */

describe("educationLevelToCourseSearchDegree — career → course degree-level mapping", () => {
  it("maps every profile-options education level with a genuine Course Explorer equivalent", () => {
    expect(educationLevelToCourseSearchDegree("bachelors")).toBe("bachelors");
    expect(educationLevelToCourseSearchDegree("masters")).toBe("masters");
    expect(educationLevelToCourseSearchDegree("phd")).toBe("doctorate");
    expect(educationLevelToCourseSearchDegree("diploma")).toBe("diploma_certificate");
  });

  it("returns null (never a guessed mapping) for a level with no confident Course Explorer equivalent", () => {
    expect(educationLevelToCourseSearchDegree("class_10")).toBeNull();
    expect(educationLevelToCourseSearchDegree("class_12")).toBeNull();
    expect(educationLevelToCourseSearchDegree("other")).toBeNull();
    expect(educationLevelToCourseSearchDegree("not_a_real_level")).toBeNull();
  });

  it("every non-null return value is one of the Course Explorer's own CANONICAL_DEGREE_LEVELS", () => {
    const validDegrees = ["bachelors", "masters", "doctorate", "diploma_certificate", "other"];
    for (const level of ["bachelors", "masters", "phd", "diploma"]) {
      const mapped = educationLevelToCourseSearchDegree(level);
      expect(mapped).not.toBeNull();
      expect(validDegrees).toContain(mapped);
    }
  });
});

describe("career detail page — honest, data-driven course-search transition (static source audit)", () => {
  const PAGE_PATH = path.join(__dirname, "..", "..", "app", "(site)", "careers", "[slug]", "page.tsx");
  const pageSource = readFileSync(PAGE_PATH, "utf8");

  it("builds the course-search link from the career's own real route data (fieldKey/educationLevel), never a hardcoded subject/degree", () => {
    expect(pageSource).toContain("educationLevelToCourseSearchDegree(route.educationLevel)");
    expect(pageSource).toContain("fieldLabel(route.fieldKey)");
  });

  it("never renders the course-search link for a route with no confident degree mapping (courseSearchHref stays null)", () => {
    expect(pageSource).toMatch(/const courseSearchHref = canonicalDegree\s*\n?\s*\?/);
  });

  it("still carries the existing disclaimer that education routes are not a university/course recommendation or a guarantee", () => {
    expect(pageSource).toMatch(/not a university or course recommendation/);
    expect(pageSource).toMatch(/not a\s*\n?\s*guarantee that any specific programme leads to this career/);
  });

  it("links into the existing /courses taxonomy params (subject/degree), never a new, parallel search route", () => {
    expect(pageSource).toContain('`/courses?subject=${encodeURIComponent(fieldLabel(route.fieldKey))}&degree=${canonicalDegree}`');
  });
});
