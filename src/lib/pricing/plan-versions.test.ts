import { describe, expect, it } from "vitest";
import {
  activeInclusions,
  buildComparisonRow,
  formatComparisonCell,
  hasApprovedBenefits,
  highlightedInclusions,
  isVersionCurrentlyEffective,
  NEUTRAL_SCOPE_FALLBACK,
  paymentTypeLabel,
  sortInclusionsByDisplayOrder,
  visibleInclusionsInOrder,
} from "./plan-versions";
import type { PricingInclusion, PricingPlanVersion } from "@/types/pricing";

function version(overrides: Partial<PricingPlanVersion> = {}): PricingPlanVersion {
  return {
    id: "version-1",
    planId: "plan-1",
    versionNumber: 1,
    publicTitle: "School Counselling",
    shortDescription: null,
    detailedDescription: null,
    currency: "INR",
    amountMinorUnits: 500_000,
    paymentType: "one_time",
    billingInterval: null,
    includedServices: [],
    exclusions: [],
    ctaText: null,
    taxStatus: "unconfigured",
    status: "published",
    effectiveFrom: null,
    effectiveUntil: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    sessionCount: null,
    sessionDurationNote: null,
    audienceLabel: null,
    universityShortlistLimit: null,
    applicationSupportLimit: null,
    sopReviewRounds: null,
    scholarshipSupportNote: null,
    mockInterviewCount: null,
    counsellorTier: null,
    supportDurationNote: null,
    ...overrides,
  };
}

function inclusion(overrides: Partial<PricingInclusion> = {}): PricingInclusion {
  return {
    id: "incl-1",
    planVersionId: "version-1",
    displayOrder: 0,
    title: "One inclusion",
    explanation: null,
    category: null,
    numericAllowance: null,
    unit: null,
    isHighlight: false,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isVersionCurrentlyEffective", () => {
  it("is false for a draft version even with no effective window set", () => {
    expect(isVersionCurrentlyEffective(version({ status: "draft" }))).toBe(false);
  });

  it("is false for an archived version", () => {
    expect(isVersionCurrentlyEffective(version({ status: "archived" }))).toBe(false);
  });

  it("is true for a published version with no effective window at all", () => {
    expect(isVersionCurrentlyEffective(version({ status: "published", effectiveFrom: null, effectiveUntil: null }))).toBe(true);
  });

  it("is false when effectiveFrom is in the future — 'publish future pricing' must not go live early", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const v = version({ status: "published", effectiveFrom: "2026-07-01T00:00:00Z" });
    expect(isVersionCurrentlyEffective(v, now)).toBe(false);
  });

  it("is true once `now` reaches a future effectiveFrom", () => {
    const now = new Date("2026-07-01T00:00:01Z");
    const v = version({ status: "published", effectiveFrom: "2026-07-01T00:00:00Z" });
    expect(isVersionCurrentlyEffective(v, now)).toBe(true);
  });

  it("is false once `now` passes effectiveUntil", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const v = version({ status: "published", effectiveUntil: "2026-07-01T00:00:00Z" });
    expect(isVersionCurrentlyEffective(v, now)).toBe(false);
  });

  it("is true while `now` is inside an explicit effective window", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const v = version({ status: "published", effectiveFrom: "2026-06-01T00:00:00Z", effectiveUntil: "2026-07-01T00:00:00Z" });
    expect(isVersionCurrentlyEffective(v, now)).toBe(true);
  });
});

describe("hasApprovedBenefits", () => {
  it("is false for an empty includedServices list — must show the neutral fallback, never invent scope", () => {
    expect(hasApprovedBenefits(version({ includedServices: [] }))).toBe(false);
  });

  it("is true once at least one admin-entered service exists", () => {
    expect(hasApprovedBenefits(version({ includedServices: [{ label: "Two 1:1 counselling sessions" }] }))).toBe(true);
  });
});

describe("NEUTRAL_SCOPE_FALLBACK", () => {
  it("is the exact required copy — never invented session counts, guarantees, or scope", () => {
    expect(NEUTRAL_SCOPE_FALLBACK).toBe("Contact NextWise for the detailed service scope.");
  });
});

describe("paymentTypeLabel", () => {
  it("labels one_time as 'One-time payment' — never 'monthly'/'yearly' wording", () => {
    expect(paymentTypeLabel(version({ paymentType: "one_time" }))).toBe("One-time payment");
    expect(paymentTypeLabel(version({ paymentType: "one_time" }))).not.toMatch(/month|year|subscription/i);
  });
});

describe("sortInclusionsByDisplayOrder", () => {
  it("sorts ascending by displayOrder", () => {
    const items = [inclusion({ id: "c", displayOrder: 3, title: "Third" }), inclusion({ id: "a", displayOrder: 1, title: "First" }), inclusion({ id: "b", displayOrder: 2, title: "Second" })];
    expect(sortInclusionsByDisplayOrder(items).map((i) => i.title)).toEqual(["First", "Second", "Third"]);
  });

  it("does not mutate the input array", () => {
    const items = [inclusion({ id: "b", displayOrder: 2 }), inclusion({ id: "a", displayOrder: 1 })];
    const original = [...items];
    sortInclusionsByDisplayOrder(items);
    expect(items).toEqual(original);
  });

  it("breaks ties on displayOrder by id for a stable sort", () => {
    const items = [inclusion({ id: "z", displayOrder: 1 }), inclusion({ id: "a", displayOrder: 1 })];
    expect(sortInclusionsByDisplayOrder(items).map((i) => i.id)).toEqual(["a", "z"]);
  });
});

describe("activeInclusions / visibleInclusionsInOrder", () => {
  it("filters out inactive inclusions", () => {
    const items = [inclusion({ id: "a", isActive: true }), inclusion({ id: "b", isActive: false })];
    expect(activeInclusions(items).map((i) => i.id)).toEqual(["a"]);
  });

  it("returns only active inclusions, in display order", () => {
    const items = [
      inclusion({ id: "c", displayOrder: 3, isActive: true }),
      inclusion({ id: "hidden", displayOrder: 1, isActive: false }),
      inclusion({ id: "a", displayOrder: 2, isActive: true }),
    ];
    expect(visibleInclusionsInOrder(items).map((i) => i.id)).toEqual(["a", "c"]);
  });
});

describe("highlightedInclusions", () => {
  it("returns only active, highlighted inclusions in display order — never an inactive one even if marked as a highlight", () => {
    const items = [
      inclusion({ id: "a", displayOrder: 2, isHighlight: true, isActive: true }),
      inclusion({ id: "b", displayOrder: 1, isHighlight: false, isActive: true }),
      inclusion({ id: "hidden", displayOrder: 0, isHighlight: true, isActive: false }),
    ];
    expect(highlightedInclusions(items).map((i) => i.id)).toEqual(["a"]);
  });

  it("is empty when nothing is marked as a highlight — never invents a highlight", () => {
    expect(highlightedInclusions([inclusion({ isHighlight: false })])).toEqual([]);
  });
});

describe("buildComparisonRow", () => {
  it("carries every comparison field through unchanged, including nulls", () => {
    const v = version({
      publicTitle: "Bachelor Abroad Essential",
      sessionCount: 5,
      universityShortlistLimit: 8,
      applicationSupportLimit: 3,
      sopReviewRounds: 1,
      scholarshipSupportNote: "Basic scholarship search",
      mockInterviewCount: null,
      counsellorTier: null,
      supportDurationNote: "90 days of email or WhatsApp support",
    });
    expect(buildComparisonRow("plan-1", v)).toEqual({
      planId: "plan-1",
      publicTitle: "Bachelor Abroad Essential",
      sessionCount: 5,
      universityShortlistLimit: 8,
      applicationSupportLimit: 3,
      sopReviewRounds: 1,
      scholarshipSupportNote: "Basic scholarship search",
      mockInterviewCount: null,
      counsellorTier: null,
      supportDurationNote: "90 days of email or WhatsApp support",
    });
  });
});

describe("formatComparisonCell", () => {
  it("renders null or undefined as an em dash — never a fabricated value", () => {
    expect(formatComparisonCell(null)).toBe("—");
    expect(formatComparisonCell(undefined)).toBe("—");
  });

  it("renders a number as its plain string form", () => {
    expect(formatComparisonCell(8)).toBe("8");
    expect(formatComparisonCell(0)).toBe("0");
  });

  it("renders non-empty text unchanged (trimmed)", () => {
    expect(formatComparisonCell("Dedicated counsellor")).toBe("Dedicated counsellor");
    expect(formatComparisonCell("  Senior dedicated counsellor  ")).toBe("Senior dedicated counsellor");
  });

  it("renders an empty/blank string as an em dash", () => {
    expect(formatComparisonCell("")).toBe("—");
    expect(formatComparisonCell("   ")).toBe("—");
  });
});
