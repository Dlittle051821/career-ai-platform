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
  it("has exactly seven entries, one per NW02 launch destination", () => {
    expect(LAUNCH_COUNTRY_PRIMARY_SOURCES.length).toBe(7);
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

    expect(bySlug("study-in-india")).toMatchObject({
      countryCode: "IN",
      authority: "Study in India — Government of India",
      primaryDomain: "studyinindia.gov.in",
    });
    expect(bySlug("daad-international-programmes")).toMatchObject({
      countryCode: "DE",
      authority: "DAAD — German Academic Exchange Service",
      primaryDomain: "daad.de",
    });
    expect(bySlug("education-in-ireland")).toMatchObject({
      countryCode: "IE",
      authority: "Education in Ireland",
      primaryDomain: "educationinireland.com",
    });
    expect(bySlug("study-in-nl")).toMatchObject({
      countryCode: "NL",
      authority: "Study in NL — Nuffic",
      primaryDomain: "studyinnl.org",
    });
    expect(bySlug("campus-france")).toMatchObject({
      countryCode: "FR",
      authority: "Campus France",
      primaryDomain: "campusfrance.org",
    });
    expect(bySlug("universityadmissions-se")).toMatchObject({
      countryCode: "SE",
      primaryDomain: "universityadmissions.se",
    });
    expect(bySlug("study-in-denmark")).toMatchObject({
      countryCode: "DK",
      authority: "Study in Denmark — Danish Ministry of Higher Education and Science",
      primaryDomain: "studyindenmark.dk",
    });
  });

  it("no longer names GB/US/CA/AU as any country's launch-primary (removed from this registry, their provider rows untouched in the database)", () => {
    const codes = LAUNCH_COUNTRY_PRIMARY_SOURCES.map((s) => s.countryCode);
    for (const removed of ["GB", "US", "CA", "AU"]) {
      expect(codes).not.toContain(removed);
    }
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
    expect(getLaunchCountryPrimarySource("GB")).toBeNull();
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
  // NW02 — every launch-primary provider now comes from one of two seed
  // files: 0006 (the original global registry — carries India/Netherlands/
  // France/Sweden/Denmark, each seeded `active = false` pending admin
  // verification) and 0008 (M20A's own seed — carries Germany's pre-
  // existing active row's sibling activations for the ORIGINAL UK/US/CA/
  // AU/IE set; Ireland's launch-primary, `education-in-ireland`, still
  // lives there, active). Checking BOTH files (rather than only 0008, as
  // the pre-NW02 version of this test did) keeps the invariant this test
  // exists for — "the TypeScript registry and the SQL seed cannot silently
  // drift apart" — true for the revised seven-country launch set.
  const seed0006Path = path.join(__dirname, "..", "..", "..", "..", "supabase", "seed", "0006_trusted_course_search_seed.sql");
  const seed0008Path = path.join(__dirname, "..", "..", "..", "..", "supabase", "seed", "0008_m20a_launch_country_sources_seed.sql");
  const seed0006Text = readFileSync(seed0006Path, "utf8");
  const seed0008Text = readFileSync(seed0008Path, "utf8");
  const combinedSeedText = `${seed0006Text}\n${seed0008Text}`;

  it("both seed files exist and insert into the EXISTING external_search_providers table, never a new table", () => {
    expect(seed0006Text).toContain("insert into public.external_search_providers");
    expect(seed0008Text).toContain("insert into public.external_search_providers");
    expect(seed0006Text).not.toMatch(/create table/i);
    expect(seed0008Text).not.toMatch(/create table/i);
  });

  it("one of the two seed files contains every launch-primary providerSlug and primaryDomain, so the TypeScript registry and the SQL seeds cannot silently drift apart", () => {
    for (const entry of LAUNCH_COUNTRY_PRIMARY_SOURCES) {
      expect(combinedSeedText).toContain(`'${entry.providerSlug}'`);
      expect(combinedSeedText).toContain(entry.primaryDomain);
    }
  });

  it("India/Netherlands/France/Sweden/Denmark's provider rows are seeded inactive (active = false) — pending admin verification, never auto-activated by this milestone", () => {
    for (const slug of ["study-in-india", "study-in-nl", "campus-france", "universityadmissions-se", "study-in-denmark"]) {
      const rowMatch = seed0006Text.match(new RegExp(`'${slug}'[\\s\\S]{0,400}`));
      expect(rowMatch, `expected to find the ${slug} row in 0006's seed`).not.toBeNull();
      expect(rowMatch?.[0]).toMatch(/'[a-z]{2}',\s*false,\s*null/);
    }
  });

  it("both seed files are idempotent (use ON CONFLICT DO NOTHING)", () => {
    expect(seed0006Text).toMatch(/on conflict \(slug\) do nothing/i);
    expect(seed0008Text).toMatch(/on conflict \(slug\) do nothing/i);
  });

  it("neither seed file's prose contains unsupported partnership language", () => {
    expect(containsUnsupportedPartnershipLanguage(seed0006Text)).toBe(false);
    expect(containsUnsupportedPartnershipLanguage(seed0008Text)).toBe(false);
  });
});
