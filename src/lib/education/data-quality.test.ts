import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRESHNESS_BAND_CONFIG,
  calculateFreshnessBand,
  checkAdmissionRequirementDataQuality,
  checkCourseDataQuality,
  checkCourseIntakeDataQuality,
  checkMissingSource,
  checkStaleVerification,
  checkUniversityDataQuality,
  findDuplicateSlugs,
} from "./data-quality";

const NOW = new Date("2026-08-27T00:00:00Z");

describe("calculateFreshnessBand", () => {
  it("returns 'unknown' for a null last-verified date", () => {
    expect(calculateFreshnessBand(null, NOW)).toBe("unknown");
  });

  it("returns 'unknown' for an unparseable date", () => {
    expect(calculateFreshnessBand("not-a-date", NOW)).toBe("unknown");
  });

  it("returns 'current' within the current-window", () => {
    expect(calculateFreshnessBand("2026-08-01", NOW)).toBe("current");
  });

  it("returns 'review_soon' just past the current-window but within the review window", () => {
    // ~200 days before NOW — beyond the default 180-day "current" window, within the 365-day "review_soon" window.
    expect(calculateFreshnessBand("2026-02-08", NOW)).toBe("review_soon");
  });

  it("returns 'stale' well past the review window", () => {
    expect(calculateFreshnessBand("2024-01-01", NOW)).toBe("stale");
  });

  it("respects a custom config", () => {
    const tightConfig = { currentWithinDays: 10, reviewSoonWithinDays: 20 };
    expect(calculateFreshnessBand("2026-08-01", NOW, tightConfig)).toBe("stale");
  });
});

describe("checkMissingSource / checkStaleVerification", () => {
  it("flags a missing source URL and missing last-verified date separately", () => {
    const issues = checkMissingSource({ sourceUrl: null, lastVerifiedAt: null });
    expect(issues.map((i) => i.code)).toEqual(["missing_source_url", "missing_last_verified_at"]);
  });

  it("flags nothing when both are present", () => {
    expect(checkMissingSource({ sourceUrl: "https://example.edu", lastVerifiedAt: "2026-08-01" })).toEqual([]);
  });

  it("flags a stale verification date", () => {
    const issues = checkStaleVerification({ sourceUrl: "https://example.edu", lastVerifiedAt: "2020-01-01" }, NOW);
    expect(issues.map((i) => i.code)).toEqual(["stale_verification"]);
  });

  it("does not flag a recent verification date", () => {
    expect(checkStaleVerification({ sourceUrl: "https://example.edu", lastVerifiedAt: "2026-08-01" }, NOW)).toEqual([]);
  });
});

function baseUniversity() {
  return {
    websiteUrl: "https://example.edu",
    countryIsoAlpha2: "DE",
    slug: "example-university",
    isActive: true,
    publicationStatus: "published" as const,
    applicationFeeCurrency: "EUR",
    sourceUrl: "https://example.edu/about",
    lastVerifiedAt: "2026-08-01",
  };
}

describe("checkUniversityDataQuality", () => {
  it("returns no issues for a fully clean record", () => {
    expect(checkUniversityDataQuality(baseUniversity(), NOW)).toEqual([]);
  });

  it("flags a missing official URL", () => {
    const issues = checkUniversityDataQuality({ ...baseUniversity(), websiteUrl: null }, NOW);
    expect(issues.some((i) => i.code === "missing_official_url")).toBe(true);
  });

  it("flags an invalid country code", () => {
    const issues = checkUniversityDataQuality({ ...baseUniversity(), countryIsoAlpha2: "GER" }, NOW);
    expect(issues.some((i) => i.code === "invalid_country_code")).toBe(true);
  });

  it("flags an invalid currency code", () => {
    const issues = checkUniversityDataQuality({ ...baseUniversity(), applicationFeeCurrency: "EURO" }, NOW);
    expect(issues.some((i) => i.code === "invalid_currency_code")).toBe(true);
  });
});

function baseCourse() {
  return {
    slug: "msc-computer-science",
    isActive: true,
    publicationStatus: "published" as const,
    tuitionAmountMinorUnits: 1500000,
    tuitionCurrency: "EUR",
    applicationFeeCurrency: "EUR",
    parentUniversity: { isActive: true, publicationStatus: "published" as const },
    sourceUrl: "https://example.edu/courses/cs",
    lastVerifiedAt: "2026-08-01",
  };
}

describe("checkCourseDataQuality", () => {
  it("returns no issues for a fully clean record", () => {
    expect(checkCourseDataQuality(baseCourse(), NOW)).toEqual([]);
  });

  it("flags a negative tuition amount", () => {
    const issues = checkCourseDataQuality({ ...baseCourse(), tuitionAmountMinorUnits: -100 }, NOW);
    expect(issues.some((i) => i.code === "invalid_tuition_amount")).toBe(true);
  });

  it("flags a course linked to an inactive university", () => {
    const issues = checkCourseDataQuality({ ...baseCourse(), parentUniversity: { isActive: false, publicationStatus: "published" } }, NOW);
    expect(issues.some((i) => i.code === "inactive_parent_university")).toBe(true);
  });

  it("flags a published course whose parent university is not published", () => {
    const issues = checkCourseDataQuality({ ...baseCourse(), parentUniversity: { isActive: true, publicationStatus: "draft" } }, NOW);
    expect(issues.some((i) => i.code === "unpublished_parent")).toBe(true);
  });

  it("does not flag unpublished-parent for a course that is itself still a draft", () => {
    const issues = checkCourseDataQuality(
      { ...baseCourse(), publicationStatus: "draft", parentUniversity: { isActive: true, publicationStatus: "draft" } },
      NOW,
    );
    expect(issues.some((i) => i.code === "unpublished_parent")).toBe(false);
  });
});

describe("checkCourseIntakeDataQuality", () => {
  it("flags a priority deadline before the applications-open date", () => {
    const issues = checkCourseIntakeDataQuality({
      applicationsOpenAt: "2026-09-01",
      priorityDeadline: "2026-08-01",
      finalDeadline: null,
      startYear: 2027,
      startMonth: 1,
      intakeStatus: "upcoming",
    }, NOW);
    expect(issues.some((i) => i.code === "deadline_before_opening")).toBe(true);
  });

  it("flags a final deadline before the priority deadline", () => {
    const issues = checkCourseIntakeDataQuality({
      applicationsOpenAt: "2026-01-01",
      priorityDeadline: "2026-06-01",
      finalDeadline: "2026-03-01",
      startYear: 2027,
      startMonth: 1,
      intakeStatus: "upcoming",
    }, NOW);
    expect(issues.some((i) => i.code === "final_deadline_before_priority")).toBe(true);
  });

  it("flags an intake marked upcoming whose start date has already passed", () => {
    const issues = checkCourseIntakeDataQuality({
      applicationsOpenAt: null,
      priorityDeadline: null,
      finalDeadline: null,
      startYear: 2025,
      startMonth: 1,
      intakeStatus: "upcoming",
    }, NOW);
    expect(issues.some((i) => i.code === "upcoming_intake_in_past")).toBe(true);
  });

  it("does not flag a genuinely future upcoming intake", () => {
    const issues = checkCourseIntakeDataQuality({
      applicationsOpenAt: "2026-09-01",
      priorityDeadline: "2026-10-01",
      finalDeadline: "2026-11-01",
      startYear: 2027,
      startMonth: 1,
      intakeStatus: "upcoming",
    }, NOW);
    expect(issues).toEqual([]);
  });

  it("does not flag a past start date when the intake is correctly marked closed", () => {
    const issues = checkCourseIntakeDataQuality({
      applicationsOpenAt: null,
      priorityDeadline: null,
      finalDeadline: null,
      startYear: 2025,
      startMonth: 1,
      intakeStatus: "closed",
    }, NOW);
    expect(issues.some((i) => i.code === "upcoming_intake_in_past")).toBe(false);
  });
});

describe("checkAdmissionRequirementDataQuality", () => {
  it("flags an IELTS score outside the valid 0-9 range", () => {
    const issues = checkAdmissionRequirementDataQuality({ languageTest: "IELTS", languageTestMinScore: 95 });
    expect(issues.some((i) => i.code === "invalid_language_test_score_range")).toBe(true);
  });

  it("does not flag a valid IELTS score", () => {
    expect(checkAdmissionRequirementDataQuality({ languageTest: "IELTS", languageTestMinScore: 6.5 })).toEqual([]);
  });

  it("does not flag an unrecognized test name (no known range to check against)", () => {
    expect(checkAdmissionRequirementDataQuality({ languageTest: "SomeOtherTest", languageTestMinScore: 9999 })).toEqual([]);
  });

  it("does not flag when no score is given", () => {
    expect(checkAdmissionRequirementDataQuality({ languageTest: "IELTS", languageTestMinScore: null })).toEqual([]);
  });
});

describe("findDuplicateSlugs", () => {
  it("finds records sharing the same slug", () => {
    const dupes = findDuplicateSlugs([
      { id: "1", slug: "oxford" },
      { id: "2", slug: "cambridge" },
      { id: "3", slug: "oxford" },
    ]);
    expect(dupes.get("oxford")).toEqual(["1", "3"]);
    expect(dupes.has("cambridge")).toBe(false);
  });

  it("treats slugs as case-insensitive duplicates", () => {
    const dupes = findDuplicateSlugs([
      { id: "1", slug: "Oxford" },
      { id: "2", slug: "oxford" },
    ]);
    expect(dupes.get("oxford")).toEqual(["1", "2"]);
  });

  it("returns an empty map when there are no duplicates", () => {
    const dupes = findDuplicateSlugs([{ id: "1", slug: "oxford" }]);
    expect(dupes.size).toBe(0);
  });
});
