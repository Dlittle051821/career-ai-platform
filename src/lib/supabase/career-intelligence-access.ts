import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { plansWithCapability } from "@/config/plan-capabilities";
import {
  canViewCareerIntelligence,
  careerIntelligenceAccessHref,
  resolveCareerIntelligenceAccess,
  type CareerIntelligenceAccessState,
  type CareerIntelligenceGateSource,
} from "@/lib/career-intelligence/access";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Career Intelligence access — THE server-side resolver.
 *
 * Every page, server action and data read that would show a personalised
 * Career Intelligence output asks this module, and only this module. It is
 * re-evaluated on every request from the live tables (cached only for the
 * length of one request), so a refund or a new payment takes effect on the
 * next page load and a result computed earlier is never shown on the
 * strength of an old entitlement.
 *
 * It reads, in order: the session; the admin role; which plans carry the
 * `career_intelligence` capability (src/config/plan-capabilities.ts, by
 * slug); the student's own purchases of those plans; and the live status of
 * each purchase's invoice. All reads run as the signed-in student under the
 * existing row-level security — no service-role key, nothing from the
 * browser, nothing from user-editable metadata.
 *
 * Fail closed: if any lookup errors, the answer is "free", never "active".
 *
 * Not consulted: University Discovery's admin grants. Those are scoped to
 * the university directory and are left exactly as V3 defined them; they do
 * not unlock Career Intelligence.
 */
export const getCareerIntelligenceAccess = cache(async (): Promise<CareerIntelligenceAccessState> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "anonymous";

  if (await getCurrentAdmin()) return resolveCareerIntelligenceAccess({ isSignedIn: true, isStaff: true, qualifyingInvoiceStatuses: [] });

  const free = () => resolveCareerIntelligenceAccess({ isSignedIn: true, isStaff: false, qualifyingInvoiceStatuses: [] });
  const qualifyingSlugs = plansWithCapability("career_intelligence");
  if (qualifyingSlugs.length === 0) return free();

  const { data: plans, error: plansError } = await supabase.from("pricing_plans").select("id").in("slug", qualifyingSlugs);
  if (plansError || !plans || plans.length === 0) {
    if (plansError) console.error("[career-intelligence-access] pricing_plans:", plansError);
    return free();
  }

  const { data: purchases, error: purchasesError } = await supabase
    .from("pricing_purchases")
    .select("invoice_id")
    .eq("student_user_id", user.id)
    .in(
      "plan_id",
      plans.map((plan) => plan.id as string),
    );
  if (purchasesError) {
    console.error("[career-intelligence-access] pricing_purchases:", purchasesError);
    return free();
  }
  if (!purchases || purchases.length === 0) return free();

  const invoiceIds = purchases.map((row) => row.invoice_id as string | null).filter((id): id is string => Boolean(id));
  let statusByInvoice = new Map<string, string>();
  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase.from("invoices").select("id, status").in("id", invoiceIds);
    if (invoicesError) {
      console.error("[career-intelligence-access] invoices:", invoicesError);
      return free();
    }
    statusByInvoice = new Map((invoices ?? []).map((row) => [row.id as string, row.status as string]));
  }

  return resolveCareerIntelligenceAccess({
    isSignedIn: true,
    isStaff: false,
    qualifyingInvoiceStatuses: purchases.map((row) => (row.invoice_id ? (statusByInvoice.get(row.invoice_id as string) ?? null) : null)),
  });
});

/** True when the signed-in user may see personalised Career Intelligence right now. */
export async function canAccessCareerIntelligence(): Promise<boolean> {
  return canViewCareerIntelligence(await getCareerIntelligenceAccess());
}

/**
 * For a page that is nothing but protected output: sends anyone without
 * access to the upgrade screen before anything personalised is computed.
 */
export async function requireCareerIntelligence(from: CareerIntelligenceGateSource): Promise<CareerIntelligenceAccessState> {
  const state = await getCareerIntelligenceAccess();
  if (!canViewCareerIntelligence(state)) redirect(careerIntelligenceAccessHref(from));
  return state;
}
