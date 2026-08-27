import { describe, expect, it } from "vitest";
import { deriveInvoiceStatus } from "./invoice-status";

const BASE = { currentStatus: "issued" as const, totalMinorUnits: 10000, capturedTotalMinorUnits: 0, refundedTotalMinorUnits: 0, dueDate: null, today: "2026-08-26" };

describe("deriveInvoiceStatus", () => {
  it("never recomputes a draft invoice — always returns draft unchanged", () => {
    expect(deriveInvoiceStatus({ ...BASE, currentStatus: "draft", capturedTotalMinorUnits: 10000 })).toBe("draft");
  });

  it("never recomputes a void invoice — an admin's void decision is never silently overwritten by a stray transaction", () => {
    expect(deriveInvoiceStatus({ ...BASE, currentStatus: "void", capturedTotalMinorUnits: 10000 })).toBe("void");
  });

  it("stays issued when nothing has been captured and there's no due date", () => {
    expect(deriveInvoiceStatus({ ...BASE })).toBe("issued");
  });

  it("becomes overdue when unpaid past its due date", () => {
    expect(deriveInvoiceStatus({ ...BASE, dueDate: "2026-08-01" })).toBe("overdue");
  });

  it("does not become overdue when the due date is still in the future", () => {
    expect(deriveInvoiceStatus({ ...BASE, dueDate: "2026-12-01" })).toBe("issued");
  });

  it("becomes partially_paid once some but not all of the total is captured", () => {
    expect(deriveInvoiceStatus({ ...BASE, capturedTotalMinorUnits: 4000 })).toBe("partially_paid");
  });

  it("becomes paid once the captured total meets or exceeds the invoice total", () => {
    expect(deriveInvoiceStatus({ ...BASE, capturedTotalMinorUnits: 10000 })).toBe("paid");
    expect(deriveInvoiceStatus({ ...BASE, capturedTotalMinorUnits: 12000 })).toBe("paid");
  });

  it("a zero-total invoice is never marked paid just because captured is also 0", () => {
    expect(deriveInvoiceStatus({ ...BASE, totalMinorUnits: 0, capturedTotalMinorUnits: 0 })).toBe("issued");
  });

  it("becomes partially_refunded once any refund has processed but not the full captured amount", () => {
    expect(deriveInvoiceStatus({ ...BASE, capturedTotalMinorUnits: 10000, refundedTotalMinorUnits: 3000 })).toBe("partially_refunded");
  });

  it("becomes fully refunded only once the refunded total covers the full captured total, which itself covers the invoice total", () => {
    expect(deriveInvoiceStatus({ ...BASE, capturedTotalMinorUnits: 10000, refundedTotalMinorUnits: 10000 })).toBe("refunded");
  });

  it("a refund on a partially captured invoice is reported as partially_refunded, not refunded, even if the refund covers all that was captured", () => {
    // captured 4000 of 10000 total, all 4000 refunded — capturedTotal (4000) < invoice total (10000), so this can
    // never be the fully-refunded terminal state, matching the SQL function's identical guard.
    expect(deriveInvoiceStatus({ ...BASE, capturedTotalMinorUnits: 4000, refundedTotalMinorUnits: 4000 })).toBe("partially_refunded");
  });

  it("refund status takes priority over an otherwise-overdue due date", () => {
    expect(deriveInvoiceStatus({ ...BASE, dueDate: "2026-01-01", capturedTotalMinorUnits: 10000, refundedTotalMinorUnits: 2000 })).toBe("partially_refunded");
  });
});
