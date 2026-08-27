import { describe, expect, it } from "vitest";
import { generateInvoicePdf, generateReceiptPdf } from "./pdf";
import type { BillingSettings, Invoice, InvoiceLineItem, PaymentTransaction } from "@/types/payments";

/**
 * Regression coverage for the "WinAnsi cannot encode "₹" (0x20b9)" bug:
 * pdf-lib's StandardFonts (WinAnsi/Latin-1 encoding) cannot draw the Indian
 * Rupee sign that formatMoney()'s locale currency formatting used to
 * attach to every INR amount, which 500'd every invoice/receipt PDF
 * download for an INR invoice — CareerPath AI's only currently supported
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
      legalEntityName: "CareerPath AI Private Limited",
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
    legalEntityName: "CareerPath AI Private Limited",
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
