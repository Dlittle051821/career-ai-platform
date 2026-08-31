import "server-only";
import { createClient } from "../server";
import { buildEventInsert, type TrackEventInput } from "@/lib/analytics/track";
import type { Json } from "@/types/database";

/**
 * Milestone 9 — records one product_events row from a Server Component,
 * Server Action, or route handler. Mirrors
 * src/lib/supabase/pricing/analytics.ts's recordPricingAnalyticsEvent()
 * exactly: deliberately fire-and-forget-safe. Every call site in this
 * codebase uses this as `void trackEvent(...)` (or an unawaited call) —
 * this function NEVER throws and its returned promise NEVER rejects, so an
 * analytics hiccup (a network blip, a misconfigured client, an RLS
 * surprise) can never break the page render or server action it was
 * called from. Validation/shaping happens first, in the pure
 * src/lib/analytics/track.ts (so a bad event name is caught before any
 * network call is even attempted); everything after that — the Supabase
 * client construction and the insert itself — is wrapped in its own
 * try/catch so a THROW from either (not just an `{ error }` response) is
 * also swallowed.
 *
 * user_id/occurred_at are never included in the insert — they are always
 * server-stamped by the `stamp_product_event` trigger from auth.uid()/
 * now(), so this function cannot be used to forge either even if a caller
 * tried to pass them.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  const built = buildEventInsert(input);
  if (!built.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[analytics] trackEvent: dropped invalid event — ${built.reason}`);
    }
    return;
  }
  if (built.warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`[analytics] trackEvent("${built.insert.event_name}") sanitized properties:`, built.warnings);
  }

  try {
    const supabase = await createClient();
    // properties is already sanitized to JSON-safe primitives/arrays by
    // buildEventInsert() above — this cast only bridges TS's structural
    // `Record<string, unknown>` to the generated `Json` column type, same
    // pattern src/lib/supabase/admin/audit.ts uses for its own jsonb columns.
    const { error } = await supabase.from("product_events").insert({ ...built.insert, properties: built.insert.properties as unknown as Json });
    if (error) {
      logAnalyticsFailure(built.insert.event_name, error);
    }
  } catch (error) {
    logAnalyticsFailure(built.insert.event_name, error);
  }
}

function logAnalyticsFailure(eventName: string, error: unknown) {
  // Deliberately a single, low-noise log line in production (no stack
  // trace flood, no user-facing surface) — an analytics write failing is
  // never itself an incident worth paging on, but it should still be
  // discoverable in server logs. Development gets the full error for
  // debugging.
  if (process.env.NODE_ENV === "production") {
    console.warn(`[analytics] trackEvent("${eventName}") failed`);
  } else {
    console.warn(`[analytics] trackEvent("${eventName}") failed:`, error);
  }
}
