import { describe, expect, it } from "vitest";
import { decideRefundProcessingAction } from "./refund-processing";
import type { GatewayRefundStatus } from "./gateway";

/**
 * Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 1) — pure unit tests for
 * decideRefundProcessingAction(), the decision logic that stops
 * processApprovedRefund() from ever treating a successful-but-non-terminal
 * gateway response as proof the refund actually completed. See
 * src/lib/supabase/admin/refunds.ts for how this is wired into
 * processApprovedRefund(), and refund-operations-migration-security.test.ts
 * / this file's sibling tests in src/lib/supabase/admin/refunds.test.ts for
 * the end-to-end behavior this pure function enables.
 */
describe("decideRefundProcessingAction", () => {
  it("a 'processed' status finalizes as processed", () => {
    expect(decideRefundProcessingAction("processed")).toEqual({ kind: "finalize", outcome: "processed" });
  });

  it("a 'failed' status finalizes as failed", () => {
    expect(decideRefundProcessingAction("failed")).toEqual({ kind: "finalize", outcome: "failed" });
  });

  it("a 'pending' status — the common case for a non-instant-speed refund — never finalizes; it awaits confirmation", () => {
    expect(decideRefundProcessingAction("pending")).toEqual({ kind: "await_confirmation" });
  });

  it("defensively awaits confirmation for any value outside the known vocabulary rather than assuming success", () => {
    // GatewayRefundStatus is exhaustively 'pending' | 'processed' | 'failed'
    // at the type level, but this is a network response — a provider could
    // in principle return something else at runtime. This must never be
    // treated as a green light to finalize.
    expect(decideRefundProcessingAction("some_future_status" as GatewayRefundStatus)).toEqual({ kind: "await_confirmation" });
  });

  it("never treats a non-throwing HTTP success alone as proof the money moved — only 'processed'/'failed' finalize", () => {
    const allStatuses: GatewayRefundStatus[] = ["pending", "processed", "failed"];
    for (const status of allStatuses) {
      const action = decideRefundProcessingAction(status);
      if (status === "pending") {
        expect(action.kind).toBe("await_confirmation");
      } else {
        expect(action.kind).toBe("finalize");
      }
    }
  });
});
