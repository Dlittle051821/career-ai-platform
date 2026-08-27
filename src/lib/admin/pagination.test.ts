import { describe, expect, it } from "vitest";
import { cleanFilterParam, clampPageSize, MAX_ADMIN_PAGE_SIZE, pageToRange, parsePageParam } from "./pagination";

describe("parsePageParam", () => {
  it("defaults to page 1 when absent", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it("parses a valid page number", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("rejects 0, negative, and non-numeric values by falling back to 1", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-5")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });
});

describe("clampPageSize", () => {
  it("uses the default when not provided", () => {
    expect(clampPageSize(undefined)).toBeGreaterThan(0);
  });

  it("clamps above the maximum", () => {
    expect(clampPageSize(10_000)).toBe(MAX_ADMIN_PAGE_SIZE);
  });

  it("clamps below 1", () => {
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(-5)).toBe(1);
  });
});

describe("pageToRange", () => {
  it("computes a zero-based inclusive range for page 1", () => {
    expect(pageToRange(1, 20)).toEqual({ from: 0, to: 19 });
  });

  it("computes the correct range for a later page", () => {
    expect(pageToRange(3, 20)).toEqual({ from: 40, to: 59 });
  });
});

describe("cleanFilterParam", () => {
  it("returns undefined for an empty or whitespace-only value", () => {
    expect(cleanFilterParam("")).toBeUndefined();
    expect(cleanFilterParam("   ")).toBeUndefined();
    expect(cleanFilterParam(undefined)).toBeUndefined();
  });

  it("trims and returns a real value", () => {
    expect(cleanFilterParam("  paid  ")).toBe("paid");
  });
});
