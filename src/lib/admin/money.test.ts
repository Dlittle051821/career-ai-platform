import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyForPdf, parseMoneyInput, sumMinorUnits } from "./money";

describe("formatMoney", () => {
  it("formats INR minor units (paise) as rupees", () => {
    expect(formatMoney(150000, "INR")).toContain("1,500");
  });

  it("formats zero without throwing", () => {
    expect(formatMoney(0, "INR")).toContain("0");
  });

  it("falls back to a plain label for an unrecognized currency code instead of throwing", () => {
    expect(() => formatMoney(100, "XXX")).not.toThrow();
  });
});

describe("formatMoneyForPdf", () => {
  it("formats INR minor units (paise) using the ISO code, never the rupee sign", () => {
    expect(formatMoneyForPdf(150000, "INR")).toBe("INR 1,500.00");
  });

  it("formats USD minor units (cents) using the ISO code", () => {
    expect(formatMoneyForPdf(2500, "USD")).toBe("USD 25.00");
  });

  it("formats EUR minor units using the ISO code", () => {
    expect(formatMoneyForPdf(10000, "EUR")).toBe("EUR 100.00");
  });

  it("never contains the rupee sign (U+20B9) or any other non-ASCII character, for any supported currency", () => {
    for (const currency of ["INR", "USD", "GBP", "EUR", "AED"]) {
      const result = formatMoneyForPdf(123456, currency);
      expect(result).toMatch(/^[\x20-\x7e]+$/);
      expect(result).not.toContain("₹");
    }
  });

  // Milestone 10 (NextWise Pricing & Offers) — formatMoneyForPdf's locale
  // moved from "en-US" to "en-IN" specifically so lakh-scale plan prices
  // (Bachelor/Master Abroad Tier 3: ₹1,30,000 / ₹1,40,000) render with
  // Indian digit grouping in generated PDFs, matching every other INR
  // amount shown to a student. This must never regress back to "130,000.00".
  it("uses Indian digit grouping for a lakh-scale amount (Bachelor Abroad Tier 3: ₹1,30,000)", () => {
    expect(formatMoneyForPdf(13_000_000, "INR")).toBe("INR 1,30,000.00");
  });

  it("uses Indian digit grouping for a lakh-scale amount (Master Abroad Tier 3: ₹1,40,000)", () => {
    expect(formatMoneyForPdf(14_000_000, "INR")).toBe("INR 1,40,000.00");
  });

  it("stays ASCII-only for every official NextWise plan price, including lakh-scale amounts", () => {
    const officialPlanAmountsMinorUnits = [500_000, 1_000_000, 1_500_000, 2_500_000, 6_000_000, 13_000_000, 2_700_000, 6_500_000, 14_000_000];
    for (const amount of officialPlanAmountsMinorUnits) {
      const result = formatMoneyForPdf(amount, "INR");
      expect(result).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it("is unchanged from before the en-IN locale switch for any amount under one lakh (both locales group identically there)", () => {
    // Regression guard for the switch itself: every pre-existing PDF
    // fixture in this project uses amounts under ₹1,00,000, where en-IN and
    // en-US grouping are byte-identical — see src/lib/admin/money.ts's
    // formatMoneyForPdf docblock. This pins that specific invariant.
    expect(formatMoneyForPdf(150000, "INR")).toBe("INR 1,500.00");
    expect(formatMoneyForPdf(9_999_900, "INR")).toBe("INR 99,999.00");
  });

  it("lowercases the currency code up to uppercase, matching the format of the worked examples", () => {
    expect(formatMoneyForPdf(150000, "inr")).toBe("INR 1,500.00");
  });

  it("formats zero without throwing", () => {
    expect(formatMoneyForPdf(0, "INR")).toBe("INR 0.00");
  });

  it("never throws for an unrecognized currency code (falls back to the default minor-unit scale, ISO code echoed as given)", () => {
    expect(() => formatMoneyForPdf(100, "XXX")).not.toThrow();
    expect(formatMoneyForPdf(100, "XXX")).toBe("XXX 1.00");
  });
});

describe("parseMoneyInput", () => {
  it("parses a plain integer amount into minor units", () => {
    expect(parseMoneyInput("1500", "INR")).toBe(150000);
  });

  it("parses a decimal amount into minor units", () => {
    expect(parseMoneyInput("19.99", "INR")).toBe(1999);
  });

  it("accepts thousands separators", () => {
    expect(parseMoneyInput("1,500.50", "INR")).toBe(150050);
  });

  it("rejects a negative amount", () => {
    expect(parseMoneyInput("-100", "INR")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseMoneyInput("abc", "INR")).toBeNull();
  });

  it("rejects an empty string rather than defaulting to 0", () => {
    expect(parseMoneyInput("", "INR")).toBeNull();
    expect(parseMoneyInput("   ", "INR")).toBeNull();
  });

  it("rejects more than two decimal places", () => {
    expect(parseMoneyInput("10.999", "INR")).toBeNull();
  });

  it("never produces floating-point drift for a value like 19.99", () => {
    // The classic float trap: 19.99 * 100 in naive JS float math can land on 1998.9999999999998.
    expect(parseMoneyInput("19.99", "INR")).toBe(1999);
    expect(Number.isInteger(parseMoneyInput("19.99", "INR"))).toBe(true);
  });
});

describe("sumMinorUnits", () => {
  it("sums an empty list to 0", () => {
    expect(sumMinorUnits([])).toBe(0);
  });

  it("sums several amounts exactly", () => {
    expect(sumMinorUnits([100, 250, 999])).toBe(1349);
  });
});
