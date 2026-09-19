import { describe, expect, it } from "vitest";
import { shouldShowSavedAndOngoingSection } from "./dashboard-sections";

describe("shouldShowSavedAndOngoingSection", () => {
  it("is false for a brand-new student with none of the four yet", () => {
    expect(shouldShowSavedAndOngoingSection({ purchaseCount: 0, agreementCount: 0, savedItemCount: 0, invoiceCount: 0 })).toBe(false);
  });

  it("is true when the student has at least one purchase", () => {
    expect(shouldShowSavedAndOngoingSection({ purchaseCount: 1, agreementCount: 0, savedItemCount: 0, invoiceCount: 0 })).toBe(true);
  });

  it("is true when the student has at least one agreement", () => {
    expect(shouldShowSavedAndOngoingSection({ purchaseCount: 0, agreementCount: 1, savedItemCount: 0, invoiceCount: 0 })).toBe(true);
  });

  it("is true when the student has at least one saved item", () => {
    expect(shouldShowSavedAndOngoingSection({ purchaseCount: 0, agreementCount: 0, savedItemCount: 1, invoiceCount: 0 })).toBe(true);
  });

  it("is true when the student has at least one invoice, even if not currently payable", () => {
    expect(shouldShowSavedAndOngoingSection({ purchaseCount: 0, agreementCount: 0, savedItemCount: 0, invoiceCount: 1 })).toBe(true);
  });
});
