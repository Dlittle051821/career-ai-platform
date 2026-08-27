import { describe, expect, it } from "vitest";
import { buildBillingSnapshot } from "./snapshot";
import type { BillingSettings } from "@/types/payments";

function settings(overrides: Partial<BillingSettings> = {}): BillingSettings {
  return {
    legalEntityName: "CareerPath AI",
    businessAddress: "123 Example Street",
    supportEmail: "support@example.com",
    supportPhone: null,
    gstRegistered: false,
    gstin: null,
    defaultTaxRateBps: null,
    invoiceFooterNote: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildBillingSnapshot", () => {
  it("captures the student's name and email as given", () => {
    const snap = buildBillingSnapshot({ studentName: "Asha Patel", studentEmail: "asha@example.com", settings: settings() });
    expect(snap.studentName).toBe("Asha Patel");
    expect(snap.studentEmail).toBe("asha@example.com");
  });

  it("falls back to a generic label when the student has no name on file", () => {
    const snap = buildBillingSnapshot({ studentName: null, studentEmail: null, settings: settings() });
    expect(snap.studentName).toBe("Student");
  });

  it("trims a whitespace-only name to the generic fallback rather than storing blank text", () => {
    const snap = buildBillingSnapshot({ studentName: "   ", studentEmail: null, settings: settings() });
    expect(snap.studentName).toBe("Student");
  });

  it("captures legal entity name and address from settings", () => {
    const snap = buildBillingSnapshot({ studentName: "Asha", studentEmail: null, settings: settings() });
    expect(snap.legalEntityName).toBe("CareerPath AI");
    expect(snap.businessAddress).toBe("123 Example Street");
  });

  it("never freezes a GSTIN when GST is not genuinely configured, even if a gstin value is somehow present", () => {
    const snap = buildBillingSnapshot({ studentName: "Asha", studentEmail: null, settings: settings({ gstRegistered: false, gstin: "22AAAAA0000A1Z5" }) });
    expect(snap.gstin).toBeNull();
    expect(snap.gstRegisteredAtIssuance).toBe(false);
  });

  it("freezes the GSTIN when GST is genuinely configured at the moment of snapshotting", () => {
    const snap = buildBillingSnapshot({ studentName: "Asha", studentEmail: null, settings: settings({ gstRegistered: true, gstin: "22AAAAA0000A1Z5" }) });
    expect(snap.gstin).toBe("22AAAAA0000A1Z5");
    expect(snap.gstRegisteredAtIssuance).toBe(true);
  });

  it("handles null settings entirely (billing_settings unreadable) without throwing", () => {
    const snap = buildBillingSnapshot({ studentName: "Asha", studentEmail: "asha@example.com", settings: null });
    expect(snap.legalEntityName).toBeNull();
    expect(snap.gstRegisteredAtIssuance).toBe(false);
  });
});
