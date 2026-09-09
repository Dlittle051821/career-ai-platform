import { describe, expect, it } from "vitest";
import { getNextBestAction, type NextBestActionInput } from "./next-best-action";
import type { MyAgreementSummary } from "@/lib/supabase/agreements/my-agreements";
import type { RecommendationReadiness } from "@/types/recommendation-readiness";

const BASE: NextBestActionInput = {
  profileStatus: "not_started",
  profilePercent: 0,
  payableInvoiceCount: 0,
  pendingSignatureAgreement: undefined,
  careerReadiness: null,
  hasActiveDiscoverySession: false,
};

function readiness(level: RecommendationReadiness["level"], nextActions: string[] = []): RecommendationReadiness {
  return {
    type: "career",
    level,
    confidence: "MEDIUM",
    nextActions,
  } as RecommendationReadiness;
}

const AGREEMENT: MyAgreementSummary = {
  id: "agreement-1",
  agreementType: "Service Agreement",
  signatureStatus: "pending_signature",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as MyAgreementSummary;

describe("getNextBestAction", () => {
  it("prioritises starting the profile when not started, above everything else", () => {
    const action = getNextBestAction({ ...BASE, payableInvoiceCount: 2, pendingSignatureAgreement: AGREEMENT });
    expect(action.href).toBe("/profile/onboarding");
    expect(action.cta).toBe("Start my profile");
  });

  it("prioritises continuing an in-progress profile, above payments and agreements", () => {
    const action = getNextBestAction({ ...BASE, profileStatus: "in_progress", profilePercent: 55, payableInvoiceCount: 1 });
    expect(action.href).toBe("/profile/onboarding");
    expect(action.title).toContain("55%");
  });

  it("surfaces a payment due once the profile is complete", () => {
    const action = getNextBestAction({ ...BASE, profileStatus: "completed", payableInvoiceCount: 1 });
    expect(action.href).toBe("/payments");
  });

  it("surfaces a pending signature above recommendation guidance", () => {
    const action = getNextBestAction({
      ...BASE,
      profileStatus: "completed",
      pendingSignatureAgreement: AGREEMENT,
      careerReadiness: readiness("READY"),
    });
    expect(action.href).toBe(`/agreements/${AGREEMENT.id}`);
  });

  it("guides toward finishing readiness inputs when NOT_READY/PRELIMINARY with real next actions", () => {
    const action = getNextBestAction({
      ...BASE,
      profileStatus: "completed",
      careerReadiness: readiness("PRELIMINARY", ["Add two more subjects.", "Rate your interests."]),
    });
    expect(action.href).toBe("/recommendations");
    expect(action.description).toBe("Add two more subjects. Rate your interests.");
  });

  it("points to recommendations once READY or COUNSELLOR_VERIFIED", () => {
    for (const level of ["READY", "COUNSELLOR_VERIFIED"] as const) {
      const action = getNextBestAction({ ...BASE, profileStatus: "completed", careerReadiness: readiness(level) });
      expect(action.href).toBe("/recommendations");
      expect(action.cta).toBe("View my recommendations");
    }
  });

  it("offers a Discovery Session when nothing more urgent applies and none is booked", () => {
    const action = getNextBestAction({ ...BASE, profileStatus: "completed", careerReadiness: null });
    expect(action.href).toBe("/discovery-session/book");
  });

  it("falls back to free exploration once a Discovery Session already exists and nothing else is pending", () => {
    const action = getNextBestAction({ ...BASE, profileStatus: "completed", hasActiveDiscoverySession: true });
    expect(action.href).toBe("/careers");
    expect(action.cta).toBe("Explore options");
  });
});
