import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";

/**
 * Pricing/offers analytics for the admin Pricing & Offers screen.
 *
 * Deliberately NOT built from a "purchase_succeeded"/"purchase_failed"
 * event log — pricing_analytics_events (0007 PART 5) intentionally only
 * ever records plan_view/plan_selected/checkout_started, exactly the
 * events that carry no money and so are safe for any visitor's browser to
 * write. Revenue, successful-purchase, and failed-payment figures below
 * are instead derived LIVE from the one authoritative ledger this project
 * already has (pricing_purchases + invoices + payment_transactions) —
 * see docs/nextwise-pricing-offers-guide.md §11 for why a second,
 * event-logged copy of "did this purchase succeed" would risk drifting
 * from what actually happened in Razorpay.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/pricing-analytics] ${context}:`, error);
}

export interface PlanFunnelStat {
  planId: string;
  planTitle: string;
  views: number;
  selections: number;
  checkoutStarts: number;
  purchases: number;
  failedPayments: number;
  revenueMinorUnits: number;
  currency: string;
}

export interface OfferUsageStat {
  offerId: string;
  offerName: string;
  couponCode: string | null;
  redemptionCount: number;
  maxRedemptions: number | null;
  totalDiscountMinorUnits: number;
  currency: string;
}

export interface PricingAnalyticsSummary {
  planStats: PlanFunnelStat[];
  offerStats: OfferUsageStat[];
  totalRevenueMinorUnits: number;
  totalPurchases: number;
  totalFailedPayments: number;
}

const EVENT_LOOKBACK_LIMIT = 5000;

/** Full pricing analytics summary — super_admin/admin/finance/analyst only (pricing:read). */
export async function getPricingAnalyticsSummary(): Promise<PricingAnalyticsSummary> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();

  const [{ data: planRows, error: planError }, { data: versionRows }, { data: eventRows, error: eventError }, { data: purchaseRows, error: purchaseError }, { data: offerRows, error: offerError }] = await Promise.all([
    supabase.from("pricing_plans").select("id, slug, current_version_id").order("display_order", { ascending: true }),
    supabase.from("pricing_plan_versions").select("id, plan_id, public_title"),
    supabase.from("pricing_analytics_events").select("event_type, plan_id").order("occurred_at", { ascending: false }).limit(EVENT_LOOKBACK_LIMIT),
    supabase.from("pricing_purchases").select("id, plan_id, final_amount_minor_units, currency, invoice_id, offer_id, discount_minor_units"),
    supabase.from("pricing_offers").select("id, public_offer_name, coupon_code, redemption_count, max_redemptions"),
  ]);

  if (planError) logDbError("plans", planError);
  if (eventError) logDbError("events", eventError);
  if (purchaseError) logDbError("purchases", purchaseError);
  if (offerError) logDbError("offers", offerError);

  const plans = planRows ?? [];
  const versionTitleByPlan = new Map<string, string>();
  for (const v of versionRows ?? []) {
    // Prefer the plan's current_version_id title when we have it; fall back to any version's title.
    if (!versionTitleByPlan.has(v.plan_id)) versionTitleByPlan.set(v.plan_id, v.public_title);
  }

  const purchases = purchaseRows ?? [];
  // A purchase's invoice status decides whether it counts as revenue vs a
  // failure — fetched separately (two plain queries, not an embedded
  // select, same convention as src/lib/supabase/payments/student-invoices.ts).
  const invoiceIds = Array.from(new Set(purchases.map((p) => p.invoice_id).filter((id): id is string => !!id)));
  const invoiceStatusById = new Map<string, string>();
  if (invoiceIds.length > 0) {
    const { data: invoiceRows, error: invoiceError } = await supabase.from("invoices").select("id, status").in("id", invoiceIds);
    if (invoiceError) logDbError("invoices", invoiceError);
    for (const row of invoiceRows ?? []) invoiceStatusById.set(row.id, row.status);
  }
  const PAID_LIKE = new Set(["paid", "partially_paid"]);
  const FAILED_LIKE = new Set(["void"]);

  const events = eventRows ?? [];
  const planStats: PlanFunnelStat[] = plans.map((plan) => {
    const planEvents = events.filter((e) => e.plan_id === plan.id);
    const planPurchases = purchases.filter((p) => p.plan_id === plan.id);
    const paidPurchases = planPurchases.filter((p) => p.invoice_id && PAID_LIKE.has(invoiceStatusById.get(p.invoice_id) ?? ""));
    const failedPurchases = planPurchases.filter((p) => p.invoice_id && FAILED_LIKE.has(invoiceStatusById.get(p.invoice_id) ?? ""));

    return {
      planId: plan.id,
      planTitle: versionTitleByPlan.get(plan.id) ?? plan.slug,
      views: planEvents.filter((e) => e.event_type === "plan_view").length,
      selections: planEvents.filter((e) => e.event_type === "plan_selected").length,
      checkoutStarts: planEvents.filter((e) => e.event_type === "checkout_started").length,
      purchases: planPurchases.length,
      failedPayments: failedPurchases.length,
      revenueMinorUnits: paidPurchases.reduce((sum, p) => sum + p.final_amount_minor_units, 0),
      currency: planPurchases[0]?.currency ?? "INR",
    };
  });

  const offers = offerRows ?? [];
  const offerStats: OfferUsageStat[] = offers.map((offer) => {
    const offerPurchases = purchases.filter((p) => p.offer_id === offer.id);
    return {
      offerId: offer.id,
      offerName: offer.public_offer_name,
      couponCode: offer.coupon_code,
      redemptionCount: offer.redemption_count,
      maxRedemptions: offer.max_redemptions,
      totalDiscountMinorUnits: offerPurchases.reduce((sum, p) => sum + p.discount_minor_units, 0),
      currency: offerPurchases[0]?.currency ?? "INR",
    };
  });

  return {
    planStats,
    offerStats,
    totalRevenueMinorUnits: planStats.reduce((sum, s) => sum + s.revenueMinorUnits, 0),
    totalPurchases: purchases.length,
    totalFailedPayments: planStats.reduce((sum, s) => sum + s.failedPayments, 0),
  };
}
