import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CC-24 — payment safety, defence in depth.
 *
 * 1. The browser "verify payment" Server Action is refused while paid
 *    checkout is off (it used to reach public.verify_checkout_payment()).
 * 2. A tree-wide guard: every application call site that can create a
 *    gateway order (createOrReuseCheckoutSession) or a purchase/invoice
 *    (purchase_pricing_plan RPC) checks isPaidCheckoutEnabled() first in
 *    the same file, so a future call site cannot silently skip the gate.
 * 3. The launch flag cannot be switched on by credentials alone, by a typo,
 *    or without the CC-19/CC-20 GST prerequisite confirmation.
 */

const io = vi.hoisted(() => ({ verify: vi.fn(), createOrReuse: vi.fn() }));
vi.mock("@/lib/supabase/payments/checkout", () => ({
  createOrReuseCheckoutSession: io.createOrReuse,
  verifyCheckoutPayment: io.verify,
  CheckoutError: class CheckoutError extends Error {},
}));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCheckoutSessionAction, verifyCheckoutAction } from "@/app/(site)/payments/actions";
import { OPEN_INVOICE_PAYMENT_PAUSED_MESSAGE, resolvePaymentLaunchMode } from "./launch-mode";

const ON = {
  NEXTWISE_PAID_CHECKOUT: "enabled",
  NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "CC19-CC20-APPROVED",
  RAZORPAY_KEY_ID: "rzp_test_fixture",
  RAZORPAY_KEY_SECRET: "fixture-secret",
};
const KEYS = Object.keys(ON);
const params = { paymentAttemptId: "a", providerPaymentId: "pay_x", providerOrderId: "order_x", signature: "forged" };

function setEnv(values: Partial<typeof ON>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

describe("verifyCheckoutAction while paid checkout is off", () => {
  beforeEach(() => {
    io.verify.mockReset().mockResolvedValue({ status: "captured" });
    io.createOrReuse.mockReset();
  });
  afterEach(() => setEnv({}));

  it("is refused with no database call when nothing is configured", async () => {
    setEnv({});
    await expect(verifyCheckoutAction("inv-1", params)).resolves.toEqual({ status: null, error: OPEN_INVOICE_PAYMENT_PAUSED_MESSAGE });
    expect(io.verify).not.toHaveBeenCalled();
  });

  it("is refused even when real-looking gateway credentials are present", async () => {
    setEnv({ RAZORPAY_KEY_ID: ON.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: ON.RAZORPAY_KEY_SECRET });
    await expect(verifyCheckoutAction("inv-1", params)).resolves.toMatchObject({ status: null });
    expect(io.verify).not.toHaveBeenCalled();
  });

  it("still reaches the authoritative database check once checkout is deliberately enabled", async () => {
    setEnv(ON);
    await expect(verifyCheckoutAction("inv-1", params)).resolves.toEqual({ status: "captured", error: null });
    expect(io.verify).toHaveBeenCalledTimes(1);
  });

  it("createCheckoutSessionAction creates no order while off (CC-22B guard unchanged)", async () => {
    setEnv({ RAZORPAY_KEY_ID: ON.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: ON.RAZORPAY_KEY_SECRET });
    await createCheckoutSessionAction("inv-1");
    expect(io.createOrReuse).not.toHaveBeenCalled();
  });
});

describe("launch flag cannot be switched on accidentally", () => {
  it.each([
    [{ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" }, "flag_off"],
    [{ ...ON, NEXTWISE_PAID_CHECKOUT: "Enabled" }, "flag_off"],
    [{ ...ON, NEXTWISE_PAID_CHECKOUT: "true" }, "flag_off"],
    [{ ...ON, NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "" }, "prerequisites_not_confirmed"],
    [{ ...ON, NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "cc19-cc20-approved" }, "prerequisites_not_confirmed"],
    [{ ...ON, RAZORPAY_KEY_SECRET: "" }, "gateway_not_configured"],
  ])("%o stays off (%s)", (env, reason) => {
    expect(resolvePaymentLaunchMode(env)).toEqual({ paidCheckoutEnabled: false, blockReason: reason });
  });
});

const SRC = path.resolve(import.meta.dirname, "../..");

/** Source without block and line comments, so a mention in a comment is not mistaken for a call. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("every money-moving call site is behind the launch gate (tree-wide guard)", () => {
  const files = walk(SRC);
  const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");

  it("only the gated payments action creates gateway orders", () => {
    const callers = files.filter((f) => /\bcreateOrReuseCheckoutSession\s*\(/.test(code(f))).map(rel);
    // The definition itself lives in lib/supabase/payments/checkout.ts.
    expect(callers.sort()).toEqual(["app/(site)/payments/actions.ts", "lib/supabase/payments/checkout.ts"]);
    const action = code(path.join(SRC, "app/(site)/payments/actions.ts"));
    const gate = action.indexOf("if (!isPaidCheckoutEnabled())");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(action.indexOf("await createOrReuseCheckoutSession("));
  });

  it("only the gated pricing library calls purchase_pricing_plan", () => {
    const callers = files.filter((f) => /rpc\(\s*["']purchase_pricing_plan["']/.test(code(f))).map(rel);
    expect(callers).toEqual(["lib/supabase/pricing/checkout.ts"]);
    const lib = code(path.join(SRC, "lib/supabase/pricing/checkout.ts"));
    expect(lib.indexOf("isPaidCheckoutEnabled()")).toBeGreaterThan(-1);
    expect(lib.indexOf("isPaidCheckoutEnabled()")).toBeLessThan(lib.search(/rpc\(\s*["']purchase_pricing_plan["']/));
  });

  it("nothing in the repository turns the launch flag on", () => {
    const setters = files.filter((f) => /NEXTWISE_PAID_CHECKOUT\s*=|NEXTWISE_PAID_CHECKOUT["']\]\s*=/.test(code(f))).map(rel);
    expect(setters).toEqual([]);
  });
});
