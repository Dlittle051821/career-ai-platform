/**
 * NW01 Part H "Pricing, Tax & Payment Truth".
 *
 * CONFIRMED ROOT CAUSE of the reported "₹1,999 became ₹2,358.82 after tax"
 * defect: `public.purchase_pricing_plan()` (supabase/migrations/
 * 0007_nextwise_pricing_offers.sql PART 7, re-created unchanged by 0008)
 * computes
 *
 *   v_tax_minor := round((amount - discount) * tax_rate_bps / 10000.0)
 *   v_total_minor := (amount - discount) + v_tax_minor
 *
 * for EVERY plan version once GST is configured globally
 * (`billing_settings.gst_registered`/`gstin`), regardless of that plan
 * version's own `tax_status` column. `tax_status` ("unconfigured" /
 * "tax_exclusive" / "tax_inclusive") is admin-settable per plan version
 * (src/app/admin/pricing/.../versions/...) and IS shown to the public —
 * `PublicPricingPlanCard.tsx`'s `TAX_WORDING` renders "Applicable tax will
 * be added at checkout." for `tax_exclusive` and "Tax is included in this
 * price." for `tax_inclusive` — but the SQL function never actually reads
 * it; 0007's own migration comment admits this explicitly: "a true
 * tax-inclusive back-calculation is deliberately not implemented." The
 * real seeded "Nextwise Verified" plan (supabase/seed/
 * 0009_pr01_new_commercial_catalogue_seed.sql) is ₹1,999 with
 * `tax_status = 'unconfigured'` — exactly the plan + exactly the 18% GST
 * math (1999 * 1.18 = 2358.82) the reported defect describes.
 *
 * This file is the pure, directly-testable arithmetic for the FIX —
 * mirrored 1:1 (see this file's own per-branch comments) by the proposed
 * migration this milestone ships for founder review at
 * `supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql`
 * (per this milestone's own instruction: a DB change ships as a
 * separately-identified, approval-required artifact, never auto-applied —
 * this sandbox never ran it against any database). Nothing in `src/` calls
 * this function at runtime today — `purchase_pricing_plan()` is Postgres,
 * not reachable from application TypeScript — but keeping the exact same
 * formula here, tested, gives a reviewer a fast, CI-checked way to confirm
 * the proposed SQL is arithmetically correct before approving it.
 *
 * `tax_exclusive`: unchanged from today's only-correct case — the
 * displayed price is pre-tax, so tax is added on top, same as before.
 *
 * `tax_inclusive`: back-calculated — the displayed price ALREADY includes
 * tax, so the student is never charged more than `amountMinorUnits`
 * (minus any discount). `taxMinorUnits` here is DISPLAY/ACCOUNTING
 * information only (how much of the already-charged amount is tax), never
 * an addition to the total.
 *
 * `unconfigured`: FOUNDER DECISION REQUIRED (see
 * NW01_PAYMENT_DECISIONS_AND_CONFIGURATION.md) — nothing in this
 * repository states whether an admin leaving a plan's tax status
 * unconfigured means "treat as tax-exclusive" or "treat as tax-inclusive"
 * once GST is live. This function picks the protective default — treat it
 * exactly like `tax_inclusive` (never charge more than the displayed
 * price) — because that is the only choice consistent with what this
 * product ALREADY tells the public on every pricing card
 * (`PricingTrustStrip.tsx`: "Every price shown is final — no hidden
 * fees.") and because "unconfigured" shows the student NO tax disclaimer
 * at all (unlike `tax_exclusive`'s explicit "tax will be added" warning),
 * so adding a surprise charge on top would contradict the page's own
 * copy. This is a deliberate, documented stopgap, not a resolved business
 * policy — every live, published plan should have an explicit
 * `tax_status` set before GST is actually turned on in production.
 */

import type { PricingTaxStatus } from "@/types/pricing";

export interface PlanPurchaseTaxInput {
  /** The plan version's own displayed price, before any discount. */
  amountMinorUnits: number;
  /** Already-computed discount (offer/coupon), never more than amountMinorUnits. */
  discountMinorUnits: number;
  taxStatus: PricingTaxStatus;
  /** null when GST is not configured at the business level at all — no tax applies regardless of taxStatus. */
  taxRateBps: number | null;
}

export interface PlanPurchaseTaxResult {
  taxMinorUnits: number;
  totalMinorUnits: number;
}

export function computePlanPurchaseTax(input: PlanPurchaseTaxInput): PlanPurchaseTaxResult {
  const taxableBase = Math.max(0, input.amountMinorUnits - input.discountMinorUnits);

  if (!input.taxRateBps || input.taxRateBps <= 0) {
    return { taxMinorUnits: 0, totalMinorUnits: taxableBase };
  }

  if (input.taxStatus === "tax_exclusive") {
    // Unchanged from today: tax is an ADDITION on top of the displayed price.
    const taxMinorUnits = Math.round((taxableBase * input.taxRateBps) / 10_000);
    return { taxMinorUnits, totalMinorUnits: taxableBase + taxMinorUnits };
  }

  // tax_inclusive, and unconfigured (protective default — see file
  // docblock): the displayed/taxable-base amount is the ceiling on what
  // the student is ever charged. Tax is backed OUT of it for display,
  // never added on top.
  // bps base is 10_000 (1800 = 18.00%); the inclusive back-calculation
  // divides by (10_000 + rate) instead of 10_000 — standard
  // amount-includes-tax algebra: base = incl / (1 + r) => tax = incl -
  // base = incl * r / (1 + r).
  const taxMinorUnits = Math.round((taxableBase * input.taxRateBps) / (10_000 + input.taxRateBps));
  return { taxMinorUnits, totalMinorUnits: taxableBase };
}
