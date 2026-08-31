"use server";

import { redirect } from "next/navigation";
import { purchasePricingPlan, PricingCheckoutError } from "@/lib/supabase/pricing/checkout";
import { recordPricingAnalyticsEvent } from "@/lib/supabase/pricing/analytics";

export interface ConfirmPurchaseResult {
  error: string | null;
}

/**
 * Called from ConfirmCheckoutButton after the student reviews the order
 * summary on /pricing/checkout/[slug]. Never computes or trusts a price
 * itself — purchasePricingPlan() calls public.purchase_pricing_plan(),
 * which independently re-validates the plan/offer/amount/currency/effective
 * dates server-side and is the only place an invoice actually gets created.
 * On success this redirects straight into the EXISTING Milestone 8 checkout
 * flow (/payments/[invoiceId] -> PayButton -> Razorpay) — there is no
 * second payment path. `redirect()` is deliberately called AFTER the
 * try/catch (never inside it): Next.js implements redirect by throwing, and
 * catching that throw here would misreport a successful redirect as a
 * checkout error.
 */
export async function confirmPricingPurchaseAction(planId: string, offerId: string | null): Promise<ConfirmPurchaseResult> {
  let invoiceId: string;
  try {
    await recordPricingAnalyticsEvent({ eventType: "checkout_started", planId, offerId });
    const result = await purchasePricingPlan(planId, { offerId: offerId ?? undefined });
    invoiceId = result.invoiceId;
  } catch (error) {
    return { error: error instanceof PricingCheckoutError ? error.message : "We couldn't start checkout. Please try again." };
  }
  redirect(`/payments/${invoiceId}`);
}
