import { describe, expect, it } from "vitest";
import { isProfileSectionKey, isProvenanceValue, validateSetSectionProvenance } from "./rules";

describe("profile-provenance/rules", () => {
  describe("validateSetSectionProvenance", () => {
    const base = { hasPermission: true, sectionKey: "education", provenance: "COUNSELLOR_VERIFIED", hasCounsellorId: true };

    it("accepts a valid COUNSELLOR_VERIFIED input with a counsellor id", () => {
      expect(validateSetSectionProvenance(base)).toEqual({ ok: true });
    });

    it("accepts a valid COUNSELLOR_ENTERED input even without a counsellor id (an admin can record it too)", () => {
      expect(validateSetSectionProvenance({ ...base, provenance: "COUNSELLOR_ENTERED", hasCounsellorId: false })).toEqual({ ok: true });
    });

    it("rejects without permission", () => {
      expect(validateSetSectionProvenance({ ...base, hasPermission: false }).ok).toBe(false);
    });

    it("rejects an unrecognized section key", () => {
      const result = validateSetSectionProvenance({ ...base, sectionKey: "not_a_real_section" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/not a recognized profile section/i);
    });

    it("rejects an unrecognized provenance value", () => {
      const result = validateSetSectionProvenance({ ...base, provenance: "MADE_UP" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/not a recognized provenance/i);
    });

    it.each(["SELF_ENTERED", "SYSTEM_DERIVED"])("rejects %s — never chosen by a counsellor action", (provenance) => {
      const result = validateSetSectionProvenance({ ...base, provenance });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/set automatically/i);
    });

    it("rejects COUNSELLOR_VERIFIED without a counsellor id", () => {
      const result = validateSetSectionProvenance({ ...base, hasCounsellorId: false });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/counsellor account/i);
    });
  });

  describe("isProfileSectionKey / isProvenanceValue", () => {
    it("accepts every real section key", () => {
      expect(isProfileSectionKey("education")).toBe(true);
      expect(isProfileSectionKey("bogus")).toBe(false);
    });

    it("accepts every real provenance value", () => {
      expect(isProvenanceValue("COUNSELLOR_VERIFIED")).toBe(true);
      expect(isProvenanceValue("bogus")).toBe(false);
    });
  });
});
