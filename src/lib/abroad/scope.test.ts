import { describe, expect, it } from "vitest";
import { isAbroadDestinationName, getAbroadDestinationPreferences } from "./scope";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";

describe("isAbroadDestinationName()", () => {
  it("is true for every current EUROPE_COUNTRIES name, case-insensitively", () => {
    for (const country of EUROPE_COUNTRIES) {
      expect(isAbroadDestinationName(country.name)).toBe(true);
      expect(isAbroadDestinationName(country.name.toUpperCase())).toBe(true);
      expect(isAbroadDestinationName(country.name.toLowerCase())).toBe(true);
    }
  });

  it("is false for a non-Abroad country", () => {
    expect(isAbroadDestinationName("India")).toBe(false);
    expect(isAbroadDestinationName("USA")).toBe(false);
  });

  it("is false for null/undefined (never throws on a saved item with no resolved country)", () => {
    expect(isAbroadDestinationName(null)).toBe(false);
    expect(isAbroadDestinationName(undefined)).toBe(false);
  });
});

describe("getAbroadDestinationPreferences()", () => {
  it("returns only the Abroad-launch-destination subset of the student's selections, in registry order", () => {
    expect(getAbroadDestinationPreferences(["usa", "sweden", "india", "germany"])).toEqual(["Germany", "Sweden"]);
  });

  it("returns [] when the student selected no Abroad destination", () => {
    expect(getAbroadDestinationPreferences(["usa", "canada", "india"])).toEqual([]);
  });

  it("returns [] for an empty selection — never a fabricated default", () => {
    expect(getAbroadDestinationPreferences([])).toEqual([]);
  });

  it("ignores an unknown/invalid key rather than throwing", () => {
    expect(getAbroadDestinationPreferences(["not-a-real-key", "france"])).toEqual(["France"]);
  });

  it("can never surface Denmark — COUNTRY_OPTIONS has no selectable 'denmark' key today, a real data gap, not something to fabricate around", () => {
    expect(getAbroadDestinationPreferences(["denmark"])).toEqual([]);
  });
});
