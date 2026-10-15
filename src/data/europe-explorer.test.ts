import { describe, expect, it } from "vitest";
import { EUROPE_COUNTRIES, getEuropeCountry, type EuropeCountryCode } from "./europe-explorer";
import { LAUNCH_COUNTRY_PRIMARY_SOURCES } from "@/lib/education/external-search/launch-country-sources";
import { validateExternalUrl } from "@/lib/education/external-search/url-validation";
import { containsUnsupportedPartnershipLanguage } from "@/lib/education/external-search/attribution";

/**
 * UX10-EU01 regression suite for `src/data/europe-explorer.ts` — the
 * launch-country registry backing the new `/study-europe` page.
 *
 * This file exists specifically to enforce the brief's own
 * non-negotiable rules for this milestone: Europe-only launch countries
 * (never the UK/USA/Canada/Australia this page shares no space with),
 * a single, correctly-flagged "Recommended First" country, every
 * official-source link passing the SAME HTTPS/credential/domain checks
 * the existing M20 registry already enforces for its own six countries,
 * and no accidental partnership/endorsement language anywhere in the
 * officialSource copy.
 */

const EXPECTED_CODES: EuropeCountryCode[] = ["DE", "IE", "NL", "FR", "SE", "DK"];
const FORBIDDEN_COUNTRY_CODES = ["GB", "US", "CA", "AU"];

describe("EUROPE_COUNTRIES — launch country set", () => {
  it("contains exactly the six Europe-first launch countries, in the brief's own order", () => {
    expect(EUROPE_COUNTRIES.map((c) => c.code)).toEqual(EXPECTED_CODES);
  });

  it("never includes the UK, USA, Canada, or Australia", () => {
    const codes = EUROPE_COUNTRIES.map((c) => c.code);
    for (const forbidden of FORBIDDEN_COUNTRY_CODES) {
      expect(codes).not.toContain(forbidden);
    }
  });

  it("has exactly one recommended country, and it is Germany", () => {
    const recommended = EUROPE_COUNTRIES.filter((c) => c.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0]?.code).toBe("DE");
  });

  it("gives every country a non-empty name, slug, and all four qualitative profile fields", () => {
    for (const country of EUROPE_COUNTRIES) {
      expect(country.name.length).toBeGreaterThan(0);
      expect(country.slug.length).toBeGreaterThan(0);
      expect(country.tuitionProfile.length).toBeGreaterThan(0);
      expect(country.englishAvailability.length).toBeGreaterThan(0);
      expect(country.livingCostProfile.length).toBeGreaterThan(0);
      expect(country.admissionProfile.length).toBeGreaterThan(0);
      expect(country.postStudyProfile.length).toBeGreaterThan(0);
    }
  });

  it("never fabricates a numeric tuition/cost figure in any qualitative profile field", () => {
    // Guards against a specific currency amount or bare percentage sneaking
    // into what must stay a qualitative, hedged label — e.g. "$12,000" or
    // "30% cheaper". A bare year (e.g. "since 2011") is allowed; it is not
    // a fabricated statistic about cost/tuition.
    const currencyOrPercent = /[$€£₹]\s*\d|\d+\s*%/;
    for (const country of EUROPE_COUNTRIES) {
      expect(country.tuitionProfile).not.toMatch(currencyOrPercent);
      expect(country.livingCostProfile).not.toMatch(currencyOrPercent);
    }
  });
});

describe("EUROPE_COUNTRIES — official source integrity", () => {
  it("passes validateExternalUrl against its own declared primaryDomain for every country", () => {
    for (const country of EUROPE_COUNTRIES) {
      const result = validateExternalUrl(country.officialSource.url, country.officialSource.primaryDomain);
      expect(result.valid).toBe(true);
    }
  });

  it("never contains unsupported partnership/endorsement language in authority or purpose text", () => {
    for (const country of EUROPE_COUNTRIES) {
      expect(containsUnsupportedPartnershipLanguage(country.officialSource.authority)).toBe(false);
      expect(containsUnsupportedPartnershipLanguage(country.officialSource.purpose)).toBe(false);
    }
  });

  it("reuses (never retypes) Germany and Ireland's authority/domain from the existing M20 registry", () => {
    const de = EUROPE_COUNTRIES.find((c) => c.code === "DE");
    const ie = EUROPE_COUNTRIES.find((c) => c.code === "IE");
    const m20de = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((s) => s.countryCode === "DE");
    const m20ie = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((s) => s.countryCode === "IE");

    expect(de?.officialSource.authority).toBe(m20de?.authority);
    expect(de?.officialSource.primaryDomain).toBe(m20de?.primaryDomain);
    expect(de?.officialSource.purpose).toBe(m20de?.purpose);

    expect(ie?.officialSource.authority).toBe(m20ie?.authority);
    expect(ie?.officialSource.primaryDomain).toBe(m20ie?.primaryDomain);
    expect(ie?.officialSource.purpose).toBe(m20ie?.purpose);
  });

  it("gives every country a distinct official-source domain", () => {
    const domains = EUROPE_COUNTRIES.map((c) => c.officialSource.primaryDomain);
    expect(new Set(domains).size).toBe(domains.length);
  });
});

describe("getEuropeCountry()", () => {
  it("returns the matching country for every valid code", () => {
    for (const code of EXPECTED_CODES) {
      expect(getEuropeCountry(code).code).toBe(code);
    }
  });

  it("throws for a code not in the Europe-only launch set", () => {
    // @ts-expect-error — deliberately passing an invalid code to assert the runtime guard
    expect(() => getEuropeCountry("GB")).toThrow();
  });
});
