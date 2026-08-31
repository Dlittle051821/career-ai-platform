import { describe, expect, it } from "vitest";
import { isGstConfigured, applicableTaxRateBps, invoiceDocumentLabel } from "./tax";
import type { BillingSettings } from "@/types/payments";

function settings(overrides: Partial<BillingSettings> = {}): BillingSettings {
  return {
    legalEntityName: "NextWise",
    businessAddress: null,
    supportEmail: null,
    supportPhone: null,
    gstRegistered: false,
    gstin: null,
    defaultTaxRateBps: null,
    invoiceFooterNote: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isGstConfigured", () => {
  it("is false for null settings", () => {
    expect(isGstConfigured(null)).toBe(false);
  });

  it("is false when gst_registered is false even if a gstin is somehow present", () => {
    expect(isGstConfigured(settings({ gstRegistered: false, gstin: "22AAAAA0000A1Z5" }))).toBe(false);
  });

  it("is false when gst_registered is true but gstin is empty/whitespace", () => {
    expect(isGstConfigured(settings({ gstRegistered: true, gstin: "" }))).toBe(false);
    expect(isGstConfigured(settings({ gstRegistered: true, gstin: "   " }))).toBe(false);
    expect(isGstConfigured(settings({ gstRegistered: true, gstin: null }))).toBe(false);
  });

  it("is true only when both gst_registered is true and gstin is a real non-empty value", () => {
    expect(isGstConfigured(settings({ gstRegistered: true, gstin: "22AAAAA0000A1Z5" }))).toBe(true);
  });
});

describe("applicableTaxRateBps", () => {
  it("never invents a tax rate when GST is not configured, even with a default rate set", () => {
    expect(applicableTaxRateBps(settings({ gstRegistered: false, defaultTaxRateBps: 1800 }), null)).toBeNull();
  });

  it("uses the per-line override when GST is configured and an override is given", () => {
    const s = settings({ gstRegistered: true, gstin: "22AAAAA0000A1Z5", defaultTaxRateBps: 1800 });
    expect(applicableTaxRateBps(s, 500)).toBe(500);
  });

  it("falls back to the configured default rate when no override is given", () => {
    const s = settings({ gstRegistered: true, gstin: "22AAAAA0000A1Z5", defaultTaxRateBps: 1800 });
    expect(applicableTaxRateBps(s, null)).toBe(1800);
  });

  it("returns null when GST is configured but no default rate has been set and no override given", () => {
    const s = settings({ gstRegistered: true, gstin: "22AAAAA0000A1Z5", defaultTaxRateBps: null });
    expect(applicableTaxRateBps(s, null)).toBeNull();
  });
});

describe("invoiceDocumentLabel", () => {
  it("never claims 'Tax Invoice' unless GST is genuinely configured", () => {
    expect(invoiceDocumentLabel(null)).toBe("Invoice");
    expect(invoiceDocumentLabel(settings({ gstRegistered: false }))).toBe("Invoice");
    expect(invoiceDocumentLabel(settings({ gstRegistered: true, gstin: "" }))).toBe("Invoice");
  });

  it("says 'Tax Invoice' once GST is genuinely configured", () => {
    expect(invoiceDocumentLabel(settings({ gstRegistered: true, gstin: "22AAAAA0000A1Z5" }))).toBe("Tax Invoice");
  });
});
