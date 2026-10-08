import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LAUNCH_COUNTRY_CODES } from "./launch-countries";
import { validateExternalUrl } from "./url-validation";
import { containsUnsupportedPartnershipLanguage } from "./attribution";
import {
  LAUNCH_COUNTRY_PRIMARY_SOURCES,
  getLaunchCountryPrimarySource,
  hasPrimarySourceForEveryLaunchCountry,
} from "./launch-country-sources";

describe("LAUNCH_COUNTRY_PRIMARY_SOURCES — exactly one primary source per launch country", () => {
  it("has exactly six entries, one per Tier 1 launch country", () => {
    expect(LAUNCH_COUNTRY_PRIMARY_SOURCES.length).toBe(6);
  });

  it("has no duplicate countryCode (the task's own 'no competing primary sources' rule)", () => {
    const codes = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((s) => s.countryCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has no duplicate providerSlug — no provider is double-booked as two countries' primary", () => {
    const slugs = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((s) => s.providerSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers every LAUNCH_COUNTRY_CODES entry (hasPrimarySourceForEveryLaunchCountry)", () => {
    expect(hasPrimarySourceForEveryLaunchCountry()).toBe(true);
    for (const code of LAUNCH_COUNTRY_CODES) {
      expect(LAUNCH_COUNTRY_PRIMARY_SOURCES.some((s) => s.countryCode === code)).toBe(true);
    }
  });

  it("matches the task-specified authority and primary domain for each country exactly", () => {
    const bySlug = (slug: string) => LAUNCH_COUNTRY_PRIMARY_SOURCES.find((s) => s.providerSlug === slug);

    expect(bySlug("daad-international-programmes")).toMatchObject({
      countryCode: "DE",
      authority: "DAAD — German Academic Exchange Service",
      primaryDomain: "daad.de",
    });
    expect(bySlug("study-uk-british-council")).toMatchObject({
      countryCode: "GB",
      authority: "Study UK — British Council",
      primaryDomain: "study-uk.britishcouncil.org",
    });
    expect(bySlug("educationusa")).toMatchObject({
      countryCode: "US",
      authority: "EducationUSA",
      primaryDomain: "educationusa.state.gov",
    });
    expect(bySlug("government-of-canada-study")).toMatchObject({
      countryCode: "CA",
      authority: "Government of Canada",
      primaryDomain: "canada.ca",
    });
    expect(bySlug("study-australia")).toMatchObject({
      countryCode: "AU",
      authority: "Study Australia — Australian Government",
      primaryDomain: "studyaustralia.gov.au",
    });
    expect(bySlug("education-in-ireland")).toMatchObject({
      countryCode: "IE",
      authority: "Education in Ireland",
      primaryDomain: "educationinireland.com",
    });
  });

  it("every entry's countryName matches its countryCode's LAUNCH_COUNTRY_NAMES value", () => {
    for (const entry of LAUNCH_COUNTRY_PRIMARY_SOURCES) {
      expect(getLaunchCountryPrimarySource(entry.countryCode)?.countryName).toBe(entry.countryName);
    }
  });
});

describe("getLaunchCountryPrimarySource", () => {
  it("resolves a country code (case-insensitive) to its primary source", () => {
    expect(getLaunchCountryPrimarySource("de")?.providerSlug).toBe("daad-international-programmes");
    expect(getLaunchCountryPrimarySource("IE")?.providerSlug).toBe("education-in-ireland");
  });

  it("returns null for a country that is not a Tier 1 launch country", () => {
    expect(getLaunchCountryPrimarySource("FR")).toBeNull();
    expect(getLaunchCountryPrimarySource(null)).toBeNull();
    expect(getLaunchCountryPrimarySource("")).toBeNull();
  });
});

describe("safe external URL handling — every primary source's domain is HTTPS-safe and self-consistent", () => {
  it("every primaryDomain, as an https:// landing URL, passes validateExternalUrl against itself", () => {
    for (const entry of LAUNCH_COUNTRY_PRIMARY_SOURCES) {
      const result = validateExternalUrl(`https://${entry.primaryDomain}/`, entry.primaryDomain);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects a javascript: URL even if it mentions a real primary domain", () => {
    const result = validateExternalUrl("javascript:alert(document.domain)", LAUNCH_COUNTRY_PRIMARY_SOURCES[0].primaryDomain);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("javascript_protocol");
  });

  it("rejects a non-HTTPS URL to a real primary domain", () => {
    const result = validateExternalUrl(`http://${LAUNCH_COUNTRY_PRIMARY_SOURCES[0].primaryDomain}/`, LAUNCH_COUNTRY_PRIMARY_SOURCES[0].primaryDomain);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_https");
  });

  it("rejects a look-alike domain impersonating a real primary domain", () => {
    const entry = LAUNCH_COUNTRY_PRIMARY_SOURCES[0];
    const result = validateExternalUrl(`https://${entry.primaryDomain}.evil.example/`, entry.primaryDomain);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("host_not_allowlisted");
  });
});

describe("no unsupported partnership language in this registry's own copy", () => {
  it("no authority or purpose string implies partnership/endorsement/affiliation", () => {
    for (const entry of LAUNCH_COUNTRY_PRIMARY_SOURCES) {
      expect(containsUnsupportedPartnershipLanguage(entry.authority)).toBe(false);
      expect(containsUnsupportedPartnershipLanguage(entry.purpose)).toBe(false);
    }
  });
});

describe("seed-file consistency (static source-text audit — no DB connection in this test environment)", () => {
  const seedPath = path.join(__dirname, "..", "..", "..", "..", "supabase", "seed", "0008_m20a_launch_country_sources_seed.sql");
  const seedText = readFileSync(seedPath, "utf8");

  it("the seed file exists and inserts into the EXISTING external_search_providers table, never a new table", () => {
    expect(seedText).toContain("insert into public.external_search_providers");
    expect(seedText).not.toMatch(/create table/i);
  });

  it("the seed file contains every non-Germany launch-primary providerSlug and primaryDomain, so the TypeScript registry and the SQL seed cannot silently drift apart", () => {
    for (const entry of LAUNCH_COUNTRY_PRIMARY_SOURCES) {
      if (entry.countryCode === "DE") continue; // Germany's source was seeded by the pre-existing 0006 seed, not this file.
      expect(seedText).toContain(`'${entry.providerSlug}'`);
      expect(seedText).toContain(entry.primaryDomain);
    }
  });

  it("the seed file is idempotent (uses ON CONFLICT DO NOTHING, same convention as 0006's seed)", () => {
    expect(seedText).toMatch(/on conflict \(slug\) do nothing/i);
  });

  it("the seed file never fabricates a verified subject/degree deep-link mapping for these five providers", () => {
    expect(seedText).not.toContain("insert into public.external_search_mappings");
  });

  it("the seed file's own prose contains no unsupported partnership language", () => {
    expect(containsUnsupportedPartnershipLanguage(seedText)).toBe(false);
  });
});
