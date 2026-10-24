import { describe, expect, it } from "vitest";
import {
  LAUNCH_COUNTRY_CODES,
  LAUNCH_COUNTRY_NAMES,
  getLaunchCountryName,
  isLaunchCountryCode,
  normalizeLaunchCountryCode,
} from "./launch-countries";

describe("LAUNCH_COUNTRY_CODES — exactly seven NW02 launch destinations", () => {
  it("has exactly seven entries", () => {
    expect(LAUNCH_COUNTRY_CODES.length).toBe(7);
  });

  it("is exactly NW02's approved launch-destination set, no more, no fewer", () => {
    expect([...LAUNCH_COUNTRY_CODES].sort()).toEqual(["DE", "DK", "FR", "IE", "IN", "NL", "SE"]);
  });

  it("includes India and excludes the removed GB/US/CA/AU set", () => {
    expect(LAUNCH_COUNTRY_CODES).toContain("IN");
    for (const removed of ["GB", "US", "CA", "AU"]) {
      expect(LAUNCH_COUNTRY_CODES).not.toContain(removed);
    }
  });

  it("includes all six EU01 European destinations", () => {
    for (const code of ["DE", "IE", "NL", "FR", "SE", "DK"]) {
      expect(LAUNCH_COUNTRY_CODES).toContain(code);
    }
  });

  it("does NOT classify India as one of the six European destinations (India is the 7th, distinct entry)", () => {
    const europeanCodes = ["DE", "IE", "NL", "FR", "SE", "DK"];
    expect(europeanCodes).not.toContain("IN");
    expect(LAUNCH_COUNTRY_CODES.length).toBe(europeanCodes.length + 1);
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

  it("uses the consistent public country names the task requires (never a casual abbreviation mixed in)", () => {
    expect(LAUNCH_COUNTRY_NAMES).toEqual({
      IN: "India",
      DE: "Germany",
      IE: "Ireland",
      NL: "Netherlands",
      FR: "France",
      SE: "Sweden",
      DK: "Denmark",
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
    expect(isLaunchCountryCode("GB")).toBe(false);
    expect(isLaunchCountryCode("US")).toBe(false);
    expect(isLaunchCountryCode("CA")).toBe(false);
    expect(isLaunchCountryCode("AU")).toBe(false);
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
    expect(normalizeLaunchCountryCode(" in ")).toBe("IN");
    expect(normalizeLaunchCountryCode("fr")).toBe("FR");
  });

  it("returns null for a country code that is not a Tier 1 launch country", () => {
    expect(normalizeLaunchCountryCode("gb")).toBeNull();
    expect(normalizeLaunchCountryCode("US")).toBeNull();
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
    expect(getLaunchCountryName("in")).toBe("India");
  });

  it("returns null for a non-launch country", () => {
    expect(getLaunchCountryName("GB")).toBeNull();
    expect(getLaunchCountryName(null)).toBeNull();
  });
});
