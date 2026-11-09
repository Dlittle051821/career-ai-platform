import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PricingPlan, PricingPlanVersion } from "@/types/pricing";

/**
 * CC-22B — negative tests for the launch payment mode. They drive the real
 * server actions, the real purchase library and the real checkout page; only
 * the I/O boundaries (Supabase client, signed-in user, gateway checkout
 * session, navigation, analytics) are replaced. Nothing touches a network or
 * database.
 */

const io = vi.hoisted(() => ({
  rpc: vi.fn(),
  analytics: vi.fn(),
  createOrReuse: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
  planBySlug: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: io.rpc }) }));
vi.mock("@/lib/supabase/profile", () => ({ getCurrentUser: async () => ({ id: "student-fixture" }) }));
vi.mock("@/lib/supabase/pricing/analytics", () => ({ recordPricingAnalyticsEvent: io.analytics }));
vi.mock("@/lib/supabase/pricing/public-plans", () => ({ getPublicPricingPlanBySlug: io.planBySlug }));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/supabase/payments/checkout", () => ({
  createOrReuseCheckoutSession: io.createOrReuse,
  verifyCheckoutPayment: vi.fn(),
  CheckoutError: class CheckoutError extends Error {},
}));
vi.mock("next/navigation", () => ({ redirect: io.redirect, notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import { resolvePaymentLaunchMode, isPaidCheckoutEnabled, PAID_CHECKOUT_PAUSED_MESSAGE, OPEN_INVOICE_PAYMENT_PAUSED_MESSAGE } from "./launch-mode";
import { confirmPricingPurchaseAction } from "@/app/(site)/pricing/checkout/actions";
import { purchasePricingPlan, PricingCheckoutError } from "@/lib/supabase/pricing/checkout";
import { createCheckoutSessionAction } from "@/app/(site)/payments/actions";
import PricingCheckoutPage from "@/app/(site)/pricing/checkout/[slug]/page";
import { PublicPricingPlanCard } from "@/components/sections/pricing/PublicPricingPlanCard";

const ON = {
  NEXTWISE_PAID_CHECKOUT: "enabled",
  NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "CC19-CC20-APPROVED",
  RAZORPAY_KEY_ID: "rzp_test_fixture",
  RAZORPAY_KEY_SECRET: "fixture-secret",
};
const ENV_KEYS = Object.keys(ON);

function setEnv(values: Partial<Record<keyof typeof ON, string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

function plan(overrides: Partial<PricingPlan> = {}): PricingPlan {
  return {
    id: "plan-verified",
    slug: "nextwise-verified",
    category: "school_counselling",
    internalName: "Nextwise Verified",
    displayOrder: 1,
    isRecommended: false,
    isActive: true,
    currentVersionId: "version-verified",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function version(overrides: Partial<PricingPlanVersion> = {}): PricingPlanVersion {
  return {
    id: "version-verified",
    planId: "plan-verified",
    versionNumber: 1,
    publicTitle: "Nextwise Verified",
    shortDescription: null,
    detailedDescription: null,
    currency: "INR",
    amountMinorUnits: 199_900,
    paymentType: "one_time",
    billingInterval: null,
    includedServices: [],
    exclusions: [],
    ctaText: "Choose Verified",
    taxStatus: "tax_inclusive",
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

beforeEach(() => {
  io.rpc.mockReset().mockResolvedValue({ data: { invoice_id: "invoice-fixture", reused: false }, error: null });
  io.analytics.mockReset().mockResolvedValue(undefined);
  io.createOrReuse.mockReset().mockResolvedValue({ paymentAttemptId: "a", currency: "INR" });
  io.redirect.mockClear();
  io.planBySlug.mockReset().mockResolvedValue({ plan: plan(), version: version(), offer: null, inclusions: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  setEnv({});
});
afterEach(() => setEnv({}));

describe("resolvePaymentLaunchMode — off unless every condition is explicitly met", () => {
  it("is off by default (nothing set)", () => {
    expect(resolvePaymentLaunchMode({})).toEqual({ paidCheckoutEnabled: false, blockReason: "flag_off" });
  });
  it("Razorpay credentials alone never enable checkout", () => {
    expect(isPaidCheckoutEnabled({ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" })).toBe(false);
  });
  it("the flag without the CC-19/CC-20 prerequisite confirmation stays off", () => {
    expect(resolvePaymentLaunchMode({ ...ON, NEXTWISE_PAID_CHECKOUT_PREREQUISITES: undefined }).blockReason).toBe("prerequisites_not_confirmed");
  });
  it("flag and prerequisites without credentials stay off", () => {
    expect(resolvePaymentLaunchMode({ ...ON, RAZORPAY_KEY_SECRET: undefined }).blockReason).toBe("gateway_not_configured");
  });
  it.each(["Enabled", "true", "1", " enabled", "yes"])("rejects flag value %j", (value) => {
    expect(isPaidCheckoutEnabled({ ...ON, NEXTWISE_PAID_CHECKOUT: value })).toBe(false);
  });
  it("is on only with all three", () => {
    expect(resolvePaymentLaunchMode(ON)).toEqual({ paidCheckoutEnabled: true, blockReason: null });
  });
});

describe("payments OFF — direct requests cannot create a purchase, an invoice or an order", () => {
  it("confirmPricingPurchaseAction refuses before analytics or purchase_pricing_plan", async () => {
    const result = await confirmPricingPurchaseAction("plan-verified", null);
    expect(result).toEqual({ error: PAID_CHECKOUT_PAUSED_MESSAGE });
    expect(io.rpc).not.toHaveBeenCalled();
    expect(io.analytics).not.toHaveBeenCalled();
    expect(io.redirect).not.toHaveBeenCalled();
  });

  it("refuses a ₹0 Explore purchase the same way (no zero-value invoice)", async () => {
    const result = await confirmPricingPurchaseAction("plan-explore", null);
    expect(result.error).toBe(PAID_CHECKOUT_PAUSED_MESSAGE);
    expect(io.rpc).not.toHaveBeenCalled();
  });

  it("purchasePricingPlan called directly (bypassing the action) still never reaches the RPC", async () => {
    await expect(purchasePricingPlan("plan-verified", { couponCode: "ANY" })).rejects.toThrow(PricingCheckoutError);
    expect(io.rpc).not.toHaveBeenCalled();
  });

  it("credentials configured but no approval: still no RPC", async () => {
    setEnv({ RAZORPAY_KEY_ID: ON.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: ON.RAZORPAY_KEY_SECRET });
    expect((await confirmPricingPurchaseAction("plan-verified", null)).error).toBe(PAID_CHECKOUT_PAUSED_MESSAGE);
    expect(io.rpc).not.toHaveBeenCalled();
  });

  it("createCheckoutSessionAction for an existing invoice creates no Razorpay order", async () => {
    setEnv({ RAZORPAY_KEY_ID: ON.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: ON.RAZORPAY_KEY_SECRET });
    const result = await createCheckoutSessionAction("invoice-existing");
    expect(result).toEqual({ session: null, error: OPEN_INVOICE_PAYMENT_PAUSED_MESSAGE });
    expect(io.createOrReuse).not.toHaveBeenCalled();
  });

  it("a direct visit to /pricing/checkout/<slug> shows information only — no confirm button, no analytics", async () => {
    const element = await PricingCheckoutPage({ params: Promise.resolve({ slug: "nextwise-verified" }) });
    const html = renderToStaticMarkup(element);
    expect(html).not.toMatch(/Confirm and continue to payment/);
    expect(html).toMatch(/Book a Free Discovery Session/);
    expect(html).toMatch(/href="\/discovery-session\/book"/);
    expect(html).toMatch(/₹1,999/);
    expect(io.analytics).not.toHaveBeenCalled();
    expect(io.rpc).not.toHaveBeenCalled();
  });

  it("pricing cards never link into checkout; the official price stays visible", () => {
    const html = renderToStaticMarkup(createElement(PublicPricingPlanCard, { plan: plan(), version: version(), offer: null, inclusions: [] }));
    expect(html).not.toMatch(/\/pricing\/checkout\//);
    expect(html).toMatch(/Book a Free Discovery Session/);
    expect(html).toMatch(/₹1,999/);
    expect(html).toMatch(/Tax is included in this price/);
  });

  it("the free Explore card links to registration, not checkout", () => {
    const html = renderToStaticMarkup(
      createElement(PublicPricingPlanCard, {
        plan: plan({ id: "plan-explore", slug: "nextwise-explore" }),
        version: version({ id: "v-explore", planId: "plan-explore", publicTitle: "Nextwise Explore", amountMinorUnits: 0, ctaText: "Start Exploring Free" }),
        offer: null,
        inclusions: [],
      }),
    );
    expect(html).not.toMatch(/\/pricing\/checkout\//);
    expect(html).toMatch(/href="\/register"/);
  });
});

describe("payments ON (all conditions met) — existing behaviour is kept", () => {
  beforeEach(() => setEnv(ON));

  it("confirmPricingPurchaseAction reaches purchase_pricing_plan and redirects to the invoice", async () => {
    await expect(confirmPricingPurchaseAction("plan-verified", null)).rejects.toThrow("NEXT_REDIRECT /payments/invoice-fixture");
    expect(io.rpc).toHaveBeenCalledWith("purchase_pricing_plan", { p_plan_id: "plan-verified", p_offer_id: null, p_coupon_code: null });
  });

  it("checkout session creation is delegated to the CC-18 guarded checkout path", async () => {
    await createCheckoutSessionAction("invoice-existing");
    expect(io.createOrReuse).toHaveBeenCalledWith("invoice-existing");
  });

  it("the card links to checkout", () => {
    const html = renderToStaticMarkup(createElement(PublicPricingPlanCard, { plan: plan(), version: version(), offer: null, inclusions: [], paidCheckoutEnabled: true }));
    expect(html).toMatch(/href="\/pricing\/checkout\/nextwise-verified"/);
  });

  it("only RAISEd (P0001) RPC messages reach students; other database errors are replaced", async () => {
    io.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "permission denied for table invoices" } });
    await expect(purchasePricingPlan("plan-verified")).rejects.toThrow("We couldn't start checkout for this plan. Please try again.");
    io.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "This offer has reached its redemption limit." } });
    await expect(purchasePricingPlan("plan-verified")).rejects.toThrow("This offer has reached its redemption limit.");
  });
});
