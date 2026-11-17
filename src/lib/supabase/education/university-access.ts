import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import {
  canUseUniversityDirectory,
  PENDING_INVOICE_STATUSES,
  resolveUniversityAccess,
  UNIVERSITY_DIRECTORY_PLAN_SLUGS,
  type UniversityAccessState,
} from "@/lib/education/university-discovery/access";

/**
 * University Discovery V3 — server-side access check.
 *
 * Re-derived from the database on every request (cached per request only):
 * the session user, the existing admin_roles lookup, and the live invoice
 * status of the student's own purchases of a qualifying plan, and any
 * administrator grant on the student's account. Every read is
 * RLS-scoped to the signed-in user. Nothing here trusts client state, and any
 * lookup error resolves to the least-privileged answer for that user.
 */
export const getUniversityAccess = cache(async (): Promise<UniversityAccessState> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "anonymous";

  const admin = await getCurrentAdmin();
  if (admin) return resolveUniversityAccess({ isSignedIn: true, isAdmin: true, qualifyingInvoiceStatuses: [] });

  const hasActiveGrant = await readActiveGrant(supabase, user.id);
  const free = () => resolveUniversityAccess({ isSignedIn: true, isAdmin: false, qualifyingInvoiceStatuses: [], hasActiveGrant });

  const { data: plans, error: plansError } = await supabase
    .from("pricing_plans")
    .select("id")
    .in("slug", [...UNIVERSITY_DIRECTORY_PLAN_SLUGS]);
  if (plansError || !plans || plans.length === 0) {
    if (plansError) console.error("[university-access] pricing_plans:", plansError);
    return free();
  }

  const { data: purchases, error: purchasesError } = await supabase
    .from("pricing_purchases")
    .select("invoice_id")
    .eq("student_user_id", user.id)
    .in("plan_id", plans.map((plan) => plan.id as string));
  if (purchasesError) {
    console.error("[university-access] pricing_purchases:", purchasesError);
    return free();
  }
  if (!purchases || purchases.length === 0) return free();

  const invoiceIds = purchases.map((row) => row.invoice_id as string | null).filter((id): id is string => Boolean(id));
  let statusByInvoice = new Map<string, string>();
  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase.from("invoices").select("id, status").in("id", invoiceIds);
    if (invoicesError) {
      console.error("[university-access] invoices:", invoicesError);
      return free();
    }
    statusByInvoice = new Map((invoices ?? []).map((row) => [row.id as string, row.status as string]));
  }

  const statuses = purchases.map((row) => (row.invoice_id ? statusByInvoice.get(row.invoice_id as string) ?? null : null));
  const unpaidInvoiceIds = invoiceIds.filter((id) => PENDING_INVOICE_STATUSES.includes(statusByInvoice.get(id) ?? ""));
  return resolveUniversityAccess({
    isSignedIn: true,
    isAdmin: false,
    qualifyingInvoiceStatuses: statuses,
    hasActiveGrant,
    latestAttemptFailed: statuses.includes("paid") ? false : await latestAttemptFailed(supabase, unpaidInvoiceIds),
  });
});

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * An administrator's grant (public.university_access_grants, UNI_V3/0001). RLS
 * lets a student read only their own rows. Before that migration exists the
 * table is absent: the read errors and the answer is "no grant" (fail closed).
 */
async function readActiveGrant(supabase: ServerSupabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("university_access_grants" as never)
    .select("id, expires_at")
    .eq("student_user_id", userId)
    .eq("scope", "university_directory")
    .is("revoked_at", null);
  if (error || !data) return false;
  const now = Date.now();
  return (data as unknown as { expires_at: string | null }[]).some((row) => row.expires_at === null || Date.parse(row.expires_at) > now);
}

/** True when the newest payment attempt on an unpaid qualifying invoice failed or was cancelled. Any read error means "not known to have failed". */
async function latestAttemptFailed(supabase: ServerSupabase, invoiceIds: string[]): Promise<boolean> {
  if (invoiceIds.length === 0) return false;
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("status, created_at")
    .in("invoice_id", invoiceIds)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return false;
  return ["failed", "cancelled"].includes(data[0].status as string);
}

/**
 * The internal course database is staff-only (see canUseInternalCourseDatabase).
 * Student-facing course routes call this before any course query.
 */
export async function hasInternalCourseAccess(): Promise<boolean> {
  return (await getUniversityAccess()) === "admin";
}

/** Directory access (verified students and staff). Called by every university reader in ./universities.ts. */
export async function hasUniversityDirectoryAccess(): Promise<boolean> {
  return canUseUniversityDirectory(await getUniversityAccess());
}
