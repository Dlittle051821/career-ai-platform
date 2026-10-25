import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listMyPurchases } from "@/lib/supabase/pricing/my-purchases";
import type { PricingCategory, PricingPurchase } from "@/types/pricing";

/**
 * NW03.4 — Shared auth, profile & entitlement foundation.
 *
 * Maps the signed-in student's existing purchase history to the two NW03
 * products, using the `PricingCategory` enum that already exists in
 * src/types/pricing.ts — zero new tables, zero migrations. See
 * docs/milestones/NW03/NW03_01_AUDIT.md section 4 for the reasoning.
 *
 * This is informational only. Per the brief's explicit requirement (AC-04:
 * neither product may require the other), nothing in this codebase should
 * ever use `hasCareerEntitlement`/`hasAbroadEntitlement` to gate the free
 * parts of either product — Career discovery and the Abroad Country
 * Explorer both stay fully usable with zero purchases. The intended use is
 * purely presentational (e.g. a future "you already have an active plan"
 * notice), and always re-derived server-side from `pricing_purchases` on
 * every call — never cached in a client-readable cookie or localStorage a
 * visitor could forge, which is what "server-enforced, never
 * client-state-only" means in practice here.
 *
 * Split into a pure classifier (`classifyPurchaseEntitlements`, unit-
 * testable with no Supabase/network dependency) and an I/O wrapper
 * (`getMyProductEntitlements`) that fetches the things the classifier
 * needs — following the same pure-function/I/O-component convention used
 * throughout this codebase (e.g. src/lib/dashboard/journey-progress.ts,
 * src/lib/navigation/account-menu.ts).
 *
 * NW05.6 — SECURITY FIX (P0, found by NW05.1's audit).
 *
 * Before this fix, a `pricing_purchases` ROW EXISTING was treated as proof
 * of an active entitlement. That row is created by
 * `public.purchase_pricing_plan()` at CHECKOUT-CONFIRMATION time — i.e.
 * BEFORE the student has actually paid via Razorpay (see
 * src/lib/supabase/pricing/checkout.ts / src/app/(site)/pricing/checkout/
 * actions.ts: the RPC runs, then the browser is redirected to
 * `/payments/[invoiceId]` for the real payment step) — and the row is
 * never deleted or updated if the payment later fails, or if the invoice
 * is subsequently refunded. So the pre-fix logic granted a paid
 * entitlement to a student who had merely STARTED checkout, and never
 * revoked it on refund.
 *
 * The fix: a purchase only ever counts toward entitlement when its linked
 * invoice's live, authoritative status — `invoices.status`, maintained
 * EXCLUSIVELY by the existing `recompute_invoice_status()` Postgres
 * function (`supabase/migrations/0005_payments_billing.sql`), driven by
 * real `payment_transactions`/`public.refunds` rows — is exactly `'paid'`.
 * Every other status (`draft`/`issued`/`partially_paid`/`overdue`/`void`/
 * `refunded`/`partially_refunded`) excludes the purchase, and so does a
 * purchase with no linked invoice at all. This required zero schema
 * change: `recompute_invoice_status()` already existed and was already
 * correct — this fix is purely a read-side join that was missing.
 *
 * Fail-closed (ENTITLEMENT RULE 13 in the NW05 brief): if either the
 * plan-category lookup or the invoice-status lookup fails or returns
 * nothing usable, this returns the all-false/empty shape — never falls
 * back to "a purchase row exists, so grant it anyway", which is the exact
 * defect being fixed here.
 */

export type ProductId = "career" | "abroad";

export const CAREER_PRICING_CATEGORIES: readonly PricingCategory[] = [
  "school_counselling",
  "class_11_counselling",
  "class_12_counselling",
];

export const ABROAD_PRICING_CATEGORIES: readonly PricingCategory[] = ["bachelor_abroad", "master_abroad"];

/** Pure lookup — which product a given pricing category belongs to. Exhaustive over `PRICING_CATEGORIES` (see the module-level test for a regression guard if a new category is ever added without updating this function). */
export function productForCategory(category: PricingCategory): ProductId {
  return (ABROAD_PRICING_CATEGORIES as readonly string[]).includes(category) ? "abroad" : "career";
}

export interface ProductEntitlements {
  hasCareerEntitlement: boolean;
  hasAbroadEntitlement: boolean;
  careerPurchases: PricingPurchase[];
  abroadPurchases: PricingPurchase[];
}

const EMPTY_ENTITLEMENTS: ProductEntitlements = {
  hasCareerEntitlement: false,
  hasAbroadEntitlement: false,
  careerPurchases: [],
  abroadPurchases: [],
};

/**
 * Pure classifier: given a purchase list, a (already-fetched) plan-id ->
 * category lookup, and the set of invoice ids whose live status is
 * exactly `'paid'`, splits the purchases by product. A purchase whose
 * `planId` is null (legacy/manually-recorded purchase — see
 * src/types/pricing.ts's own `PricingPurchase.planId` comment), whose plan
 * id isn't in the lookup, whose `invoiceId` is null, or whose invoice is
 * not in `paidInvoiceIds` is never guessed into either product — it is
 * simply excluded, matching this codebase's "never fabricate a signal"
 * discipline. This means `hasCareerEntitlement`/`hasAbroadEntitlement` can
 * both be false even for a student with purchase history, if none of it
 * resolves to a known, currently-paid category; that is the honest
 * answer, not a bug. See this module's NW05.6 docblock above for why the
 * invoice check exists at all.
 */
export function classifyPurchaseEntitlements(
  purchases: readonly PricingPurchase[],
  categoryByPlanId: ReadonlyMap<string, PricingCategory>,
  paidInvoiceIds: ReadonlySet<string>
): ProductEntitlements {
  if (purchases.length === 0) return EMPTY_ENTITLEMENTS;

  const careerPurchases: PricingPurchase[] = [];
  const abroadPurchases: PricingPurchase[] = [];
  for (const purchase of purchases) {
    if (!purchase.planId) continue;
    const category = categoryByPlanId.get(purchase.planId);
    if (!category) continue;
    // NW05.6 — the entitlement gate itself: a purchase row's mere
    // existence is never proof of payment (see this module's top
    // docblock). No invoiceId, an invoice that isn't 'paid' (still
    // issued/partially paid/overdue/void), or a refunded/partially
    // refunded one all fall through here, deliberately and silently —
    // never surfaced to the student as an error, just no entitlement.
    if (!purchase.invoiceId || !paidInvoiceIds.has(purchase.invoiceId)) continue;
    if (productForCategory(category) === "abroad") abroadPurchases.push(purchase);
    else careerPurchases.push(purchase);
  }

  return {
    hasCareerEntitlement: careerPurchases.length > 0,
    hasAbroadEntitlement: abroadPurchases.length > 0,
    careerPurchases,
    abroadPurchases,
  };
}

function logDbError(context: string, error: unknown) {
  console.error(`[products/entitlements] ${context}:`, error);
}

/**
 * I/O wrapper: reads the signed-in student's real purchases
 * (`listMyPurchases()`, RLS-scoped to `auth.uid()`), the categories of the
 * plans they belong to (`pricing_plans`, readable by anyone per its own
 * "Anyone can read..." RLS policy — same policy `listPublicPricingPlans()`
 * already relies on), and the live status of the invoices those purchases
 * are linked to (`invoices` — RLS-scoped to the owning student; also
 * structurally safe here regardless, since `invoiceIds` is derived only
 * from this student's OWN already-RLS-scoped `purchases`, never from
 * client input), then classifies them. Returns the all-false/empty shape
 * for a logged-out visitor, a student with no purchases, a student with
 * no purchase linked to any invoice, or on any lookup error — fail-closed,
 * per this module's NW05.6 docblock above. Never throws.
 */
export async function getMyProductEntitlements(): Promise<ProductEntitlements> {
  const purchases = await listMyPurchases();
  if (purchases.length === 0) return EMPTY_ENTITLEMENTS;

  const planIds = Array.from(new Set(purchases.map((p) => p.planId).filter((id): id is string => Boolean(id))));
  const invoiceIds = Array.from(new Set(purchases.map((p) => p.invoiceId).filter((id): id is string => Boolean(id))));
  if (planIds.length === 0 || invoiceIds.length === 0) return EMPTY_ENTITLEMENTS;

  const supabase = await createClient();
  const [plansResult, invoicesResult] = await Promise.all([
    supabase.from("pricing_plans").select("id, category").in("id", planIds),
    supabase.from("invoices").select("id, status").in("id", invoiceIds),
  ]);

  if (plansResult.error) {
    logDbError("getMyProductEntitlements (pricing_plans)", plansResult.error);
    return EMPTY_ENTITLEMENTS;
  }
  if (invoicesResult.error) {
    logDbError("getMyProductEntitlements (invoices)", invoicesResult.error);
    return EMPTY_ENTITLEMENTS;
  }

  const categoryByPlanId = new Map<string, PricingCategory>(
    (plansResult.data ?? []).map((row) => [row.id as string, row.category as PricingCategory])
  );
  const paidInvoiceIds = new Set<string>(
    (invoicesResult.data ?? []).filter((row) => row.status === "paid").map((row) => row.id as string)
  );

  return classifyPurchaseEntitlements(purchases, categoryByPlanId, paidInvoiceIds);
}
