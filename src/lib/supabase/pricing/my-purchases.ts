import "server-only";
import { createClient } from "../server";
import { getCurrentUser } from "../profile";
import type { PricingInclusionSnapshot, PricingPresentationLimitsSnapshot, PricingPurchase, PricingServiceItem } from "@/types/pricing";

/**
 * Student-facing purchase-history reads for the dashboard's pricing/
 * purchase section. Gated purely by pricing_purchases' own "Students can
 * read their own purchases" RLS policy (auth.uid() = student_user_id) —
 * same "thin, student-scoped counterpart to the admin module" convention
 * as src/lib/supabase/payments/student-invoices.ts.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[pricing/my-purchases] ${context}:`, error);
}

interface PurchaseRow {
  id: string;
  student_user_id: string | null;
  plan_id: string | null;
  plan_version_id: string | null;
  plan_name_at_purchase: string;
  included_services_at_purchase: unknown;
  original_amount_minor_units: number;
  discount_minor_units: number;
  tax_minor_units: number;
  final_amount_minor_units: number;
  currency: string;
  offer_id: string | null;
  coupon_code_used: string | null;
  invoice_id: string | null;
  purchased_at: string;
  session_count_at_purchase: number | null;
  inclusions_at_purchase: unknown;
  presentation_limits_at_purchase: unknown;
}

function toServiceItems(value: unknown): PricingServiceItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is PricingServiceItem => typeof v === "object" && v !== null && typeof (v as PricingServiceItem).label === "string");
}

function toInclusionSnapshots(value: unknown): PricingInclusionSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is PricingInclusionSnapshot => typeof v === "object" && v !== null && typeof (v as PricingInclusionSnapshot).title === "string");
}

function toPresentationLimits(value: unknown): PricingPresentationLimitsSnapshot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length === 0) return null;
  return {
    sessionDurationNote: typeof v.sessionDurationNote === "string" ? v.sessionDurationNote : null,
    audienceLabel: typeof v.audienceLabel === "string" ? v.audienceLabel : null,
    universityShortlistLimit: typeof v.universityShortlistLimit === "number" ? v.universityShortlistLimit : null,
    applicationSupportLimit: typeof v.applicationSupportLimit === "number" ? v.applicationSupportLimit : null,
    sopReviewRounds: typeof v.sopReviewRounds === "number" ? v.sopReviewRounds : null,
    scholarshipSupportNote: typeof v.scholarshipSupportNote === "string" ? v.scholarshipSupportNote : null,
    mockInterviewCount: typeof v.mockInterviewCount === "number" ? v.mockInterviewCount : null,
    counsellorTier: typeof v.counsellorTier === "string" ? v.counsellorTier : null,
    supportDurationNote: typeof v.supportDurationNote === "string" ? v.supportDurationNote : null,
  };
}

function toPurchase(row: PurchaseRow): PricingPurchase {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    planId: row.plan_id,
    planVersionId: row.plan_version_id,
    planNameAtPurchase: row.plan_name_at_purchase,
    includedServicesAtPurchase: toServiceItems(row.included_services_at_purchase),
    originalAmountMinorUnits: row.original_amount_minor_units,
    discountMinorUnits: row.discount_minor_units,
    taxMinorUnits: row.tax_minor_units,
    finalAmountMinorUnits: row.final_amount_minor_units,
    currency: row.currency,
    offerId: row.offer_id,
    couponCodeUsed: row.coupon_code_used,
    invoiceId: row.invoice_id,
    purchasedAt: row.purchased_at,
    sessionCountAtPurchase: row.session_count_at_purchase,
    inclusionsAtPurchase: toInclusionSnapshots(row.inclusions_at_purchase),
    presentationLimitsAtPurchase: toPresentationLimits(row.presentation_limits_at_purchase),
  };
}

/** Every plan purchase belonging to the signed-in student, newest first. */
export async function listMyPurchases(): Promise<PricingPurchase[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data, error } = await supabase.from("pricing_purchases").select("*").eq("student_user_id", user.id).order("purchased_at", { ascending: false });
  if (error) {
    logDbError("listMyPurchases", error);
    return [];
  }
  return ((data ?? []) as PurchaseRow[]).map(toPurchase);
}
