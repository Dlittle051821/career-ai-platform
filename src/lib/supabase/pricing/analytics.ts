import "server-only";
import { createClient } from "../server";
import type { PricingAnalyticsEventType } from "@/types/pricing";

/**
 * Records one narrow pricing-funnel event (see 0007_nextwise_pricing_offers.sql
 * PART 5 for the full design rationale). Deliberately fire-and-forget-safe:
 * a failure here is logged and swallowed, never thrown — an analytics
 * hiccup must never block a student from viewing pricing or completing
 * checkout. Works for a signed-out visitor (the table's INSERT policy
 * allows `anon, authenticated`); student_user_id/occurred_at are always
 * server-stamped by the database trigger regardless of what is passed
 * here, so this function cannot be used to forge either.
 */
export async function recordPricingAnalyticsEvent(params: { eventType: PricingAnalyticsEventType; planId?: string | null; offerId?: string | null; sessionRef?: string | null }): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("pricing_analytics_events").insert({
      event_type: params.eventType,
      plan_id: params.planId ?? null,
      offer_id: params.offerId ?? null,
      session_ref: params.sessionRef ?? null,
    });
    if (error) {
      console.error("[pricing/analytics] recordPricingAnalyticsEvent:", error);
    }
  } catch (error) {
    console.error("[pricing/analytics] recordPricingAnalyticsEvent threw:", error);
  }
}
