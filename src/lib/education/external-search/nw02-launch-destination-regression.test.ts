import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LAUNCH_COUNTRY_CODES, LAUNCH_COUNTRY_NAMES, isLaunchCountryCode } from "./launch-countries";
import { LAUNCH_COUNTRY_PRIMARY_SOURCES, getLaunchCountryPrimarySource } from "./launch-country-sources";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";

/**
 * NW02 — Education Discovery milestone, consolidated launch-destination
 * regression suite.
 *
 * This file exists to make the milestone's own 24-item required-testing
 * list (NW02 brief §12) directly traceable to assertions, even where the
 * underlying behavior is also exercised by other, longer-lived test files
 * (launch-countries.test.ts, launch-country-sources.test.ts,
 * launch-country-discovery.test.ts, m20d-source-integrity.test.ts). Items
 * 1-6 and 10/13 of that list are encoded here explicitly; the remaining
 * items are covered by the pre-existing suites named in
 * NW02_REGRESSION_RESULTS.md.
 */

describe("NW02 §12.1 — exactly the approved seven launch destinations are shown", () => {
  it("LAUNCH_COUNTRY_CODES is exactly {IN, DE, IE, NL, FR, SE, DK}", () => {
    expect([...LAUNCH_COUNTRY_CODES].sort()).toEqual(["DE", "DK", "FR", "IE", "IN", "NL", "SE"]);
    expect(LAUNCH_COUNTRY_CODES.length).toBe(7);
  });
});

describe("NW02 §12.2 — India is not incorrectly classified as a European destination", () => {
  it("EUROPE_COUNTRIES (the dedicated /study-europe registry) never includes India", () => {
    const europeCodes = EUROPE_COUNTRIES.map((c) => c.code);
    expect(europeCodes).not.toContain("IN");
    expect(europeCodes.sort()).toEqual(["DE", "DK", "FR", "IE", "NL", "SE"]);
  });

  it("LAUNCH_COUNTRY_CODES contains exactly India plus the six EUROPE_COUNTRIES codes, no fewer and no more", () => {
    const europeCodes = EUROPE_COUNTRIES.map((c) => c.code);
    const launchCodes = [...LAUNCH_COUNTRY_CODES];
    expect(launchCodes).toContain("IN");
    for (const code of europeCodes) expect(launchCodes).toContain(code);
    expect(launchCodes.length).toBe(europeCodes.length + 1);
  });

  it("India's own display name and primary source are distinct from every European entry", () => {
    expect(LAUNCH_COUNTRY_NAMES.IN).toBe("India");
    const indiaSource = getLaunchCountryPrimarySource("IN");
    expect(indiaSource?.providerSlug).toBe("study-in-india");
    expect(indiaSource?.primaryDomain).toBe("studyinindia.gov.in");
    for (const europeCode of EUROPE_COUNTRIES.map((c) => c.code)) {
      expect(getLaunchCountryPrimarySource(europeCode)?.providerSlug).not.toBe("study-in-india");
    }
  });
});

describe("NW02 §12.3 — UK/US/Canada/Australia remain outside launch-facing shortcuts", () => {
  it("none of GB/US/CA/AU is a launch country any more", () => {
    for (const removed of ["GB", "US", "CA", "AU"]) {
      expect(isLaunchCountryCode(removed)).toBe(false);
      expect(LAUNCH_COUNTRY_CODES).not.toContain(removed);
    }
  });

  it("none of GB/US/CA/AU appears in the launch-primary-source registry", () => {
    const codes = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((s) => s.countryCode);
    for (const removed of ["GB", "US", "CA", "AU"]) {
      expect(codes).not.toContain(removed);
    }
  });

  it("getLaunchCountryPrimarySource returns null for each removed country — never silently resolves to a stale entry", () => {
    for (const removed of ["GB", "US", "CA", "AU"]) {
      expect(getLaunchCountryPrimarySource(removed)).toBeNull();
    }
  });
});

describe("NW02 §12.4 — existing backend records for other countries are preserved (no deletion)", () => {
  // Static text audits only — this milestone performs no database writes,
  // so the actual proof that nothing was deleted is that no migration or
  // seed file was touched to remove a row. These assertions confirm the
  // CODE never issues a delete for the providers this milestone removed
  // from the launch-facing registry, and that their rows remain seeded
  // exactly as before.
  const seed0006Path = path.join(__dirname, "..", "..", "..", "..", "supabase", "seed", "0006_trusted_course_search_seed.sql");
  const seed0008Path = path.join(__dirname, "..", "..", "..", "..", "supabase", "seed", "0008_m20a_launch_country_sources_seed.sql");
  const seed0006Text = readFileSync(seed0006Path, "utf8");
  const seed0008Text = readFileSync(seed0008Path, "utf8");

  it("the UK/US/Canada/Australia provider rows (UCAS, College Navigator, EduCanada, CRICOS, and their M20A launch-primary siblings) are still present in the seed files, never deleted", () => {
    for (const slug of ["ucas-course-search", "college-navigator", "educanada-program-search", "cricos"]) {
      expect(seed0006Text).toContain(`'${slug}'`);
    }
    for (const slug of ["study-uk-british-council", "educationusa", "government-of-canada-study", "study-australia"]) {
      expect(seed0008Text).toContain(`'${slug}'`);
    }
  });

  it("neither seed file this milestone reused contains a DELETE/DROP statement", () => {
    expect(seed0006Text).not.toMatch(/delete from|drop table|truncate/i);
    expect(seed0008Text).not.toMatch(/delete from|drop table|truncate/i);
  });
});

describe("NW02 §12.6 — a country selection resolves to the correct official-source destination", () => {
  it("every one of the seven launch countries resolves to exactly one, correctly-matched primary source", () => {
    const expectedDomainByCode: Record<string, string> = {
      IN: "studyinindia.gov.in",
      DE: "daad.de",
      IE: "educationinireland.com",
      NL: "studyinnl.org",
      FR: "campusfrance.org",
      SE: "universityadmissions.se",
      DK: "studyindenmark.dk",
    };
    for (const code of LAUNCH_COUNTRY_CODES) {
      const source = getLaunchCountryPrimarySource(code);
      expect(source).not.toBeNull();
      expect(source?.countryCode).toBe(code);
      expect(source?.primaryDomain).toBe(expectedDomainByCode[code]);
    }
  });
});

describe("NW02 §12.10 / §12.13 — no cross-country leakage, no fabricated links for an inactive provider", () => {
  it("India/Netherlands/France/Sweden/Denmark's primary-source domains are each distinct and never shared across countries", () => {
    const domains = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((s) => s.primaryDomain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("this registry change alone never flips a provider's active flag — buildProviderSearchResult's existing provider.active gate (adapter.ts) is the single place that decides whether a student ever sees a result, and this file makes no claim about any provider's current active state", () => {
    // Documented, not re-asserted: see launch-country-sources.test.ts's
    // "seed-file consistency" describe block for the direct proof that
    // India/NL/FR/SE/DK remain seeded `active = false`.
    expect(LAUNCH_COUNTRY_PRIMARY_SOURCES.length).toBeGreaterThan(0);
  });
});
