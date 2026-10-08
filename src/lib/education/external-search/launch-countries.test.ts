import { describe, expect, it } from "vitest";
import {
  LAUNCH_COUNTRY_CODES,
  LAUNCH_COUNTRY_NAMES,
  getLaunchCountryName,
  isLaunchCountryCode,
  normalizeLaunchCountryCode,
} from "./launch-countries";

describe("LAUNCH_COUNTRY_CODES — exactly six Tier 1 launch countries", () => {
  it("has exactly six entries", () => {
    expect(LAUNCH_COUNTRY_CODES.length).toBe(6);
  });

  it("is exactly the task-specified set of ISO alpha-2 codes, no more, no fewer", () => {
    expect([...LAUNCH_COUNTRY_CODES].sort()).toEqual(["AU", "CA", "DE", "GB", "IE", "US"]);
  });

  it("has no duplicate codes", () => {
    expect(new Set(LAUNCH_COUNTRY_CODES).size).toBe(LAUNCH_COUNTRY_CODES.length);
  });

  it("every code is uppercase ISO alpha-2 shape (two uppercase letters), matching this codebase's existing country-code convention", () => {
    for (const code of LAUNCH_COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("has a display name for every code, with no stray names for codes outside the list", () => {
    expect(Object.keys(LAUNCH_COUNTRY_NAMES).sort()).toEqual([...LAUNCH_COUNTRY_CODES].sort());
  });

  it("uses the consistent public country names the task requires (never USA/US/United States of America mixed in)", () => {
    expect(LAUNCH_COUNTRY_NAMES).toEqual({
      DE: "Germany",
      GB: "United Kingdom",
      US: "United States",
      CA: "Canada",
      AU: "Australia",
      IE: "Ireland",
    });
  });
});

describe("isLaunchCountryCode", () => {
  it("accepts every launch-country code", () => {
    for (const code of LAUNCH_COUNTRY_CODES) {
      expect(isLaunchCountryCode(code)).toBe(true);
    }
  });

  it("rejects a non-launch country code, even a real ISO alpha-2 one", () => {
    expect(isLaunchCountryCode("FR")).toBe(false);
    expect(isLaunchCountryCode("IN")).toBe(false);
  });

  it("rejects a lowercase or malformed code without normalizing it", () => {
    expect(isLaunchCountryCode("de")).toBe(false);
    expect(isLaunchCountryCode("Germany")).toBe(false);
    expect(isLaunchCountryCode("")).toBe(false);
  });
});

describe("normalizeLaunchCountryCode", () => {
  it("uppercases and trims a valid launch-country code", () => {
    expect(normalizeLaunchCountryCode("de")).toBe("DE");
    expect(normalizeLaunchCountryCode(" gb ")).toBe("GB");
    expect(normalizeLaunchCountryCode("Us")).toBe("US");
  });

  it("returns null for a country code that is not a Tier 1 launch country", () => {
    expect(normalizeLaunchCountryCode("fr")).toBeNull();
    expect(normalizeLaunchCountryCode("IN")).toBeNull();
  });

  it("returns null for empty/null/undefined input", () => {
    expect(normalizeLaunchCountryCode("")).toBeNull();
    expect(normalizeLaunchCountryCode(null)).toBeNull();
    expect(normalizeLaunchCountryCode(undefined)).toBeNull();
  });

  it("returns null for a non-country-code string rather than throwing", () => {
    expect(normalizeLaunchCountryCode("not a country")).toBeNull();
    expect(normalizeLaunchCountryCode("123")).toBeNull();
  });
});

describe("getLaunchCountryName", () => {
  it("returns the public display name for a launch country, normalizing case first", () => {
    expect(getLaunchCountryName("de")).toBe("Germany");
    expect(getLaunchCountryName("AU")).toBe("Australia");
  });

  it("returns null for a non-launch country", () => {
    expect(getLaunchCountryName("FR")).toBeNull();
    expect(getLaunchCountryName(null)).toBeNull();
  });
});
