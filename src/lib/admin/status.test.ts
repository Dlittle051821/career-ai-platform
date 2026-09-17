import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGE_TRANSITIONS,
  INVOICE_STATUS_TRANSITIONS,
  isValidTransition,
  LEAD_STAGE_TRANSITIONS,
  nextStatusOptions,
  PAYMENT_ATTEMPT_STATUS_TRANSITIONS,
  PAYMENT_STATUS_TRANSITIONS,
  PRICING_PLAN_VERSION_STATUS_TRANSITIONS,
  REFUND_STATUS_TRANSITIONS,
  sourceStatusOptions,
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
      // Milestone 16 — 'ready_to_submit' inserted between preparing and
      // submitted (the one new stage this milestone added).
      "ready_to_submit",
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

  it("Milestone 16 — application stage graph forbids skipping straight from preparing to submitted (must pass through ready_to_submit)", () => {
    expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, "preparing", "submitted")).toBe(false);
  });

  it("Milestone 16 — ready_to_submit can move forward to submitted, back to preparing for corrections, or withdraw — never straight to a post-submission stage", () => {
    expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, "ready_to_submit", "submitted")).toBe(true);
    expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, "ready_to_submit", "preparing")).toBe(true);
    expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, "ready_to_submit", "withdrawn")).toBe(true);
    expect(isValidTransition(APPLICATION_STAGE_TRANSITIONS, "ready_to_submit", "under_review")).toBe(false);
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

  it("Milestone 13 — refund graph allows the documented happy path (requested through processed)", () => {
    const happyPath: (keyof typeof REFUND_STATUS_TRANSITIONS)[] = ["requested", "under_review", "approved", "processing", "processed"];
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(isValidTransition(REFUND_STATUS_TRANSITIONS, happyPath[i], happyPath[i + 1])).toBe(true);
    }
  });

  it("Milestone 13 — refund graph allows under_review to send a case back to requested", () => {
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "under_review", "requested")).toBe(true);
  });

  it("Milestone 13 — refund graph allows rejecting only from under_review, never straight from requested", () => {
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "under_review", "rejected")).toBe(true);
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "requested", "rejected")).toBe(false);
  });

  it("Milestone 13 — refund graph forbids skipping straight from requested/under_review to processing (must be approved first)", () => {
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "requested", "processing")).toBe(false);
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "under_review", "processing")).toBe(false);
  });

  it("Milestone 13 — refund graph forbids skipping straight to processed/failed without passing through processing", () => {
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "approved", "processed")).toBe(false);
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "approved", "failed")).toBe(false);
  });

  it("Milestone 13 — refund graph treats processed/failed/rejected/cancelled as fully terminal — no reopening a case", () => {
    for (const terminal of ["processed", "failed", "rejected", "cancelled"] as const) {
      expect(nextStatusOptions(REFUND_STATUS_TRANSITIONS, terminal)).toEqual([]);
    }
  });

  it("Milestone 13 — refund graph allows cancelling from requested, under_review, or approved, but not once processing has begun", () => {
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "requested", "cancelled")).toBe(true);
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "under_review", "cancelled")).toBe(true);
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "approved", "cancelled")).toBe(true);
    expect(isValidTransition(REFUND_STATUS_TRANSITIONS, "processing", "cancelled")).toBe(false);
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

describe("sourceStatusOptions (Milestone 13 FINAL FINANCIAL SAFETY PATCH)", () => {
  it("returns every status that can move into the target — the inverse of nextStatusOptions", () => {
    expect(sourceStatusOptions(LEAD_STAGE_TRANSITIONS, "contacted")).toEqual(expect.arrayContaining(["new", "nurturing", "lost"]));
  });

  it("returns an empty array for a status nothing transitions into (an initial-only status) — 'draft' is never a documented target in the pricing plan version graph", () => {
    expect(sourceStatusOptions(PRICING_PLAN_VERSION_STATUS_TRANSITIONS, "draft")).toEqual([]);
  });

  it("refund graph: only 'requested' may transition into 'under_review'", () => {
    expect(sourceStatusOptions(REFUND_STATUS_TRANSITIONS, "under_review")).toEqual(["requested"]);
  });

  it("refund graph: only 'under_review' may transition into 'approved'", () => {
    expect(sourceStatusOptions(REFUND_STATUS_TRANSITIONS, "approved")).toEqual(["under_review"]);
  });

  it("refund graph: only 'under_review' may transition into 'rejected'", () => {
    expect(sourceStatusOptions(REFUND_STATUS_TRANSITIONS, "rejected")).toEqual(["under_review"]);
  });

  it("refund graph: 'requested', 'under_review', and 'approved' — and only those three — may transition into 'cancelled'", () => {
    expect(sourceStatusOptions(REFUND_STATUS_TRANSITIONS, "cancelled").sort()).toEqual(["approved", "requested", "under_review"]);
  });

  it("refund graph: only 'approved' may transition into 'processing' — the exact source claim_refund_for_processing() itself requires", () => {
    expect(sourceStatusOptions(REFUND_STATUS_TRANSITIONS, "processing")).toEqual(["approved"]);
  });

  it("refund graph: nothing transitions into 'requested' except 'under_review' sending a case back — critically, 'processing' is never a source for any status a stale application-layer action could target", () => {
    const sources = sourceStatusOptions(REFUND_STATUS_TRANSITIONS, "requested");
    expect(sources).toEqual(["under_review"]);
    // The actual financial-safety guarantee this test protects: 'processing'
    // must never appear as a source for approved/rejected/cancelled/
    // under_review — i.e. nothing can move OUT of processing except via
    // finalize_refund() (into processed/failed), so a stale
    // reject/cancel/approve/review action can never overwrite it.
    for (const target of ["approved", "rejected", "cancelled", "under_review"] as const) {
      expect(sourceStatusOptions(REFUND_STATUS_TRANSITIONS, target)).not.toContain("processing");
    }
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

  it("every target status in REFUND_STATUS_TRANSITIONS is itself a key in the graph", () => {
    const keys = new Set(Object.keys(REFUND_STATUS_TRANSITIONS));
    for (const targets of Object.values(REFUND_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(keys.has(target)).toBe(true);
      }
    }
  });
});
