import { describe, expect, it } from "vitest";
import { isRecommendationType, validateClearRecommendationVerification, validateSetRecommendationVerification } from "./readiness-rules";

describe("recommendations/readiness-rules", () => {
  describe("validateSetRecommendationVerification", () => {
    const base = { hasPermission: true, recommendationType: "career", hasCounsellorId: true };

    it("accepts a valid input", () => {
      expect(validateSetRecommendationVerification(base)).toEqual({ ok: true });
    });

    it("rejects without permission", () => {
      expect(validateSetRecommendationVerification({ ...base, hasPermission: false }).ok).toBe(false);
    });

    it("rejects an unrecognized recommendation type", () => {
      const result = validateSetRecommendationVerification({ ...base, recommendationType: "not_a_type" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/not a recognized recommendation type/i);
    });

    it("rejects without a linked counsellor id — unlike profile provenance, this is never optional (the column is NOT NULL)", () => {
      const result = validateSetRecommendationVerification({ ...base, hasCounsellorId: false });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/counsellor account/i);
    });

    it.each(["career", "course", "college", "pathway"])("accepts every real recommendation type: %s", (recommendationType) => {
      expect(validateSetRecommendationVerification({ ...base, recommendationType })).toEqual({ ok: true });
    });
  });

  describe("validateClearRecommendationVerification", () => {
    it("accepts a valid input without requiring a counsellor id (clearing is allowed for any authorized admin)", () => {
      expect(validateClearRecommendationVerification({ hasPermission: true, recommendationType: "career" })).toEqual({ ok: true });
    });

    it("rejects without permission", () => {
      expect(validateClearRecommendationVerification({ hasPermission: false, recommendationType: "career" }).ok).toBe(false);
    });

    it("rejects an unrecognized recommendation type", () => {
      const result = validateClearRecommendationVerification({ hasPermission: true, recommendationType: "bogus" });
      expect(result.ok).toBe(false);
    });
  });

  describe("isRecommendationType", () => {
    it("accepts every real type and rejects unknown strings", () => {
      expect(isRecommendationType("career")).toBe(true);
      expect(isRecommendationType("bogus")).toBe(false);
    });
  });
});
