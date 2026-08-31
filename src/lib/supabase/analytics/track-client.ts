"use client";

import { createClient } from "../client";
import { buildEventInsert, type TrackEventInput } from "@/lib/analytics/track";
import type { Json } from "@/types/database";

/**
 * Milestone 9 — the browser-side twin of ./track.ts's trackEvent(), for
 * the handful of call sites that are Client Components rather than Server
 * Components/Actions (currently only RegisterForm.tsx, for
 * `user_registered` — supabase.auth.signUp() itself only has a
 * client-side call path in this codebase, so the event that depends on
 * its result has to be fired from the client too). Same fire-and-forget
 * contract as trackEvent(): never throws, its returned promise never
 * rejects, validation/sanitization happens first via the same pure
 * src/lib/analytics/track.ts buildEventInsert() both wrappers share.
 *
 * Uses the publishable-key browser client (src/lib/supabase/client.ts),
 * matching the INSERT policy on product_events which explicitly allows
 * `anon, authenticated` — a signed-in user's session cookie still flows
 * through this client, so the stamp_product_event trigger still correctly
 * resolves auth.uid() server-side even though the call originates in the
 * browser.
 */
export async function trackEventClient(input: TrackEventInput): Promise<void> {
  const built = buildEventInsert(input);
  if (!built.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[analytics] trackEventClient: dropped invalid event — ${built.reason}`);
    }
    return;
  }
  if (built.warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`[analytics] trackEventClient("${built.insert.event_name}") sanitized properties:`, built.warnings);
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.from("product_events").insert({ ...built.insert, properties: built.insert.properties as unknown as Json });
    if (error) {
      console.warn(`[analytics] trackEventClient("${built.insert.event_name}") failed:`, process.env.NODE_ENV === "production" ? undefined : error);
    }
  } catch (error) {
    console.warn(`[analytics] trackEventClient("${built.insert.event_name}") threw:`, process.env.NODE_ENV === "production" ? undefined : error);
  }
}
