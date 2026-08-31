import "server-only";
import { createClient } from "../server";
import { getCurrentUser } from "../profile";

/**
 * The student-facing entry point from "select a plan" to "a real invoice
 * exists" — a thin wrapper around the public.purchase_pricing_plan() RPC
 * (supabase/migrations/0007_nextwise_pricing_offers.sql PART 7), which is
 * the only place that actually re-validates the plan/offer/amount/currency/
 * effective dates and writes the invoice. This file adds no business logic
 * of its own on top of that RPC — see the RPC's own extensive comments for
 * why every check happens there, never here or in the browser.
 *
 * Once this returns an invoiceId, the EXISTING Milestone 8 checkout flow
 * takes over completely unchanged:
 *   src/lib/supabase/payments/checkout.ts's createOrReuseCheckoutSession(invoiceId)
 *   -> PayButton (Razorpay Checkout.js)
 *   -> verifyCheckoutPayment(...) -> public.verify_checkout_payment()
 * This file never creates a payment_attempts/payment_transactions row
 * itself — there is exactly one checkout code path in this application,
 * and a plan purchase is simply the invoice that feeds it.
 */

export class PricingCheckoutError extends Error {}

function logDbError(context: string, error: unknown) {
  console.error(`[pricing/checkout] ${context}:`, error);
}

export interface PurchasePlanResult {
  invoiceId: string;
  reused: boolean;
}

/**
 * Calls public.purchase_pricing_plan(). `offerId`/`couponCode` are hints
 * about which offer to try — the RPC independently re-validates whichever
 * one it resolves (or rejects both with a clear error) rather than trusting
 * that either identifies a currently-valid offer.
 */
export async function purchasePricingPlan(planId: string, options: { offerId?: string; couponCode?: string } = {}): Promise<PurchasePlanResult> {
  const user = await getCurrentUser();
  if (!user) throw new PricingCheckoutError("You must be signed in to purchase a plan.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purchase_pricing_plan", {
    p_plan_id: planId,
    p_offer_id: options.offerId ?? null,
    p_coupon_code: options.couponCode ?? null,
  });

  if (error) {
    logDbError("purchasePricingPlan", error);
    // The RPC's own RAISE EXCEPTION messages are already written to be
    // shown directly to the student (e.g. "This offer has reached its
    // redemption limit.") — same "the action authored this message on
    // purpose" convention as AdminValidationError.
    throw new PricingCheckoutError(error.message || "We couldn't start checkout for this plan. Please try again.");
  }
  if (!data || typeof data !== "object" || !("invoice_id" in data)) {
    throw new PricingCheckoutError("We couldn't start checkout for this plan. Please try again.");
  }

  const result = data as { invoice_id: string; reused?: boolean };
  return { invoiceId: result.invoice_id, reused: Boolean(result.reused) };
}
