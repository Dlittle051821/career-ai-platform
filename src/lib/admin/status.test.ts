import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGE_TRANSITIONS,
  INVOICE_STATUS_TRANSITIONS,
  isValidTransition,
  LEAD_STAGE_TRANSITIONS,
  nextStatusOptions,
  PAYMENT_ATTEMPT_STATUS_TRANSITIONS,
  PAYMENT_STATUS_TRANSITIONS,
} from "./status";

describe("isValidTransition", () => {
  it("always allows a no-op (same status to itself)", () => {
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "qualified", "qualified")).toBe(true);
  });

  it("allows a transition present in the graph", () => {
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "new", "contacted")).toBe(true);
  });

  it("rejects a transition not present in the graph", () => {
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "new", "converted")).toBe(false);
  });

  it("rejects moving out of a terminal state", () => {
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "converted", "contacted")).toBe(false);
  });

  it("application stage graph blocks skipping straight to enrolled from inquiry", () => {
    expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, "inquiry", "enrolled")).toBe(false);
  });

  it("application stage graph allows the documented happy path", () => {
    const happyPath: (keyof typeof APPLICATION_STAGE_TRANSITIONS)[] = [
      "inquiry",
      "preparing",
      "submitted",
      "under_review",
      "decision_pending",
      "offer_received",
      "enrolled",
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, happyPath[i], happyPath[i + 1])).toBe(true);
    }
  });

  it("payment graph disallows moving a cancelled payment back to pending", () => {
    expect(isValidTransition(PAYMENT_STATUS_TRANSITIONS, "cancelled", "pending")).toBe(false);
  });

  it("payment graph allows a partial refund to become a full refund but not the reverse", () => {
    expect(isValidTransition(PAYMENT_STATUS_TRANSITIONS, "partially_refunded", "refunded")).toBe(true);
    expect(isValidTransition(PAYMENT_STATUS_TRANSITIONS, "refunded", "partially_refunded")).toBe(false);
  });

  it("Milestone 8 — invoice graph allows voiding a draft, issued, or overdue invoice", () => {
    expect(isValidTransition(INVOICE_STATUS_TRANSITIONS, "draft", "void")).toBe(true);
    expect(isValidTransition(INVOICE_STATUS_TRANSITIONS, "issued", "void")).toBe(true);
    expect(isValidTransition(INVOICE_STATUS_TRANSITIONS, "overdue", "void")).toBe(true);
  });

  it("Milestone 8 — invoice graph forbids voiding once money has moved (paid, partially_paid, refunded)", () => {
    expect(isValidTransition(INVOICE_STATUS_TRANSITIONS, "paid", "void")).toBe(false);
    expect(isValidTransition(INVOICE_STATUS_TRANSITIONS, "partially_paid", "void")).toBe(false);
    expect(isValidTransition(INVOICE_STATUS_TRANSITIONS, "refunded", "void")).toBe(false);
  });

  it("Milestone 8 — invoice graph treats paid/refunded/void as terminal for admin-driven moves other than their own documented exits", () => {
    expect(nextStatusOptions(INVOICE_STATUS_TRANSITIONS, "void")).toEqual([]);
    expect(nextStatusOptions(INVOICE_STATUS_TRANSITIONS, "refunded")).toEqual([]);
  });

  it("Milestone 8 — payment attempt graph treats failed and cancelled as terminal — a retry creates a new attempt, never resurrects one", () => {
    expect(nextStatusOptions(PAYMENT_ATTEMPT_STATUS_TRANSITIONS, "failed")).toEqual([]);
    expect(nextStatusOptions(PAYMENT_ATTEMPT_STATUS_TRANSITIONS, "cancelled")).toEqual([]);
  });

  it("Milestone 8 — payment attempt graph never allows captured to move backward to authorized", () => {
    expect(isValidTransition(PAYMENT_ATTEMPT_STATUS_TRANSITIONS, "captured", "authorized")).toBe(false);
  });
});

describe("nextStatusOptions", () => {
  it("returns the direct neighbors for a given status", () => {
    expect(nextStatusOptions(LEAD_STAGE_TRANSITIONS, "new")).toEqual(["contacted", "qualified", "lost"]);
  });

  it("returns an empty array for a terminal status", () => {
    expect(nextStatusOptions(LEAD_STAGE_TRANSITIONS, "converted")).toEqual([]);
  });
});

describe("every transition graph is internally consistent", () => {
  it("every target status in LEAD_STAGE_TRANSITIONS is itself a key in the graph", () => {
    const keys = new Set(Object.keys(LEAD_STAGE_TRANSITIONS));
    for (const targets of Object.values(LEAD_STAGE_TRANSITIONS)) {
      for (const target of targets) {
        expect(keys.has(target)).toBe(true);
      }
    }
  });

  it("every target status in APPLICATION_STAGE_TRANSITIONS is itself a key in the graph", () => {
    const keys = new Set(Object.keys(APPLICATION_STAGE_TRANSITIONS));
    for (const targets of Object.values(APPLICATION_STAGE_TRANSITIONS)) {
      for (const target of targets) {
        expect(keys.has(target)).toBe(true);
      }
    }
  });

  it("every target status in INVOICE_STATUS_TRANSITIONS is itself a key in the graph", () => {
    const keys = new Set(Object.keys(INVOICE_STATUS_TRANSITIONS));
    for (const targets of Object.values(INVOICE_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(keys.has(target)).toBe(true);
      }
    }
  });

  it("every target status in PAYMENT_ATTEMPT_STATUS_TRANSITIONS is itself a key in the graph", () => {
    const keys = new Set(Object.keys(PAYMENT_ATTEMPT_STATUS_TRANSITIONS));
    for (const targets of Object.values(PAYMENT_ATTEMPT_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(keys.has(target)).toBe(true);
      }
    }
  });
});
