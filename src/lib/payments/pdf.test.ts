import { existsSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateInvoicePdf, generateReceiptPdf } from "./pdf";
import { BRAND_NAME } from "@/config/site";
import type { BillingSettings, Invoice, InvoiceLineItem, PaymentTransaction } from "@/types/payments";

/**
 * Regression coverage for the "WinAnsi cannot encode "₹" (0x20b9)" bug:
 * pdf-lib's StandardFonts (WinAnsi/Latin-1 encoding) cannot draw the Indian
 * Rupee sign that formatMoney()'s locale currency formatting used to
 * attach to every INR amount, which 500'd every invoice/receipt PDF
 * download for an INR invoice — NextWise's only currently supported
 * currency (see src/lib/admin/money.ts's MINOR_UNITS_PER_MAJOR). The fix
 * (src/lib/admin/money.ts's formatMoneyForPdf(), used throughout
 * src/lib/payments/pdf.ts instead of formatMoney()) never emits a currency
 * symbol — only an ASCII ISO 4217 code — so these calls must resolve
 * without throwing.
 */

function lineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: "line-1",
    description: "Application fee",
    quantity: 1,
    unitAmountMinorUnits: 150000,
    discountMinorUnits: 0,
    taxRateBps: 1800,
    taxMinorUnits: 27000,
    lineTotalMinorUnits: 177000,
    sortOrder: 0,
    ...overrides,
  };
}

function inrInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    invoiceNumber: "INV-2026-00001",
    studentUserId: "student-1",
    studentName: "Asha Patel",
    studentEmail: "asha@example.com",
    applicationId: null,
    status: "partially_paid",
    currency: "INR",
    subtotalMinorUnits: 150000,
    discountMinorUnits: 5000,
    taxMinorUnits: 27000,
    totalMinorUnits: 172000,
    issueDate: "2026-01-15",
    dueDate: "2026-01-30",
    internalNotes: null,
    studentNotes: null,
    billingSnapshot: {
      studentName: "Asha Patel",
      studentEmail: "asha@example.com",
      legalEntityName: "NextWise Private Limited",
      businessAddress: "123 MG Road\nBengaluru, KA 560001",
      gstin: "29AAAAA0000A1Z5",
      gstRegisteredAtIssuance: true,
    },
    voidReason: null,
    issuedAt: "2026-01-15T00:00:00Z",
    paidAt: null,
    voidedAt: null,
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
    lineItems: [lineItem()],
    capturedTotalMinorUnits: 100000,
    refundedTotalMinorUnits: 10000,
    dueMinorUnits: 82000,
    ...overrides,
  };
}

function gstBillingSettings(overrides: Partial<BillingSettings> = {}): BillingSettings {
  return {
    legalEntityName: "NextWise Private Limited",
    businessAddress: "123 MG Road\nBengaluru, KA 560001",
    supportEmail: "billing@example.com",
    supportPhone: "+91 80 1234 5678",
    gstRegistered: true,
    gstin: "29AAAAA0000A1Z5",
    defaultTaxRateBps: 1800,
    invoiceFooterNote: "Thank you for your business.",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function capturedTransaction(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: "txn-1",
    paymentAttemptId: "attempt-1",
    providerPaymentId: "pay_ABC123",
    isManual: false,
    status: "captured",
    amountMinorUnits: 100000,
    amountRefundedMinorUnits: 0,
    currency: "INR",
    methodCategory: "upi",
    capturedAt: "2026-01-16T10:00:00Z",
    failureReason: null,
    createdAt: "2026-01-16T10:00:00Z",
    ...overrides,
  };
}

describe("generateInvoicePdf — INR encoding regression", () => {
  it("generates a full INR invoice PDF (with discount, tax, paid-to-date, refund, and amount-due rows) without throwing", async () => {
    const invoice = inrInvoice();
    const settings = gstBillingSettings();
    await expect(generateInvoicePdf(invoice, settings)).resolves.toBeInstanceOf(Uint8Array);
  });

  it("produces bytes that start with the PDF magic header, confirming a real document was written (not a swallowed error)", async () => {
    const bytes = await generateInvoicePdf(inrInvoice(), gstBillingSettings());
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("still succeeds for an INR invoice with no GST configured (plain 'Invoice' label path)", async () => {
    const invoice = inrInvoice({ billingSnapshot: null });
    await expect(generateInvoicePdf(invoice, null)).resolves.toBeInstanceOf(Uint8Array);
  });

  it("succeeds for a multi-line-item invoice with several distinct INR amounts", async () => {
    const invoice = inrInvoice({
      lineItems: [
        lineItem({ id: "line-1", description: "Application fee", unitAmountMinorUnits: 150000, lineTotalMinorUnits: 177000 }),
        lineItem({ id: "line-2", description: "Counselling session", unitAmountMinorUnits: 250000, taxRateBps: null, taxMinorUnits: 0, lineTotalMinorUnits: 250000 }),
      ],
    });
    await expect(generateInvoicePdf(invoice, gstBillingSettings())).resolves.toBeInstanceOf(Uint8Array);
  });

  it("succeeds for a fully paid, zero-due invoice (exercises the 'Amount due' row being skipped)", async () => {
    const invoice = inrInvoice({ status: "paid", capturedTotalMinorUnits: 172000, refundedTotalMinorUnits: 0, dueMinorUnits: 0 });
    await expect(generateInvoicePdf(invoice, gstBillingSettings())).resolves.toBeInstanceOf(Uint8Array);
  });

  // Milestone 10 — NextWise Pricing & Offers introduced lakh-scale prices
  // (Bachelor/Master Abroad Tier 3: ₹1,30,000 / ₹1,40,000) that did not
  // exist in any earlier fixture. formatMoneyForPdf's locale switch to
  // "en-IN" (src/lib/admin/money.ts) changes where the commas fall for
  // these amounts (Indian grouping: "1,30,000.00") — this only proves the
  // PDF still generates successfully with that formatting; the exact
  // string is covered by src/lib/admin/money.test.ts.
  it("succeeds for a plan-purchase invoice at the largest official NextWise plan price (Master Abroad Tier 3, INR 1,40,000)", async () => {
    const invoice = inrInvoice({
      subtotalMinorUnits: 14_000_000,
      discountMinorUnits: 0,
      taxMinorUnits: 0,
      totalMinorUnits: 14_000_000,
      capturedTotalMinorUnits: 0,
      refundedTotalMinorUnits: 0,
      dueMinorUnits: 14_000_000,
      status: "issued",
      lineItems: [
        lineItem({
          id: "line-1",
          description: "Master Abroad — Tier 3",
          unitAmountMinorUnits: 14_000_000,
          discountMinorUnits: 0,
          taxRateBps: null,
          taxMinorUnits: 0,
          lineTotalMinorUnits: 14_000_000,
        }),
      ],
    });
    const bytes = await generateInvoicePdf(invoice, gstBillingSettings());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});

describe("generateReceiptPdf — INR encoding regression", () => {
  it("generates an INR receipt PDF for a gateway-captured payment without throwing", async () => {
    const bytes = await generateReceiptPdf(inrInvoice(), capturedTransaction(), gstBillingSettings());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("generates an INR receipt PDF for a manually recorded (offline) payment without throwing", async () => {
    const txn = capturedTransaction({ isManual: true, providerPaymentId: null, methodCategory: null });
    await expect(generateReceiptPdf(inrInvoice(), txn, gstBillingSettings())).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("NextWise branding in generated PDFs", () => {
  it("ships the logo asset pdf.ts reads at the exact path it reads it from (public/brand/nextwise-icon.png)", () => {
    // pdf.ts resolves this relative to process.cwd() at request time — this
    // assertion catches the asset being renamed/moved without pdf.ts being
    // updated to match (or vice versa), which would otherwise fail silently
    // via the "missing logo" graceful-degradation path below.
    const logoPath = path.join(process.cwd(), "public", "brand", "nextwise-icon.png");
    expect(existsSync(logoPath)).toBe(true);
  });

  it("sets the PDF Producer metadata to the current brand name, not the old one", async () => {
    const bytes = await generateInvoicePdf(inrInvoice(), gstBillingSettings());
    // updateMetadata: false — PDFDocument.load() defaults to true, which
    // (per pdf-lib's own PDFDocument constructor) unconditionally
    // overwrites Producer/Creator with pdf-lib's own string on EVERY load,
    // including this read-back-to-verify one. Without this option the
    // assertion below would fail against pdf-lib's default, not against
    // what generateInvoicePdf() actually wrote (confirmed independently by
    // inspecting the raw saved bytes, where the /Producer hex string
    // decodes to "NextWise").
    const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(loaded.getProducer()).toBe(BRAND_NAME);
  });

  it("embeds an image (the logo) as an XObject on the invoice's first page", async () => {
    const bytes = await generateInvoicePdf(inrInvoice(), gstBillingSettings());
    const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
    const resources = loaded.getPage(0).node.Resources();
    const xObjects = resources?.lookup(loaded.context.obj("XObject"));
    expect(xObjects).toBeTruthy();
  });

  it("embeds an image (the logo) as an XObject on the receipt's first page", async () => {
    const bytes = await generateReceiptPdf(inrInvoice(), capturedTransaction(), gstBillingSettings());
    const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
    const resources = loaded.getPage(0).node.Resources();
    const xObjects = resources?.lookup(loaded.context.obj("XObject"));
    expect(xObjects).toBeTruthy();
  });

  // Note: pdf.ts's loadLogoBytes()/drawLogo() are not exported, and the
  // graceful-degradation path (a missing/unreadable logo file) is
  // deliberately not exercised here via a real missing-file simulation —
  // doing that would require mutating process.cwd() or module-cache state
  // shared across this whole (parallel) test run, which is worse than the
  // gap it would close. The guarantee itself is structural: both functions
  // wrap their only fallible operations (fs.readFile, doc.embedPng) in
  // try/catch that resolves to `null`/returns early rather than rethrowing
  // — see the docblock directly above loadLogoBytes() in pdf.ts.
});
