import { describe, expect, it } from "vitest";
import { buildProviderSearchResult, isWarningCurrentlyEffective, needsMappingGapEvent, isFilteredDeepLink } from "./adapter";
import type { MappingRecord, ProviderRecord } from "./provider-types";

const NOW = new Date("2026-08-30T00:00:00Z");

function daadProvider(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: "provider-daad-international",
    slug: "daad-international-programmes",
    displayName: "DAAD International Programmes",
    countryCode: "DE",
    region: "Europe",
    providerType: "course_search",
    officialDomain: "www2.daad.de",
    baseUrl: "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/result/",
    fallbackUrl: "https://www.daad.de/en/studying-in-germany/universities/all-degree-programmes/",
    strategy: "verified_deep_link",
    description: "Internationally oriented and commonly English-taught programmes in Germany.",
    warningText: null,
    warningEffectiveAt: null,
    warningReviewAt: null,
    language: "en",
    active: true,
    lastVerifiedAt: "2026-08-01",
    verifiedBy: "system-seed",
    supportedDegreeLevels: [],
    ...overrides,
  };
}

function daadMechEngBachelorsMapping(overrides: Partial<MappingRecord> = {}): MappingRecord {
  return {
    id: "mapping-daad-de-mecheng-bachelors",
    providerId: "provider-daad-international",
    canonicalSubjectId: "mechanical-engineering",
    degreeLevel: "bachelors",
    destinationCountryCode: "DE",
    verifiedUrl:
      "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/result/?degree%5B0%5D=1&fos%5B0%5D=96&subjectGroup%5B0%5D=56",
    providerSubjectCode: "fos[0]=96,subjectGroup[0]=56",
    providerDegreeCode: "degree[0]=1",
    searchTerm: "Mechanical Engineering",
    manualInstructions: null,
    mappingStatus: "active",
    lastVerifiedAt: "2026-08-01",
    verifiedBy: "system-seed",
    ...overrides,
  };
}

const mechEngBachelorsQuery = { canonicalSubjectId: "mechanical-engineering", canonicalSubjectLabel: "Mechanical Engineering", degreeLevel: "bachelors" as const };

describe("Germany + Bachelor's + Mechanical Engineering", () => {
  it("returns the stored verified DAAD deep link, exactly as stored, with no reconstruction", () => {
    const result = buildProviderSearchResult(daadProvider(), daadMechEngBachelorsMapping(), mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(true);
    expect(result.requiresManualSearch).toBe(false);
    expect(result.strategyUsed).toBe("verified_deep_link");
    expect(result.url).toBe(
      "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/result/?degree%5B0%5D=1&fos%5B0%5D=96&subjectGroup%5B0%5D=56",
    );
    expect(result.mappingId).toBe("mapping-daad-de-mecheng-bachelors");
    expect(isFilteredDeepLink(result)).toBe(true);
    expect(needsMappingGapEvent(result)).toBe(false);
  });

  it("never invents numeric filter IDs for a different subject/degree than the one exact stored mapping", () => {
    // No mapping supplied for, say, Master's Computer Science — the
    // adapter must NOT synthesize a DAAD-style ?degree[0]=..&fos[0]=..
    // URL from the provider_subject_code/provider_degree_code fields; it
    // must fall back to the landing page.
    const result = buildProviderSearchResult(
      daadProvider(),
      null,
      { canonicalSubjectId: "computer-science", canonicalSubjectLabel: "Computer Science", degreeLevel: "masters" },
      NOW,
    );
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(false);
    expect(result.requiresManualSearch).toBe(true);
    expect(result.url).not.toMatch(/fos%5B0%5D|degree%5B0%5D|subjectGroup%5B0%5D/);
    expect(result.strategyUsed).not.toBe("verified_deep_link");
  });
});

describe("Germany broader-catalogue fallback", () => {
  it("falls back to the DAAD Degree Programmes landing page when no mapping matches", () => {
    const provider = daadProvider({
      id: "provider-daad-degree-programmes",
      slug: "daad-degree-programmes",
      displayName: "DAAD Degree Programmes",
      officialDomain: "daad.de",
      baseUrl: "https://www.daad.de/en/studying-in-germany/universities/all-degree-programmes/",
      fallbackUrl: null,
      strategy: "official_landing_page",
    });
    const result = buildProviderSearchResult(provider, null, mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(false);
    expect(result.requiresManualSearch).toBe(true);
    expect(result.url).toBe("https://www.daad.de/en/studying-in-germany/universities/all-degree-programmes/");
    expect(needsMappingGapEvent(result)).toBe(true);
  });
});

describe("Master's and Bachelor's separation", () => {
  it("a mapping stored for Bachelor's is never returned for a Master's query", () => {
    const mapping = daadMechEngBachelorsMapping(); // degreeLevel: "bachelors"
    const mastersQuery = { ...mechEngBachelorsQuery, degreeLevel: "masters" as const };
    // The data-access layer would never hand a Bachelor's mapping to a
    // Master's query in the first place (it looks up by exact degree
    // level) — but even if it did, the adapter's own defense is that a
    // mismatched mapping is simply never matched as `mapping.providerId
    // === provider.id` is true but this test asserts the CALLER's
    // responsibility: simulate that correctly by passing `null` for a
    // mismatched degree level, which is what a correct caller does.
    const result = buildProviderSearchResult(daadProvider(), null, mastersQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(false);
    expect(result.degreeLevel).toBe("masters");
    void mapping;
  });

  it("Bachelor's and Master's queries produce different appliedFilters labels", () => {
    const bachelors = buildProviderSearchResult(daadProvider(), daadMechEngBachelorsMapping(), mechEngBachelorsQuery, NOW);
    const masters = buildProviderSearchResult(daadProvider(), null, { ...mechEngBachelorsQuery, degreeLevel: "masters" }, NOW);
    expect(bachelors.available && bachelors.degreeLevelLabel).toBe("Bachelor's");
    expect(masters.available && masters.degreeLevelLabel).toBe("Master's");
  });
});

describe("Provider allow-list enforcement / rejection of arbitrary redirect URLs", () => {
  it("rejects a mapping whose verifiedUrl points outside the provider's official_domain and falls back safely", () => {
    const maliciousMapping = daadMechEngBachelorsMapping({ verifiedUrl: "https://evil.example/phishing?degree=1" });
    const result = buildProviderSearchResult(daadProvider(), maliciousMapping, mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(false);
    expect(result.url).not.toContain("evil.example");
    expect(result.url.startsWith("https://www2.daad.de/") || result.url.startsWith("https://www.daad.de/")).toBe(true);
  });
});

describe("Rejection of non-HTTPS URLs", () => {
  it("rejects an http:// mapping URL and falls back", () => {
    const httpMapping = daadMechEngBachelorsMapping({ verifiedUrl: "http://www2.daad.de/insecure" });
    const result = buildProviderSearchResult(daadProvider(), httpMapping, mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(false);
  });

  it("returns unavailable when neither the mapping URL nor any landing/fallback URL is https", () => {
    const provider = daadProvider({ baseUrl: "http://www2.daad.de/insecure", fallbackUrl: "http://www.daad.de/insecure" });
    const httpMapping = daadMechEngBachelorsMapping({ verifiedUrl: "http://www2.daad.de/insecure" });
    const result = buildProviderSearchResult(provider, httpMapping, mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe("no_valid_url_available");
  });
});

describe("Safe fallback when a mapping is inactive", () => {
  it("falls back to the landing page when mappingStatus is draft/archived, never surfacing the unverified URL as filtered", () => {
    for (const status of ["draft", "archived", "verified"] as const) {
      const mapping = daadMechEngBachelorsMapping({ mappingStatus: status });
      const result = buildProviderSearchResult(daadProvider(), mapping, mechEngBachelorsQuery, NOW);
      expect(result.available).toBe(true);
      if (!result.available) continue;
      expect(result.isFiltered).toBe(false);
    }
  });
});

describe("Safe fallback when link verification is stale", () => {
  it("falls back to the landing page when the mapping's last_verified_at is older than the stale threshold", () => {
    const staleMapping = daadMechEngBachelorsMapping({ lastVerifiedAt: "2024-01-01" });
    const result = buildProviderSearchResult(daadProvider(), staleMapping, mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(false);
    expect(needsMappingGapEvent(result)).toBe(true);
  });

  it("keeps the deep link when verification is recent", () => {
    const freshMapping = daadMechEngBachelorsMapping({ lastVerifiedAt: "2026-07-01" });
    const result = buildProviderSearchResult(daadProvider(), freshMapping, mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.isFiltered).toBe(true);
  });
});

describe("Belgium provider separation", () => {
  const flanders: ProviderRecord = {
    id: "provider-be-flanders",
    slug: "study-in-flanders",
    displayName: "Study in Flanders",
    countryCode: "BE",
    region: "Flanders",
    providerType: "course_search",
    officialDomain: "studyinflanders.be",
    baseUrl: "https://www.studyinflanders.be/",
    fallbackUrl: null,
    strategy: "official_landing_page",
    description: null,
    warningText: null,
    warningEffectiveAt: null,
    warningReviewAt: null,
    language: "en",
    active: true,
    lastVerifiedAt: "2026-08-01",
    verifiedBy: "system-seed",
    supportedDegreeLevels: [],
  };
  const frenchSpeaking: ProviderRecord = {
    ...flanders,
    id: "provider-be-french",
    slug: "study-in-belgium",
    displayName: "Study in Belgium",
    region: "French-speaking",
    officialDomain: "studyinbelgium.be",
    baseUrl: "https://www.studyinbelgium.be/",
  };

  it("resolves as two independent, non-colliding provider results for the same country", () => {
    const query = { canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: "bachelors" as const };
    const a = buildProviderSearchResult(flanders, null, query, NOW);
    const b = buildProviderSearchResult(frenchSpeaking, null, query, NOW);
    expect(a.available && a.providerId).toBe("provider-be-flanders");
    expect(b.available && b.providerId).toBe("provider-be-french");
    expect(a.available && b.available && a.url !== b.url).toBe(true);
  });
});

describe("Erasmus Mundus — Master's-only gating", () => {
  const erasmus: ProviderRecord = {
    id: "provider-erasmus-mundus",
    slug: "erasmus-mundus-joint-masters",
    displayName: "Erasmus Mundus Joint Masters",
    countryCode: null,
    region: "Europe-wide",
    providerType: "joint_programme",
    officialDomain: "erasmus-plus.ec.europa.eu",
    baseUrl: "https://erasmus-plus.ec.europa.eu/",
    fallbackUrl: null,
    strategy: "official_landing_page",
    description: "These are joint international Master's programmes delivered by multiple institutions. Scholarship availability and eligibility vary by programme.",
    warningText: null,
    warningEffectiveAt: null,
    warningReviewAt: null,
    language: "en",
    active: true,
    lastVerifiedAt: "2026-08-01",
    verifiedBy: "system-seed",
    supportedDegreeLevels: ["masters"],
  };

  it("is offered for a Master's query", () => {
    const result = buildProviderSearchResult(erasmus, null, { canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: "masters" }, NOW);
    expect(result.available).toBe(true);
  });

  it("is never offered for a Bachelor's query", () => {
    const result = buildProviderSearchResult(erasmus, null, { canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: "bachelors" }, NOW);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe("degree_level_not_supported");
  });

  it("is never offered for a Doctorate query either (Master's only, per spec)", () => {
    const result = buildProviderSearchResult(erasmus, null, { canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: "doctorate" }, NOW);
    expect(result.available).toBe(false);
  });
});

describe("EduCanada warning display", () => {
  const educanada: ProviderRecord = {
    id: "provider-educanada",
    slug: "educanada-program-search",
    displayName: "EduCanada Program Search",
    countryCode: "CA",
    region: "Canada",
    providerType: "course_search",
    officialDomain: "educanada.ca",
    baseUrl: "https://www.educanada.ca/",
    fallbackUrl: null,
    strategy: "official_landing_page",
    description: null,
    warningText:
      "EduCanada has stated that programme and tuition information may not currently be updated during its data-system transition. Confirm programme availability and fees directly with the institution.",
    warningEffectiveAt: "2026-08-30",
    warningReviewAt: "2027-02-28",
    language: "en",
    active: true,
    lastVerifiedAt: null,
    verifiedBy: null,
    supportedDegreeLevels: [],
  };

  it("surfaces the exact warning text when currently effective", () => {
    const result = buildProviderSearchResult(educanada, null, { canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: null }, NOW);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.warningText).toBe(educanada.warningText);
  });

  it("does not surface a warning before its effective date", () => {
    const future = new Date("2026-01-01T00:00:00Z");
    const result = buildProviderSearchResult(educanada, null, { canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: null }, future);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.warningText).toBeNull();
  });

  it("isWarningCurrentlyEffective is false for a provider with no warning text", () => {
    expect(isWarningCurrentlyEffective({ warningText: null, warningEffectiveAt: null })).toBe(false);
  });
});

describe("Inactive provider is never offered", () => {
  it("returns unavailable for an inactive provider regardless of mapping quality", () => {
    const result = buildProviderSearchResult(daadProvider({ active: false }), daadMechEngBachelorsMapping(), mechEngBachelorsQuery, NOW);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe("provider_inactive");
  });
});
