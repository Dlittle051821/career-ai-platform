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
 * (`getMyProductEntitlements`) that fetches the two things the classifier
 * needs — following the same pure-function/I/O-component convention used
 * throughout this codebase (e.g. src/lib/dashboard/journey-progress.ts,
 * src/lib/navigation/account-menu.ts).
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
 * Pure classifier: given a purchase list and a (already-fetched) plan-id ->
 * category lookup, splits the purchases by product. A purchase whose
 * `planId` is null (legacy/manually-recorded purchase — see
 * src/types/pricing.ts's own `PricingPurchase.planId` comment) or whose
 * plan id isn't in the lookup is never guessed into either product — it is
 * simply excluded, matching this codebase's "never fabricate a signal"
 * discipline. This means `hasCareerEntitlement`/`hasAbroadEntitlement` can
 * both be false even for a student with purchase history, if none of it
 * resolves to a known category; that is the honest answer, not a bug.
 */
export function classifyPurchaseEntitlements(
  purchases: readonly PricingPurchase[],
  categoryByPlanId: ReadonlyMap<string, PricingCategory>
): ProductEntitlements {
  if (purchases.length === 0) return EMPTY_ENTITLEMENTS;

  const careerPurchases: PricingPurchase[] = [];
  const abroadPurchases: PricingPurchase[] = [];
  for (const purchase of purchases) {
    if (!purchase.planId) continue;
    const category = categoryByPlanId.get(purchase.planId);
    if (!category) continue;
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
 * (`listMyPurchases()`, RLS-scoped to `auth.uid()`) and the categories of
 * the plans they belong to (`pricing_plans`, readable by anyone per its own
 * "Anyone can read..." RLS policy — same policy `listPublicPricingPlans()`
 * already relies on), then classifies them. Returns the all-false/empty
 * shape for a logged-out visitor or a student with no purchases — never
 * throws.
 */
export async function getMyProductEntitlements(): Promise<ProductEntitlements> {
  const purchases = await listMyPurchases();
  if (purchases.length === 0) return EMPTY_ENTITLEMENTS;

  const planIds = Array.from(new Set(purchases.map((p) => p.planId).filter((id): id is string => Boolean(id))));
  if (planIds.length === 0) return classifyPurchaseEntitlements(purchases, new Map());

  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_plans").select("id, category").in("id", planIds);
  if (error) {
    logDbError("getMyProductEntitlements", error);
    return classifyPurchaseEntitlements(purchases, new Map());
  }

  const categoryByPlanId = new Map<string, PricingCategory>(
    (data ?? []).map((row) => [row.id as string, row.category as PricingCategory])
  );
  return classifyPurchaseEntitlements(purchases, categoryByPlanId);
}
