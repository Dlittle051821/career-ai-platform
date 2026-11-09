import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cookie-free privileged server client. Limited to:
 *  - verified webhook document uploads and their immutable path-capture RPCs;
 *  - CC-16 (F1): staff_finalize_ai_generation_run, called by the AI gateway on
 *    behalf of the staff user it authenticated from that user's own session.
 * Never accepts request headers, cookies or a user session. Ordinary reads and
 * every other write remain RLS scoped through the user's own session client.
 * Missing configuration skips capture without undoing a verified status event.
 */
export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isServiceRoleConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
