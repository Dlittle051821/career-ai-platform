import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Milestone 10 (F-122) — the ONE narrow, documented exception to this
 * codebase's "the app writes only through the logged-in user's own
 * RLS-scoped session, never a service-role bypass" rule (previously true
 * without exception — SUPABASE_SERVICE_ROLE_KEY existed only for the
 * Milestone 9 CLI import tools, never read by the running Next.js app
 * itself).
 *
 * WHY THIS EXCEPTION IS NECESSARY: the signature webhook route
 * (src/app/api/webhooks/signature/route.ts) has NO Supabase session at
 * all — it is called by a machine, not a signed-in admin (same as
 * src/app/api/webhooks/razorpay/route.ts). For every DATABASE write that
 * situation needs, this milestone uses a SECURITY DEFINER Postgres
 * function instead (public.apply_signature_webhook_event(),
 * 0011_electronic_signature.sql PART 6) — the correct, existing pattern
 * this codebase already established for exactly this problem. But Supabase
 * Storage's client API has no equivalent "runs with elevated privilege
 * regardless of caller" concept — storage.objects RLS is evaluated purely
 * against the calling session's own role, and there is no session at all
 * here. The service-role key is Supabase's own documented mechanism for
 * this exact situation (a trusted server process writing to Storage
 * outside any user session) and is used for NOTHING else in the running
 * application — every table read/write anywhere else in this codebase,
 * including everywhere else in this milestone, still goes through the
 * normal RLS-respecting client.
 *
 * Returns null (never throws) when SUPABASE_SERVICE_ROLE_KEY is unset —
 * see src/lib/storage/signed-documents.ts's uploadSignedDocument() for how
 * the caller degrades gracefully when that happens (the signature status
 * itself still updates correctly either way; only the automatic
 * signed-document capture step is skipped, surfaced in the docs as a
 * "what needs manual configuration" item).
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
