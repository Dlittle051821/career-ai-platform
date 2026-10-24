import { describe, expect, it } from "vitest";
import type { AdapterResult } from "./provider-types";
import { LAUNCH_COUNTRY_PRIMARY_SOURCES } from "./launch-country-sources";
import { compareTrustedSearchResults, isLaunchPrimaryResult } from "./launch-primary-result";

function makeResult(overrides: Partial<AdapterResult> & Pick<AdapterResult, "providerSlug" | "providerId">): AdapterResult {
  return {
    available: true,
    providerId: overrides.providerId,
    providerSlug: overrides.providerSlug,
    providerDisplayName: overrides.providerDisplayName ?? overrides.providerSlug,
    officialDomain: overrides.officialDomain ?? "example.com",
    region: overrides.region ?? null,
    countryCode: overrides.countryCode ?? null,
    url: overrides.url ?? "https://example.com/",
    canonicalSubjectId: overrides.canonicalSubjectId ?? null,
    canonicalSubjectLabel: overrides.canonicalSubjectLabel ?? null,
    degreeLevel: overrides.degreeLevel ?? null,
    degreeLevelLabel: overrides.degreeLevelLabel ?? null,
    appliedFilters: overrides.appliedFilters ?? [],
    isFiltered: overrides.isFiltered ?? false,
    requiresManualSearch: overrides.requiresManualSearch ?? true,
    instructions: overrides.instructions ?? null,
    warningText: overrides.warningText ?? null,
    linkVerificationDate: overrides.linkVerificationDate ?? null,
    strategyUsed: overrides.strategyUsed ?? "official_landing_page",
    mappingId: overrides.mappingId ?? null,
    isStale: overrides.isStale ?? false,
  };
}

describe("isLaunchPrimaryResult", () => {
  it("is true for a result whose providerSlug matches the launch country's M20A-registry primary", () => {
    const germany = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((s) => s.countryCode === "DE")!;
    const result = makeResult({ providerId: "p1", providerSlug: germany.providerSlug, countryCode: "DE" });
    expect(isLaunchPrimaryResult(result, "DE")).toBe(true);
  });

  it("is false for a specialist provider of a country that is not (or no longer) a Tier 1 launch country (e.g. UCAS for GB — GB was removed from the launch set by NW02)", () => {
    const result = makeResult({ providerId: "p2", providerSlug: "ucas-course-search", countryCode: "GB" });
    expect(isLaunchPrimaryResult(result, "GB")).toBe(false);
  });

  it("is false for every non-primary providerSlug, across all seven launch countries", () => {
    for (const primary of LAUNCH_COUNTRY_PRIMARY_SOURCES) {
      const impostor = makeResult({ providerId: "px", providerSlug: `not-${primary.providerSlug}`, countryCode: primary.countryCode });
      expect(isLaunchPrimaryResult(impostor, primary.countryCode)).toBe(false);
    }
  });

  it("is false (never throws) for a destination that is not a Tier 1 launch country", () => {
    const result = makeResult({ providerId: "p3", providerSlug: "ucas-course-search", countryCode: "GB" });
    expect(isLaunchPrimaryResult(result, "GB")).toBe(false);
    expect(isLaunchPrimaryResult(result, null)).toBe(false);
    expect(isLaunchPrimaryResult(result, undefined)).toBe(false);
  });

  it("normalizes country-code case, matching the launch-country registry's own normalization", () => {
    const germany = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((s) => s.countryCode === "DE")!;
    const result = makeResult({ providerId: "p4", providerSlug: germany.providerSlug, countryCode: "DE" });
    expect(isLaunchPrimaryResult(result, "de")).toBe(true);
  });

  it("does not infer primary status from any field other than providerSlug (e.g. display name/domain are irrelevant)", () => {
    const germany = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((s) => s.countryCode === "DE")!;
    const result = makeResult({
      providerId: "p5",
      providerSlug: "ucas-course-search",
      providerDisplayName: germany.authority, // same authority text, wrong slug
      officialDomain: germany.primaryDomain, // same domain, wrong slug
      countryCode: "DE",
    });
    expect(isLaunchPrimaryResult(result, "DE")).toBe(false);
  });
});

describe("compareTrustedSearchResults — the full, intentional ordering rule", () => {
  it("a genuine filtered deep link always sorts before an unfiltered result, regardless of primary status", () => {
    const filteredSpecialist = makeResult({ providerId: "a", providerSlug: "ucas-course-search", countryCode: "GB", isFiltered: true });
    const unfilteredPrimary = makeResult({ providerId: "b", providerSlug: "daad-international-programmes", countryCode: "DE", isFiltered: false });
    const sorted = [unfilteredPrimary, filteredSpecialist].sort((a, b) => compareTrustedSearchResults(a, b, "GB"));
    expect(sorted[0].providerId).toBe("a");
  });

  it("among equally-filtered results, the launch-country primary sorts first", () => {
    const specialist = makeResult({ providerId: "daad-degree-programmes", providerSlug: "daad-degree-programmes", countryCode: "DE", isFiltered: false });
    const primary = makeResult({ providerId: "daad-international", providerSlug: "daad-international-programmes", countryCode: "DE", isFiltered: false });
    const sorted = [specialist, primary].sort((a, b) => compareTrustedSearchResults(a, b, "DE"));
    expect(sorted[0].providerId).toBe("daad-international");

    const reverseInput = [primary, specialist].sort((a, b) => compareTrustedSearchResults(a, b, "DE"));
    expect(reverseInput[0].providerId).toBe("daad-international");
  });

  it("leaves the relative order of two non-primary results untouched (stability)", () => {
    const first = makeResult({ providerId: "first", providerSlug: "specialist-a", countryCode: "DE", isFiltered: false });
    const second = makeResult({ providerId: "second", providerSlug: "specialist-b", countryCode: "DE", isFiltered: false });
    const sorted = [first, second].sort((a, b) => compareTrustedSearchResults(a, b, "DE"));
    expect(sorted.map((r) => r.providerId)).toEqual(["first", "second"]);
  });

  it("has no opinion about ordering for a destination that is not a Tier 1 launch country (falls through to the pre-existing filtered-only rule) — GB, removed from the launch set by NW02", () => {
    const filtered = makeResult({ providerId: "x", providerSlug: "ucas-course-search", countryCode: "GB", isFiltered: true });
    const unfiltered = makeResult({ providerId: "y", providerSlug: "another-gb-provider", countryCode: "GB", isFiltered: false });
    const sorted = [unfiltered, filtered].sort((a, b) => compareTrustedSearchResults(a, b, "GB"));
    expect(sorted[0].providerId).toBe("x");
  });
});
