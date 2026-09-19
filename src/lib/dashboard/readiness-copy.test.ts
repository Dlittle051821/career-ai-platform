import { describe, expect, it } from "vitest";
import { READINESS_LEVELS } from "@/types/recommendation-readiness";
import { getReadinessCopy, isReadinessStillBuilding } from "./readiness-copy";

describe("getReadinessCopy", () => {
  it("returns a non-empty headline and description for every readiness level, never a raw enum value", () => {
    for (const level of READINESS_LEVELS) {
      const copy = getReadinessCopy(level);
      expect(copy.headline.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
      expect(copy.headline).not.toBe(level);
      expect(copy.headline).not.toMatch(/NOT_READY|PRELIMINARY|READY|COUNSELLOR_VERIFIED/);
      expect(copy.description).not.toMatch(/NOT_READY|PRELIMINARY|READY|COUNSELLOR_VERIFIED/);
    }
  });

  it("gives READY and COUNSELLOR_VERIFIED distinct copy from each other", () => {
    expect(getReadinessCopy("READY").headline).not.toBe(getReadinessCopy("COUNSELLOR_VERIFIED").headline);
  });
});

describe("isReadinessStillBuilding", () => {
  it("is true only for NOT_READY and PRELIMINARY", () => {
    expect(isReadinessStillBuilding("NOT_READY")).toBe(true);
    expect(isReadinessStillBuilding("PRELIMINARY")).toBe(true);
    expect(isReadinessStillBuilding("READY")).toBe(false);
    expect(isReadinessStillBuilding("COUNSELLOR_VERIFIED")).toBe(false);
  });
});
