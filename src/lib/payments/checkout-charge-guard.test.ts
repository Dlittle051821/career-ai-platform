import { describe, expect, it } from "vitest";
import {
  NEXTWISE_VERIFIED,
  inclusiveTaxShare,
  validateCheckoutCharge,
  type ChargeInput,
  type ChargePurchase,
} from "./checkout-charge-guard";

const PRICE = 199_900;
const GST = 1_800;
const INCLUSIVE_GST = inclusiveTaxShare(PRICE, GST);

function verifiedPurchase(overrides: Partial<ChargePurchase> = {}): ChargePurchase {
  return {
    planSlug: "nextwise-verified",
    planNameAtPurchase: "Nextwise Verified",
    originalMinorUnits: PRICE,
    discountMinorUnits: 0,
    taxMinorUnits: 0,
    finalMinorUnits: PRICE,
    currency: "INR",
    versionTaxStatus: "tax_inclusive",
    ...overrides,
  };
}

/** A consistent invoice + line built from the purchase record, as purchase_pricing_plan() writes it. */
function chargeFor(purchase: ChargePurchase, lineRate: number | null = null, overrides: Partial<ChargeInput> = {}): ChargeInput {
  return {
    invoice: {
      currency: purchase.currency,
      subtotalMinorUnits: purchase.originalMinorUnits,
      discountMinorUnits: purchase.discountMinorUnits,
      taxMinorUnits: purchase.taxMinorUnits,
      totalMinorUnits: purchase.finalMinorUnits,
    },
    lineItems: [{ taxRateBps: lineRate, taxMinorUnits: purchase.taxMinorUnits, lineTotalMinorUnits: purchase.finalMinorUnits }],
    purchase,
    chargeMinorUnits: purchase.finalMinorUnits,
    ...overrides,
  };
}

describe("Nextwise Verified: exactly ₹1,999 inclusive of applicable GST", () => {
  it("defines the product price as 199,900 paise in INR", () => {
    expect(NEXTWISE_VERIFIED).toMatchObject({ slug: "nextwise-verified", payableMinorUnits: 199_900, currency: "INR" });
  });

  it("accepts ₹1,999 when GST is not configured (no tax line)", () => {
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase()))).toEqual({ ok: true });
  });

  it("accepts ₹1,999 with 18% GST backed out of the price (₹304.93 of the ₹1,999)", () => {
    expect(INCLUSIVE_GST).toBe(30_493);
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase({ taxMinorUnits: INCLUSIVE_GST }), GST))).toEqual({ ok: true });
  });

  it("blocks the known defect: 18% GST added on top (₹2,358.82)", () => {
    const tax = Math.round((PRICE * GST) / 10_000);
    const purchase = verifiedPurchase({ taxMinorUnits: tax, finalMinorUnits: PRICE + tax, versionTaxStatus: "unconfigured" });
    expect(PRICE + tax).toBe(235_882);
    expect(validateCheckoutCharge(chargeFor(purchase, GST))).toEqual({ ok: false, reason: "verified_price_mismatch" });
  });

  it("blocks GST added on top even when the version is marked tax-exclusive", () => {
    const tax = Math.round((PRICE * GST) / 10_000);
    const purchase = verifiedPurchase({ taxMinorUnits: tax, finalMinorUnits: PRICE + tax, versionTaxStatus: "tax_exclusive" });
    expect(validateCheckoutCharge(chargeFor(purchase, GST)).ok).toBe(false);
  });

  it("blocks a tax-exclusive configuration for Verified even at the right total", () => {
    const purchase = verifiedPurchase({ versionTaxStatus: "tax_exclusive" });
    expect(validateCheckoutCharge(chargeFor(purchase))).toEqual({ ok: false, reason: "invalid_tax_configuration" });
  });

  it.each([
    ["a different list price", { originalMinorUnits: 249_900, finalMinorUnits: 249_900 }],
    ["a discount", { discountMinorUnits: 10_000, finalMinorUnits: 189_900 }],
    ["a non-INR currency", { currency: "USD" }],
    ["one paisa too much", { originalMinorUnits: PRICE + 1, finalMinorUnits: PRICE + 1 }],
    ["one paisa too little", { originalMinorUnits: PRICE - 1, finalMinorUnits: PRICE - 1 }],
  ] as const)("blocks %s", (_label, overrides) => {
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase(overrides)))).toEqual({ ok: false, reason: "verified_price_mismatch" });
  });

  it("identifies Verified by the frozen plan name when the plan row is unreadable", () => {
    const purchase = verifiedPurchase({ planSlug: null, originalMinorUnits: 235_882, finalMinorUnits: 235_882 });
    expect(validateCheckoutCharge(chargeFor(purchase))).toEqual({ ok: false, reason: "verified_price_mismatch" });
  });

  it.each([
    ["the wrong GST share", { taxMinorUnits: 30_000 }, GST],
    ["a GST share with no rate on the line", { taxMinorUnits: INCLUSIVE_GST }, null],
    ["a GST share at a different rate", { taxMinorUnits: INCLUSIVE_GST }, 1_200],
  ] as const)("blocks %s", (_label, overrides, rate) => {
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase(overrides), rate))).toEqual({ ok: false, reason: "invalid_tax_configuration" });
  });

  it("blocks a partial or split charge of the Verified invoice", () => {
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase(), null, { chargeMinorUnits: 1_000 }))).toEqual({ ok: false, reason: "verified_price_mismatch" });
  });

  it("blocks a plan purchase whose plan cannot be identified", () => {
    const purchase = verifiedPurchase({ planSlug: null, planNameAtPurchase: "Renamed plan", originalMinorUnits: 99_900, finalMinorUnits: 99_900 });
    expect(validateCheckoutCharge(chargeFor(purchase))).toEqual({ ok: false, reason: "missing_configuration" });
  });

  it("blocks invalid line tax rates", () => {
    const input = chargeFor(verifiedPurchase({ taxMinorUnits: INCLUSIVE_GST }), GST);
    input.lineItems = [{ taxRateBps: 0, taxMinorUnits: INCLUSIVE_GST, lineTotalMinorUnits: PRICE }];
    expect(validateCheckoutCharge(input)).toEqual({ ok: false, reason: "invalid_tax_configuration" });
  });
});

describe("missing configuration and failed lookups fail closed", () => {
  it.each([
    ["no invoice", { invoice: null }],
    ["unreadable line items", { lineItems: null }],
    ["a failed purchase lookup", { purchase: undefined }],
  ] as const)("blocks %s", (_label, overrides) => {
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase(), null, overrides))).toEqual({ ok: false, reason: "missing_configuration" });
  });

  it("blocks an invoice with no line items", () => {
    expect(validateCheckoutCharge(chargeFor(verifiedPurchase(), null, { lineItems: [] }))).toEqual({ ok: false, reason: "line_items_mismatch" });
  });

  it("blocks tax added on top of a non-Verified plan whose tax status cannot be read", () => {
    const base = 2_499_900, tax = Math.round((base * GST) / 10_000);
    const purchase = verifiedPurchase({ planSlug: "nextwise-essential", planNameAtPurchase: "Nextwise Essential", originalMinorUnits: base, taxMinorUnits: tax, finalMinorUnits: base + tax, versionTaxStatus: null });
    expect(validateCheckoutCharge(chargeFor(purchase, GST))).toEqual({ ok: false, reason: "invalid_tax_configuration" });
  });

  it("blocks tax added on top of a plan left 'unconfigured'", () => {
    const base = 2_499_900, tax = Math.round((base * GST) / 10_000);
    const purchase = verifiedPurchase({ planSlug: "nextwise-essential", planNameAtPurchase: "Nextwise Essential", originalMinorUnits: base, taxMinorUnits: tax, finalMinorUnits: base + tax, versionTaxStatus: "unconfigured" });
    expect(validateCheckoutCharge(chargeFor(purchase, GST))).toEqual({ ok: false, reason: "invalid_tax_configuration" });
  });

  it("allows tax on top only for an explicitly tax-exclusive plan at the line's rate", () => {
    const base = 2_499_900, tax = Math.round((base * GST) / 10_000);
    const purchase = verifiedPurchase({ planSlug: "nextwise-essential", planNameAtPurchase: "Nextwise Essential", originalMinorUnits: base, taxMinorUnits: tax, finalMinorUnits: base + tax, versionTaxStatus: "tax_exclusive" });
    expect(validateCheckoutCharge(chargeFor(purchase, GST))).toEqual({ ok: true });
    expect(validateCheckoutCharge(chargeFor({ ...purchase, taxMinorUnits: tax + 1, finalMinorUnits: base + tax + 1 }, GST)).ok).toBe(false);
  });
});

describe("invalid totals and amounts", () => {
  it("blocks an invoice whose lines do not add up to its total", () => {
    const input = chargeFor(verifiedPurchase());
    input.lineItems = [{ taxRateBps: null, taxMinorUnits: 0, lineTotalMinorUnits: PRICE - 100 }];
    expect(validateCheckoutCharge(input)).toEqual({ ok: false, reason: "line_items_mismatch" });
  });

  it("blocks an invoice that disagrees with its frozen purchase record", () => {
    const input = chargeFor(verifiedPurchase());
    if (!input.invoice) throw new Error("fixture");
    input.invoice = { ...input.invoice, totalMinorUnits: 235_882 };
    input.lineItems = [{ taxRateBps: null, taxMinorUnits: 0, lineTotalMinorUnits: 235_882 }];
    input.chargeMinorUnits = 235_882;
    expect(validateCheckoutCharge(input)).toEqual({ ok: false, reason: "verified_price_mismatch" });
  });

  it.each([
    ["zero", 0],
    ["more than the invoice total", PRICE + 1],
    ["negative", -1],
    ["fractional", 1999.5],
    ["not a number", Number.NaN],
  ])("blocks a charge amount that is %s", (_label, charge) => {
    const result = validateCheckoutCharge(chargeFor(verifiedPurchase(), null, { chargeMinorUnits: charge }));
    expect(result.ok).toBe(false);
  });

  it("blocks malformed currency codes", () => {
    const input = chargeFor(verifiedPurchase());
    if (!input.invoice) throw new Error("fixture");
    input.invoice = { ...input.invoice, currency: "inr" };
    expect(validateCheckoutCharge(input)).toEqual({ ok: false, reason: "unsupported_currency" });
  });

  it("still validates ordinary (non-plan) invoices for internal consistency", () => {
    const ok: ChargeInput = {
      invoice: { currency: "INR", subtotalMinorUnits: 100_000, discountMinorUnits: 0, taxMinorUnits: 18_000, totalMinorUnits: 118_000 },
      lineItems: [{ taxRateBps: GST, taxMinorUnits: 18_000, lineTotalMinorUnits: 118_000 }],
      purchase: null,
      chargeMinorUnits: 118_000,
    };
    expect(validateCheckoutCharge(ok)).toEqual({ ok: true });
    expect(validateCheckoutCharge({ ...ok, chargeMinorUnits: 50_000 })).toEqual({ ok: true }); // partial payment of the remainder
    expect(validateCheckoutCharge({ ...ok, lineItems: [{ taxRateBps: GST, taxMinorUnits: 18_000, lineTotalMinorUnits: 117_000 }] }).ok).toBe(false);
  });
});
