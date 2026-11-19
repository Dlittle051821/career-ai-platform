/**
 * NW-PRICING-V3 — the package-price arithmetic, in integer minor units (paise).
 *
 * Pure and shared: the page uses it to show the total as the student changes
 * the number of universities; the server action uses the same function with
 * amounts it has just read from the published catalogue; and the database's
 * create_pricing_quote() repeats the calculation itself before anything is
 * saved. Nothing here ever trusts an amount from the browser — the only
 * inputs a client can influence are the plan slug and a whole number of
 * additional universities, both validated here.
 *
 *   additional cost = additional universities × unit price
 *   package total   = base price + additional cost
 *   coverage        = included universities + additional universities
 */

export const V3_PLAN_SLUGS = {
  verified: "nextwise-verified",
  lite: "study-abroad-lite",
  premium: "study-abroad-premium",
} as const;
export type V3PlanSlug = (typeof V3_PLAN_SLUGS)[keyof typeof V3_PLAN_SLUGS];
export const V3_PLAN_ORDER: readonly V3PlanSlug[] = [V3_PLAN_SLUGS.verified, V3_PLAN_SLUGS.lite, V3_PLAN_SLUGS.premium];

export function isV3PlanSlug(value: unknown): value is V3PlanSlug {
  return typeof value === "string" && (V3_PLAN_ORDER as readonly string[]).includes(value);
}

/**
 * A safety ceiling on how many additional universities one request may ask
 * for, so a hostile value can't overflow arithmetic. It is not the commercial
 * limit: that is the add-on's own configured max_additional_quantity (none is
 * configured today), which is applied on top.
 */
export const ADDITIONAL_UNIVERSITIES_HARD_CEILING = 100;

export interface UniversityAddonTerms {
  includedQuantity: number;
  unitAmountMinorUnits: number;
  currency: string;
  /** The configured commercial limit, or null when none is configured. */
  maxAdditionalQuantity: number | null;
}

export interface PackagePriceInput {
  baseAmountMinorUnits: number;
  currency: string;
  addon: UniversityAddonTerms | null;
  additionalUniversities: number;
}

export interface PackageQuote {
  currency: string;
  baseAmountMinorUnits: number;
  includedUniversities: number | null;
  additionalUniversities: number;
  addonUnitAmountMinorUnits: number | null;
  addonAmountMinorUnits: number;
  totalAmountMinorUnits: number;
  totalUniversities: number | null;
}

export type QuoteFailure = "invalid_quantity" | "addon_not_available" | "over_limit" | "invalid_catalogue";
export type QuoteResult = { ok: true; quote: PackageQuote } | { ok: false; reason: QuoteFailure };

const isWholeMinor = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** A whole number of additional universities from untrusted input, or null. Accepts 3 or "3"; rejects -1, 1.5, "1e2", "", NaN. */
export function parseAdditionalUniversities(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isSafeInteger(n) || n < 0 || n > ADDITIONAL_UNIVERSITIES_HARD_CEILING) return null;
  return n;
}

/** The highest number of additional universities that may be chosen with these terms. */
export function maxAdditional(addon: UniversityAddonTerms | null): number {
  if (!addon) return 0;
  return addon.maxAdditionalQuantity === null ? ADDITIONAL_UNIVERSITIES_HARD_CEILING : Math.min(addon.maxAdditionalQuantity, ADDITIONAL_UNIVERSITIES_HARD_CEILING);
}

export function computePackageQuote(input: PackagePriceInput): QuoteResult {
  const { baseAmountMinorUnits, currency, addon, additionalUniversities } = input;
  if (!isWholeMinor(baseAmountMinorUnits) || !/^[A-Z]{3}$/.test(currency)) return { ok: false, reason: "invalid_catalogue" };
  if (!Number.isSafeInteger(additionalUniversities) || additionalUniversities < 0) return { ok: false, reason: "invalid_quantity" };
  if (addon) {
    if (!isWholeMinor(addon.unitAmountMinorUnits) || addon.unitAmountMinorUnits === 0 || !Number.isSafeInteger(addon.includedQuantity) || addon.includedQuantity < 0 || addon.currency !== currency) {
      return { ok: false, reason: "invalid_catalogue" };
    }
  }
  if (additionalUniversities > 0 && !addon) return { ok: false, reason: "addon_not_available" };
  if (additionalUniversities > maxAdditional(addon)) return { ok: false, reason: "over_limit" };

  const addonAmount = addon ? additionalUniversities * addon.unitAmountMinorUnits : 0;
  const total = baseAmountMinorUnits + addonAmount;
  if (!Number.isSafeInteger(total)) return { ok: false, reason: "invalid_catalogue" };
  return {
    ok: true,
    quote: {
      currency,
      baseAmountMinorUnits,
      includedUniversities: addon ? addon.includedQuantity : null,
      additionalUniversities,
      addonUnitAmountMinorUnits: addon ? addon.unitAmountMinorUnits : null,
      addonAmountMinorUnits: addonAmount,
      totalAmountMinorUnits: total,
      totalUniversities: addon ? addon.includedQuantity + additionalUniversities : null,
    },
  };
}

/** ₹68,996 — whole rupees with Indian digit grouping; paise shown only when present. */
export function formatInr(minor: number): string {
  const rupees = minor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
