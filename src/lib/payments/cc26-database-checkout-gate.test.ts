import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CC-26 — the database checkout gate (0026). When the app's paid-checkout flag
 * is on but the database gate is still closed, purchase_pricing_plan() is
 * refused by the database with SQLSTATE 42501. The student must see the honest
 * "checkout paused" message, never "please try again", and no redirect to an
 * invoice may happen. Only the I/O boundaries are replaced.
 */

const io = vi.hoisted(() => ({
  rpc: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: io.rpc }) }));
vi.mock("@/lib/supabase/profile", () => ({ getCurrentUser: async () => ({ id: "student-fixture" }) }));
vi.mock("@/lib/supabase/pricing/analytics", () => ({ recordPricingAnalyticsEvent: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: io.redirect }));

import { PAID_CHECKOUT_PAUSED_MESSAGE } from "./launch-mode";
import {
  DATABASE_CHECKOUT_GATE_MESSAGE_PREFIX,
  purchasePricingPlan,
  PricingCheckoutError,
  studentSafePurchaseError,
} from "@/lib/supabase/pricing/checkout";
import { confirmPricingPurchaseAction } from "@/app/(site)/pricing/checkout/actions";

const ON = {
  NEXTWISE_PAID_CHECKOUT: "enabled",
  NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "CC19-CC20-APPROVED",
  RAZORPAY_KEY_ID: "rzp_test_fixture",
  RAZORPAY_KEY_SECRET: "fixture-secret",
};
const GATE_ERROR = { code: "42501", message: "Online checkout is not open yet. You have not been charged." };

function setEnv(values: Partial<Record<keyof typeof ON, string>>) {
  for (const k of Object.keys(ON)) delete process.env[k];
  Object.assign(process.env, values);
}

beforeEach(() => {
  io.rpc.mockReset().mockResolvedValue({ data: null, error: GATE_ERROR });
  io.redirect.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  setEnv(ON);
});
afterEach(() => setEnv({}));

describe("CC-26 database checkout gate — app mapping", () => {
  it("the SQL gate raises exactly the message prefix the app recognises", () => {
    const sql = readFileSync(path.resolve("supabase/migrations-proposed/cc26/0026_cc26_database_checkout_gate.sql"), "utf8");
    expect(sql).toContain(`raise exception '${GATE_ERROR.message}' using errcode = '42501'`);
    expect(GATE_ERROR.message.startsWith(DATABASE_CHECKOUT_GATE_MESSAGE_PREFIX)).toBe(true);
  });

  it("maps the gate refusal to the paused-checkout message", () => {
    expect(studentSafePurchaseError(GATE_ERROR)).toBe(PAID_CHECKOUT_PAUSED_MESSAGE);
  });

  it("does not leak other permission errors (generic message)", () => {
    expect(studentSafePurchaseError({ code: "42501", message: "permission denied for table invoices" })).toBe(
      "We couldn't start checkout for this plan. Please try again.",
    );
  });

  it("keeps the RPC's own student-readable P0001 messages", () => {
    expect(studentSafePurchaseError({ code: "P0001", message: "This offer is not currently active." })).toBe("This offer is not currently active.");
  });

  it("purchasePricingPlan surfaces the paused message when the database refuses", async () => {
    await expect(purchasePricingPlan("plan-verified")).rejects.toThrow(new PricingCheckoutError(PAID_CHECKOUT_PAUSED_MESSAGE));
    expect(io.rpc).toHaveBeenCalledTimes(1);
  });

  it("confirmPricingPurchaseAction returns the paused message and never redirects to an invoice", async () => {
    await expect(confirmPricingPurchaseAction("plan-verified", null)).resolves.toEqual({ error: PAID_CHECKOUT_PAUSED_MESSAGE });
    expect(io.redirect).not.toHaveBeenCalled();
  });
});
