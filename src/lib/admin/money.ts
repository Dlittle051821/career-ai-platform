/**
 * Money handling for the payments/courses modules. Every stored amount is
 * an integer in the currency's minor unit (paise for INR, cents for USD,
 * etc.) — see 0004_admin_system.sql's comment on public.payments for why.
 * This file is the only place minor-units <-> display-string conversion
 * happens; nowhere else in the admin system should do float arithmetic on
 * money.
 */

const MINOR_UNITS_PER_MAJOR: Record<string, number> = {
  INR: 100,
  USD: 100,
  GBP: 100,
  EUR: 100,
  AED: 100,
};

const DEFAULT_MINOR_UNITS_PER_MAJOR = 100;

function minorUnitsPerMajor(currency: string): number {
  return MINOR_UNITS_PER_MAJOR[currency.toUpperCase()] ?? DEFAULT_MINOR_UNITS_PER_MAJOR;
}

/** Formats an integer minor-units amount as a localized currency string, e.g. formatMoney(150000, "INR") -> "₹1,500.00". Website/UI use only — see formatMoneyForPdf() below for anywhere the string is drawn into a PDF. */
export function formatMoney(amountMinorUnits: number, currency: string): string {
  const perMajor = minorUnitsPerMajor(currency);
  const major = amountMinorUnits / perMajor;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency.toUpperCase() }).format(major);
  } catch {
    // Intl throws on an unrecognized currency code — fall back to a plain label rather than crashing a page render.
    return `${currency.toUpperCase()} ${major.toFixed(2)}`;
  }
}

/**
 * PDF-safe currency formatter — ASCII only, e.g. formatMoneyForPdf(150000,
 * "INR") -> "INR 1,500.00", formatMoneyForPdf(13000000, "INR") ->
 * "INR 1,30,000.00", formatMoneyForPdf(2500, "USD") -> "USD 25.00".
 *
 * Why this exists: pdf-lib's StandardFonts (Helvetica/HelveticaBold, via
 * the WinAnsi/Latin-1 encoding) cannot encode the Indian Rupee sign U+20B9
 * ("₹") that formatMoney()'s `style: "currency"` Intl formatting attaches
 * to INR amounts — drawing that string with PDFPage.drawText() throws
 * `WinAnsi cannot encode "₹" (0x20b9)` and 500s the request. Several other
 * ISO 4217 currency symbols (e.g. some East Asian and Middle Eastern
 * currencies) have the same problem for the same reason. This formatter
 * sidesteps it entirely by never emitting a currency symbol at all —
 * only the ISO 4217 code plus a plain-ASCII grouped decimal amount.
 *
 * Locale is fixed at "en-IN" (Milestone 10 — was "en-US" prior to the
 * NextWise Pricing & Offers feature) specifically so large INR amounts use
 * Indian digit grouping (lakh/crore, e.g. "1,30,000.00" for ₹1,30,000, not
 * "130,000.00") to match the pricing page and every other INR amount shown
 * to a student. Verified against every existing PDF fixture before this
 * change: every amount used in this project's tests is under ₹1,00,000,
 * where en-IN and en-US grouping are byte-identical, so this switch cannot
 * change previously-generated output for any amount already covered by a
 * test — see src/lib/admin/money.test.ts for the regression coverage of
 * both the identical small-amount case and the new large-amount (lakh)
 * case. Grouping (",") and decimal (".") punctuation stay guaranteed ASCII
 * under en-IN, same as they were under en-US — Indian digit grouping only
 * changes where the commas fall, never what characters are used.
 *
 * Use this — never formatMoney() — for every monetary value drawn into a
 * PDF (src/lib/payments/pdf.ts). Do not use it for website/UI text; it
 * exists purely to work around pdf-lib's WinAnsi-only text encoding, and
 * `₹1,500.00`-style symbol formatting remains correct and unaffected
 * everywhere else in the app.
 */
export function formatMoneyForPdf(amountMinorUnits: number, currency: string): string {
  const perMajor = minorUnitsPerMajor(currency);
  const major = amountMinorUnits / perMajor;
  const amount = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(major);
  return `${currency.toUpperCase()} ${amount}`;
}

/**
 * Parses a human-entered amount string (e.g. from a form field, "1500" or
 * "1,500.50") into integer minor units. Returns null for anything that
 * isn't a valid non-negative amount — callers must treat null as a
 * validation error, never coerce it to 0.
 */
export function parseMoneyInput(raw: string, currency: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned.length === 0) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const perMajor = minorUnitsPerMajor(currency);
  const major = Number.parseFloat(cleaned);
  if (!Number.isFinite(major) || major < 0) return null;

  // Round to avoid floating-point artifacts (e.g. 19.99 * 100 = 1998.9999...).
  return Math.round(major * perMajor);
}

/** Sums a list of minor-units amounts safely (plain integer addition — no float drift). */
export function sumMinorUnits(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
