import { describe, expect, it } from "vitest";
import { computeRefundEligibility, validateRefundAmount, isFullRefund, type RefundableTransactionSnapshot } from "./refund-eligibility";

function txn(overrides: Partial<RefundableTransactionSnapshot> = {}): RefundableTransactionSnapshot {
  return {
    amountMinorUnits: 100_000,
    amountRefundedMinorUnits: 0,
    status: "captured",
    isManual: false,
    providerPaymentId: "pay_abc123",
    ...overrides,
  };
}

describe("computeRefundEligibility", () => {
  it("is technically refundable for a fully-captured, never-refunded gateway payment", () => {
    const result = computeRefundEligibility(txn());
    expect(result.technicallyRefundable).toBe(true);
    expect(result.maximumRefundableAmountMinorUnits).toBe(100_000);
    expect(result.reasons).toEqual([]);
  });

  it("is technically refundable for a partially-refunded transaction, capped at the remaining balance", () => {
    const result = computeRefundEligibility(txn({ status: "partially_refunded", amountRefundedMinorUnits: 40_000 }));
    expect(result.technicallyRefundable).toBe(true);
    expect(result.maximumRefundableAmountMinorUnits).toBe(60_000);
  });

  it("is never technically refundable for a manual/offline payment, even if amount remains", () => {
    const result = computeRefundEligibility(txn({ isManual: true, providerPaymentId: null }));
    expect(result.technicallyRefundable).toBe(false);
    expect(result.reasons[0]).toMatch(/offline/i);
  });

  it("is not technically refundable once fully refunded", () => {
    const result = computeRefundEligibility(txn({ amountRefundedMinorUnits: 100_000, status: "refunded" }));
    expect(result.technicallyRefundable).toBe(false);
    expect(result.maximumRefundableAmountMinorUnits).toBe(0);
  });

  it("is not technically refundable for a transaction that never captured (e.g. still 'created' or 'failed')", () => {
    expect(computeRefundEligibility(txn({ status: "failed" })).technicallyRefundable).toBe(false);
    expect(computeRefundEligibility(txn({ status: "created" })).technicallyRefundable).toBe(false);
  });

  it("never turns amountRefundedMinorUnits exceeding amountMinorUnits into a negative remaining balance", () => {
    // Defensive: should never happen given finalize_refund()'s own re-assertion, but this pure
    // function must never produce a negative "maximum refundable" number even if it did.
    const result = computeRefundEligibility(txn({ amountRefundedMinorUnits: 150_000 }));
    expect(result.maximumRefundableAmountMinorUnits).toBe(0);
  });

  it("always reports policyDecisionRequired: true, regardless of technical refundability", () => {
    expect(computeRefundEligibility(txn()).policyDecisionRequired).toBe(true);
    expect(computeRefundEligibility(txn({ isManual: true })).policyDecisionRequired).toBe(true);
  });
});

describe("validateRefundAmount", () => {
  it("accepts a valid partial amount within the remaining balance", () => {
    expect(validateRefundAmount(50_000, txn())).toBeNull();
  });

  it("accepts the full remaining balance", () => {
    expect(validateRefundAmount(100_000, txn())).toBeNull();
  });

  it("rejects an amount greater than the remaining balance", () => {
    expect(validateRefundAmount(100_001, txn())).toMatch(/cannot refund more/i);
  });

  it("rejects zero and negative amounts", () => {
    expect(validateRefundAmount(0, txn())).toMatch(/valid positive/i);
    expect(validateRefundAmount(-500, txn())).toMatch(/valid positive/i);
  });

  it("rejects a non-integer amount", () => {
    expect(validateRefundAmount(50_000.5, txn())).toMatch(/valid positive/i);
  });

  it("rejects any amount for a technically-ineligible transaction, citing the specific reason", () => {
    expect(validateRefundAmount(10_000, txn({ isManual: true }))).toMatch(/offline/i);
  });

  it("rejects any amount once the transaction is already fully refunded (status has moved to 'refunded')", () => {
    expect(validateRefundAmount(1, txn({ amountRefundedMinorUnits: 100_000, status: "refunded" }))).toMatch(/not in a refundable state/i);
  });

  it("rejects any amount once the balance is exhausted even while status is still 'partially_refunded'", () => {
    expect(validateRefundAmount(1, txn({ amountRefundedMinorUnits: 100_000, status: "partially_refunded" }))).toMatch(/already been fully refunded/i);
  });
});

describe("isFullRefund", () => {
  it("is true when the amount equals the full remaining balance", () => {
    expect(isFullRefund(100_000, txn())).toBe(true);
  });

  it("is true when the amount equals the remaining balance after a prior partial refund", () => {
    expect(isFullRefund(60_000, txn({ status: "partially_refunded", amountRefundedMinorUnits: 40_000 }))).toBe(true);
  });

  it("is false for a partial amount", () => {
    expect(isFullRefund(50_000, txn())).toBe(false);
  });

  it("is false when there is no remaining balance at all (never claims a zero-amount refund is 'full')", () => {
    expect(isFullRefund(0, txn({ amountRefundedMinorUnits: 100_000, status: "refunded" }))).toBe(false);
  });
});
