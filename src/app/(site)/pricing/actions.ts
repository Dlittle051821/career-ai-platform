"use server";

import { getV3Plan } from "@/lib/pricing/v3/catalogue";
import { computePackageQuote, isV3PlanSlug, parseAdditionalUniversities, type PackageQuote } from "@/lib/pricing/v3/quote";
import { createClient } from "@/lib/supabase/server";

/**
 * NW-PRICING-V3 — the server's package quote.
 *
 * The browser sends only a plan slug and a number of additional universities.
 * Both are validated; every amount is read again from the published catalogue
 * on the server, and computePackageQuote() does the arithmetic. For a
 * signed-in student the package is also saved as a quote by the database
 * function create_pricing_quote(), which recalculates it independently from
 * the same published rows; if the two ever disagree the result is refused.
 *
 * A quote is a record of the choice. It is not an invoice, charges nothing and
 * grants nothing.
 */

export type PackageQuoteResponse =
  // saved: "checked" = priced only; "account" = stored as a quote; "not_signed_in" = asked to store but signed out; "unavailable" = storing failed
  | { status: "ok"; planSlug: string; planName: string; quote: PackageQuote; saved: "checked" | "account" | "not_signed_in" | "unavailable"; quoteId: string | null }
  | { status: "invalid"; message: string };

export async function quotePackage(planSlugRaw: unknown, additionalRaw: unknown, saveRaw: unknown = false): Promise<PackageQuoteResponse> {
  if (!isV3PlanSlug(planSlugRaw)) return { status: "invalid", message: "That package isn't offered." };
  const additional = parseAdditionalUniversities(additionalRaw);
  if (additional === null) return { status: "invalid", message: "Choose a whole number of additional universities." };

  const plan = await getV3Plan(planSlugRaw);
  if (!plan) return { status: "invalid", message: "That package isn't available right now." };

  const result = computePackageQuote({ baseAmountMinorUnits: plan.amountMinorUnits, currency: plan.currency, addon: plan.universityAddon, additionalUniversities: additional });
  if (!result.ok) {
    const message =
      result.reason === "addon_not_available"
        ? "Additional universities can be added to Study Abroad Lite and Premium only."
        : result.reason === "over_limit"
          ? "That's more additional universities than can be added to one package. Please talk to a counsellor."
          : "That package can't be priced right now.";
    return { status: "invalid", message };
  }

  if (saveRaw !== true) return { status: "ok", planSlug: plan.slug, planName: plan.name, quote: result.quote, saved: "checked", quoteId: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "ok", planSlug: plan.slug, planName: plan.name, quote: result.quote, saved: "not_signed_in", quoteId: null };

  const { data, error } = await supabase.rpc("create_pricing_quote", { p_plan_slug: plan.slug, p_additional_universities: additional });
  if (error || !data) {
    console.error("[pricing-v3] quote could not be saved");
    return { status: "ok", planSlug: plan.slug, planName: plan.name, quote: result.quote, saved: "unavailable", quoteId: null };
  }
  const saved = data as { id: string; totalAmountMinorUnits: number; baseAmountMinorUnits: number; addonAmountMinorUnits: number };
  if (Number(saved.totalAmountMinorUnits) !== result.quote.totalAmountMinorUnits || Number(saved.baseAmountMinorUnits) !== result.quote.baseAmountMinorUnits || Number(saved.addonAmountMinorUnits) !== result.quote.addonAmountMinorUnits) {
    console.error("[pricing-v3] database and application quote disagree; refused");
    return { status: "invalid", message: "Prices have just changed. Please refresh the page." };
  }
  return { status: "ok", planSlug: plan.slug, planName: plan.name, quote: result.quote, saved: "account", quoteId: saved.id };
}
