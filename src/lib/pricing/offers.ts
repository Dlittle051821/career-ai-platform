import type { PricingOffer, PricingPlanVersion } from "@/types/pricing";

/**
 * Pure, framework-free offer validation and price computation — same
 * convention as src/lib/payments/invoice-math.ts and src/lib/payments/tax.ts.
 * This is the DISPLAY/FORM-TIME copy of the logic; the AUTHORITATIVE copy
 * that actually decides what a student is charged runs inside
 * public.purchase_pricing_plan() (supabase/migrations/0007_nextwise_pricing_offers.sql
 * PART 7) — a browser can never make this module's answer the truth,
 * because the browser is never the one deciding the amount that reaches
 * Razorpay. Every function here is deliberately kept in lockstep with that
 * SQL function's logic so the order-summary preview the student sees
 * before confirming matches what the server will actually charge.
 */

export interface OfferValidationError {
  field: "discountPercentBps" | "discountAmountMinorUnits" | "discountCurrency" | "dateRange" | "maxRedemptions" | "perUserLimit" | "couponCode";
  message: string;
}

/**
 * Validates an offer's OWN shape (independent of any specific plan price) —
 * the checks an admin form runs before even attempting to save. Mirrors
 * 0007's pricing_offers_percentage_shape_check / _fixed_shape_check /
 * _date_range_check / _max_redemptions_check / _per_user_limit_check /
 * _coupon_code_format_check CHECK constraints exactly, so a form never
 * submits something the database would reject anyway.
 */
export function validateOfferShape(input: {
  discountType: "fixed" | "percentage";
  discountPercentBps: number | null;
  discountAmountMinorUnits: number | null;
  discountCurrency: string | null;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  couponCode: string | null;
}): OfferValidationError[] {
  const errors: OfferValidationError[] = [];

  if (input.discountType === "percentage") {
    if (input.discountPercentBps === null || input.discountPercentBps <= 0 || input.discountPercentBps > 10_000) {
      errors.push({ field: "discountPercentBps", message: "Percentage must be greater than 0 and no more than 100." });
    }
  } else {
    if (input.discountAmountMinorUnits === null || input.discountAmountMinorUnits <= 0) {
      errors.push({ field: "discountAmountMinorUnits", message: "Fixed discount amount must be a positive number." });
    }
    if (!input.discountCurrency) {
      errors.push({ field: "discountCurrency", message: "A fixed discount requires a currency." });
    }
  }

  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
    errors.push({ field: "dateRange", message: "The offer's end date/time must be after its start date/time." });
  }

  if (input.maxRedemptions !== null && input.maxRedemptions <= 0) {
    errors.push({ field: "maxRedemptions", message: "Maximum redemptions, if set, must be a positive number." });
  }
  if (input.perUserLimit !== null && input.perUserLimit <= 0) {
    errors.push({ field: "perUserLimit", message: "Per-user limit, if set, must be a positive number." });
  }
  if (input.couponCode !== null && !/^[A-Z0-9_-]{3,32}$/.test(input.couponCode)) {
    errors.push({ field: "couponCode", message: "Coupon code must be 3-32 characters: uppercase letters, numbers, hyphens, or underscores." });
  }

  return errors;
}

/** Validates an offer against a SPECIFIC plan version's current price/currency — "Fixed discount cannot exceed the eligible plan amount" and "Fixed discount currency must match the plan currency". */
export function validateOfferAgainstPlan(
  input: { discountType: "fixed" | "percentage"; discountAmountMinorUnits: number | null; discountCurrency: string | null },
  version: Pick<PricingPlanVersion, "amountMinorUnits" | "currency">
): OfferValidationError[] {
  const errors: OfferValidationError[] = [];
  if (input.discountType === "fixed") {
    if (input.discountCurrency && input.discountCurrency !== version.currency) {
      errors.push({ field: "discountCurrency", message: `This offer's currency (${input.discountCurrency}) must match the plan's currency (${version.currency}).` });
    }
    if (input.discountAmountMinorUnits !== null && input.discountAmountMinorUnits > version.amountMinorUnits) {
      errors.push({ field: "discountAmountMinorUnits", message: "The fixed discount cannot exceed the plan's current price." });
    }
  }
  return errors;
}

/** True only for an offer that is active, published, and currently within its start/end window — "Expired, inactive, draft, or future offers cannot apply." */
export function isOfferCurrentlyRedeemable(offer: Pick<PricingOffer, "isActive" | "status" | "startsAt" | "endsAt">, now: Date = new Date()): boolean {
  if (!offer.isActive || offer.status !== "published") return false;
  const start = new Date(offer.startsAt).getTime();
  const end = new Date(offer.endsAt).getTime();
  const t = now.getTime();
  return t >= start && t <= end;
}

/** True once an offer has used up every redemption slot it has (unlimited when maxRedemptions is null). */
export function isOfferExhausted(offer: Pick<PricingOffer, "maxRedemptions" | "redemptionCount">): boolean {
  return offer.maxRedemptions !== null && offer.redemptionCount >= offer.maxRedemptions;
}

export interface PriceBreakdown {
  originalAmountMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  finalAmountMinorUnits: number;
  currency: string;
}

/**
 * Computes the discount a currently-valid offer applies to a plan version's
 * price, clamped so it can never exceed the plan amount (mirrors
 * purchase_pricing_plan()'s defensive clamp — the same protection applies
 * here even though a well-formed offer should never need it).
 */
export function computeOfferDiscount(
  version: Pick<PricingPlanVersion, "amountMinorUnits">,
  offer: Pick<PricingOffer, "discountType" | "discountPercentBps" | "discountAmountMinorUnits">
): number {
  const raw =
    offer.discountType === "percentage"
      ? Math.round((version.amountMinorUnits * (offer.discountPercentBps ?? 0)) / 10_000)
      : (offer.discountAmountMinorUnits ?? 0);
  return Math.min(Math.max(0, raw), version.amountMinorUnits);
}

/**
 * Full price breakdown for display — order-summary preview only, never the
 * amount actually sent to Razorpay (see this module's docblock). "Final
 * price cannot be negative" is structurally guaranteed here: discount is
 * always clamped to at most the original amount, and tax is always >= 0.
 */
export function computePriceBreakdown(
  version: Pick<PricingPlanVersion, "amountMinorUnits" | "currency">,
  offer: Pick<PricingOffer, "discountType" | "discountPercentBps" | "discountAmountMinorUnits"> | null,
  taxRateBps: number | null
): PriceBreakdown {
  const discountMinorUnits = offer ? computeOfferDiscount(version, offer) : 0;
  const taxableBase = version.amountMinorUnits - discountMinorUnits;
  const taxMinorUnits = taxRateBps ? Math.round((taxableBase * taxRateBps) / 10_000) : 0;
  const finalAmountMinorUnits = Math.max(0, taxableBase + taxMinorUnits);

  return {
    originalAmountMinorUnits: version.amountMinorUnits,
    discountMinorUnits,
    taxMinorUnits,
    finalAmountMinorUnits,
    currency: version.currency,
  };
}
