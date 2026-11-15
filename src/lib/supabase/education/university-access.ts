import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import {
  canUseUniversityDirectory,
  resolveUniversityAccess,
  UNIVERSITY_DIRECTORY_PLAN_SLUGS,
  type UniversityAccessState,
} from "@/lib/education/university-discovery/access";

/**
 * University Discovery V3 — server-side access check.
 *
 * Re-derived from the database on every request (cached per request only):
 * the session user, the existing admin_roles lookup, and the live invoice
 * status of the student's own purchases of a qualifying plan. Every read is
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

  const { data: plans, error: plansError } = await supabase
    .from("pricing_plans")
    .select("id")
    .in("slug", [...UNIVERSITY_DIRECTORY_PLAN_SLUGS]);
  if (plansError || !plans || plans.length === 0) {
    if (plansError) console.error("[university-access] pricing_plans:", plansError);
    return "signed_in_free";
  }

  const { data: purchases, error: purchasesError } = await supabase
    .from("pricing_purchases")
    .select("invoice_id")
    .eq("student_user_id", user.id)
    .in("plan_id", plans.map((plan) => plan.id as string));
  if (purchasesError) {
    console.error("[university-access] pricing_purchases:", purchasesError);
    return "signed_in_free";
  }
  if (!purchases || purchases.length === 0) return "signed_in_free";

  const invoiceIds = purchases.map((row) => row.invoice_id as string | null).filter((id): id is string => Boolean(id));
  let statusByInvoice = new Map<string, string>();
  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase.from("invoices").select("id, status").in("id", invoiceIds);
    if (invoicesError) {
      console.error("[university-access] invoices:", invoicesError);
      return "signed_in_free";
    }
    statusByInvoice = new Map((invoices ?? []).map((row) => [row.id as string, row.status as string]));
  }

  return resolveUniversityAccess({
    isSignedIn: true,
    isAdmin: false,
    qualifyingInvoiceStatuses: purchases.map((row) => (row.invoice_id ? statusByInvoice.get(row.invoice_id as string) ?? null : null)),
  });
});

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
