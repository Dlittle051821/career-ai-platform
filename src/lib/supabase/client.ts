"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client. Use this inside Client Components only
 * (forms, the account menu, anything with "use client"). It reads/writes
 * the session via cookies so it stays in sync with the server client and
 * the middleware.
 *
 * Create a fresh client per call rather than a shared singleton — this is
 * the pattern Supabase recommends for the App Router, and it avoids stale
 * state across fast-refresh in development.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
