import { describe, expect, it } from "vitest";
import {
  buildContainsIlikePattern,
  clampPublicPageSize,
  escapeIlikeMetacharacters,
  parseMinorUnitsParam,
  parseScoreParam,
  sanitizeFilterList,
  sanitizeSearchQuery,
} from "./search";

describe("sanitizeSearchQuery", () => {
  it("trims and returns an ordinary query", () => {
    expect(sanitizeSearchQuery("  computer science  ")).toBe("computer science");
  });

  it("returns undefined for empty/null/undefined input", () => {
    expect(sanitizeSearchQuery("")).toBeUndefined();
    expect(sanitizeSearchQuery(null)).toBeUndefined();
    expect(sanitizeSearchQuery(undefined)).toBeUndefined();
  });

  it("strips control characters", () => {
    expect(sanitizeSearchQuery("hello\x00world\x1f")).toBe("helloworld");
  });

  it("clamps overly long input to the max length", () => {
    const long = "a".repeat(500);
    expect(sanitizeSearchQuery(long)?.length).toBe(200);
  });

  it("returns undefined when the query is only control characters/whitespace", () => {
    expect(sanitizeSearchQuery("   \x00\x01  ")).toBeUndefined();
  });
});

describe("escapeIlikeMetacharacters / buildContainsIlikePattern", () => {
  it("escapes %, _, and backslash", () => {
    expect(escapeIlikeMetacharacters("100%_off\\path")).toBe("100\\%\\_off\\\\path");
  });

  it("leaves an ordinary string untouched", () => {
    expect(escapeIlikeMetacharacters("Oxford")).toBe("Oxford");
  });

  it("wraps an escaped value in wildcard percent signs", () => {
    expect(buildContainsIlikePattern("50%")).toBe("%50\\%%");
  });
});

describe("sanitizeFilterList", () => {
  it("dedupes and trims values", () => {
    expect(sanitizeFilterList(["DE", " DE ", "GB"])).toEqual(["DE", "GB"]);
  });

  it("drops empty/whitespace-only entries", () => {
    expect(sanitizeFilterList(["DE", "", "  ", "GB"])).toEqual(["DE", "GB"]);
  });

  it("returns an empty array for undefined/null/empty input", () => {
    expect(sanitizeFilterList(undefined)).toEqual([]);
    expect(sanitizeFilterList(null)).toEqual([]);
    expect(sanitizeFilterList([])).toEqual([]);
  });

  it("caps the list at the max length, preventing an unbounded IN(...) clause", () => {
    const many = Array.from({ length: 100 }, (_, i) => `country-${i}`);
    expect(sanitizeFilterList(many, 10).length).toBe(10);
  });
});

describe("parseMinorUnitsParam", () => {
  it("parses a valid non-negative integer string", () => {
    expect(parseMinorUnitsParam("150000")).toBe(150000);
  });

  it("returns undefined for a negative value", () => {
    expect(parseMinorUnitsParam("-100")).toBeUndefined();
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseMinorUnitsParam("abc")).toBeUndefined();
  });

  it("returns undefined for missing input", () => {
    expect(parseMinorUnitsParam(undefined)).toBeUndefined();
    expect(parseMinorUnitsParam(null)).toBeUndefined();
  });
});

describe("parseScoreParam", () => {
  it("parses a valid score within range", () => {
    expect(parseScoreParam("6.5", 0, 9)).toBe(6.5);
  });

  it("returns undefined for a score outside the range", () => {
    expect(parseScoreParam("15", 0, 9)).toBeUndefined();
    expect(parseScoreParam("-1", 0, 9)).toBeUndefined();
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseScoreParam("abc", 0, 9)).toBeUndefined();
  });
});

describe("clampPublicPageSize", () => {
  it("uses the default when unset", () => {
    expect(clampPublicPageSize(undefined)).toBe(20);
  });

  it("clamps to the public max, which is smaller than the admin max (spec: never load the full DB into the browser)", () => {
    expect(clampPublicPageSize(10000)).toBe(60);
  });

  it("clamps below 1 up to 1", () => {
    expect(clampPublicPageSize(-5)).toBe(1);
  });
});
