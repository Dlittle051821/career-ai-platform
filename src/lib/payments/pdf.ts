import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoneyForPdf } from "@/lib/admin/money";
import { isGstConfigured, invoiceDocumentLabel } from "./tax";
import type { BillingSettings, Invoice, PaymentTransaction } from "@/types/payments";

/**
 * Invoice/receipt PDF generation with pdf-lib (pure JS, no native deps, no
 * headless-browser dependency). Two documents: generateInvoicePdf (the
 * request for payment — always producible once an invoice is issued) and
 * generateReceiptPdf (proof of one specific captured payment — only
 * producible for a transaction that is genuinely `captured`, gateway or
 * offline).
 *
 * "Escaping all user content": every string that can contain admin/student
 * free text (descriptions, notes, names, addresses) goes through
 * sanitizeForPdf() before being drawn — pdf-lib's StandardFonts only
 * support the WinAnsi (Latin-1) subset, so any character outside that range
 * is replaced with a safe placeholder rather than throwing or being
 * silently mis-rendered. This is a real limitation for non-Latin names —
 * documented in docs/payments-billing-guide.md §10 — not a security
 * vulnerability (pdf-lib text drawing is never interpreted as markup, so
 * there is no injection risk the way there would be with HTML), but names
 * with characters outside Latin-1 will show '?' placeholders until a full
 * Unicode-embedded-font upgrade is made.
 *
 * GST HONESTY: this file calls invoiceDocumentLabel()/isGstConfigured() —
 * the SAME gate used everywhere else — and never prints a GSTIN, tax rate,
 * or "Tax Invoice" label unless billing_settings genuinely has GST
 * configured. See src/lib/payments/tax.ts.
 */

function sanitizeForPdf(input: string | null | undefined): string {
  if (!input) return "";
  // WinAnsi-safe subset: printable ASCII plus a handful of common Latin-1
  // punctuation pdf-lib's Helvetica/HelveticaBold encode correctly. Anything
  // else becomes '?' rather than crashing PDFPage.drawText().
  return Array.from(input)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 0x0a || code === 0x0d) return " ";
      if (code >= 0x20 && code <= 0x7e) return ch;
      if (code >= 0xa0 && code <= 0xff) return ch;
      return "?";
    })
    .join("")
    .trim();
}

interface DocContext {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
}

const PAGE_MARGIN = 50;

async function newContext(): Promise<DocContext> {
  const doc = await PDFDocument.create();
  doc.setTitle("Invoice");
  doc.setProducer("CareerPath AI");
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, page, font, bold, y: 841.89 - PAGE_MARGIN, pageWidth: 595.28, pageHeight: 841.89, margin: PAGE_MARGIN };
}

function ensureSpace(ctx: DocContext, needed: number): void {
  if (ctx.y - needed < ctx.margin) {
    ctx.page = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
    ctx.y = ctx.pageHeight - ctx.margin;
  }
}

function text(ctx: DocContext, raw: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number; gap?: number } = {}): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.bold : ctx.font;
  const gap = opts.gap ?? size + 4;
  ensureSpace(ctx, gap);
  ctx.page.drawText(sanitizeForPdf(raw), {
    x: opts.x ?? ctx.margin,
    y: ctx.y,
    size,
    font,
    color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.1),
  });
  ctx.y -= gap;
}

function hr(ctx: DocContext): void {
  ensureSpace(ctx, 10);
  ctx.page.drawLine({
    start: { x: ctx.margin, y: ctx.y },
    end: { x: ctx.pageWidth - ctx.margin, y: ctx.y },
    thickness: 0.75,
    color: rgb(0.8, 0.8, 0.8),
  });
  ctx.y -= 12;
}

function statusLabel(invoice: Invoice): string {
  switch (invoice.status) {
    case "paid":
      return "PAID";
    case "partially_paid":
      return "PARTIALLY PAID";
    case "overdue":
      return "OVERDUE";
    case "void":
      return "VOID";
    case "refunded":
      return "REFUNDED";
    case "partially_refunded":
      return "PARTIALLY REFUNDED";
    default:
      return "PAYMENT DUE";
  }
}

function drawHeader(ctx: DocContext, docLabel: string, settings: BillingSettings | null): void {
  text(ctx, docLabel.toUpperCase(), { size: 20, bold: true, gap: 26 });
  if (settings?.legalEntityName) text(ctx, settings.legalEntityName, { bold: true, size: 11 });
  if (settings?.businessAddress) {
    for (const line of settings.businessAddress.split("\n")) text(ctx, line, { size: 9, color: [0.35, 0.35, 0.35] });
  }
  if (settings?.supportEmail || settings?.supportPhone) {
    text(ctx, [settings.supportEmail, settings.supportPhone].filter(Boolean).join("  |  "), { size: 9, color: [0.35, 0.35, 0.35] });
  }
  if (isGstConfigured(settings) && settings?.gstin) {
    text(ctx, `GSTIN: ${settings.gstin}`, { size: 9, color: [0.35, 0.35, 0.35] });
  }
  ctx.y -= 6;
  hr(ctx);
}

function drawBillTo(ctx: DocContext, invoice: Invoice): void {
  text(ctx, "Bill To", { bold: true, size: 10 });
  const snapshot = invoice.billingSnapshot;
  const name = snapshot?.studentName ?? invoice.studentName ?? "Student";
  text(ctx, name, { size: 10 });
  const email = snapshot?.studentEmail ?? invoice.studentEmail;
  if (email) text(ctx, email, { size: 9, color: [0.35, 0.35, 0.35] });
  ctx.y -= 4;
}

function drawMeta(ctx: DocContext, invoice: Invoice): void {
  const rightX = ctx.pageWidth - ctx.margin - 200;
  const startY = ctx.y + (invoice.billingSnapshot?.studentEmail || invoice.studentEmail ? 3 * 14 : 2 * 14) + 10;
  let y = startY;
  const line = (label: string, value: string) => {
    ctx.page.drawText(sanitizeForPdf(label), { x: rightX, y, size: 9, font: ctx.bold, color: rgb(0.3, 0.3, 0.3) });
    ctx.page.drawText(sanitizeForPdf(value), { x: rightX + 90, y, size: 9, font: ctx.font, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  };
  line("Invoice #:", invoice.invoiceNumber ?? "DRAFT");
  line("Issue date:", invoice.issueDate ?? "-");
  line("Due date:", invoice.dueDate ?? "-");
  line("Status:", statusLabel(invoice));
}

function drawLineItemsTable(ctx: DocContext, invoice: Invoice): void {
  ensureSpace(ctx, 20);
  const colX = { desc: ctx.margin, qty: ctx.margin + 260, unit: ctx.margin + 320, tax: ctx.margin + 400, total: ctx.pageWidth - ctx.margin - 70 };
  text(ctx, "", { gap: 4 });
  ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - 4, width: ctx.pageWidth - 2 * ctx.margin, height: 18, color: rgb(0.94, 0.94, 0.96) });
  const headerY = ctx.y;
  const drawHeaderCell = (x: number, label: string) => ctx.page.drawText(label, { x, y: headerY, size: 8.5, font: ctx.bold, color: rgb(0.25, 0.25, 0.25) });
  drawHeaderCell(colX.desc + 4, "DESCRIPTION");
  drawHeaderCell(colX.qty, "QTY");
  drawHeaderCell(colX.unit, "UNIT");
  drawHeaderCell(colX.tax, "TAX");
  drawHeaderCell(colX.total, "TOTAL");
  ctx.y -= 20;

  for (const item of invoice.lineItems) {
    ensureSpace(ctx, 16);
    const rowY = ctx.y;
    ctx.page.drawText(sanitizeForPdf(item.description).slice(0, 60), { x: colX.desc + 4, y: rowY, size: 9, font: ctx.font });
    ctx.page.drawText(String(item.quantity), { x: colX.qty, y: rowY, size: 9, font: ctx.font });
    ctx.page.drawText(formatMoneyForPdf(item.unitAmountMinorUnits, invoice.currency), { x: colX.unit, y: rowY, size: 9, font: ctx.font });
    ctx.page.drawText(item.taxRateBps ? `${(item.taxRateBps / 100).toFixed(2)}%` : "-", { x: colX.tax, y: rowY, size: 9, font: ctx.font });
    ctx.page.drawText(formatMoneyForPdf(item.lineTotalMinorUnits, invoice.currency), { x: colX.total, y: rowY, size: 9, font: ctx.font });
    ctx.y -= 16;
  }
  ctx.y -= 6;
  hr(ctx);
}

function drawTotals(ctx: DocContext, invoice: Invoice): void {
  const labelX = ctx.pageWidth - ctx.margin - 200;
  const valueX = ctx.pageWidth - ctx.margin - 70;
  const row = (label: string, value: string, opts: { bold?: boolean } = {}) => {
    ensureSpace(ctx, 16);
    ctx.page.drawText(label, { x: labelX, y: ctx.y, size: 9.5, font: opts.bold ? ctx.bold : ctx.font, color: rgb(0.2, 0.2, 0.2) });
    ctx.page.drawText(value, { x: valueX, y: ctx.y, size: 9.5, font: opts.bold ? ctx.bold : ctx.font, color: rgb(0.1, 0.1, 0.1) });
    ctx.y -= 16;
  };
  row("Subtotal", formatMoneyForPdf(invoice.subtotalMinorUnits, invoice.currency));
  if (invoice.discountMinorUnits > 0) row("Discount", `-${formatMoneyForPdf(invoice.discountMinorUnits, invoice.currency)}`);
  if (invoice.taxMinorUnits > 0) row("Tax", formatMoneyForPdf(invoice.taxMinorUnits, invoice.currency));
  row("Total", formatMoneyForPdf(invoice.totalMinorUnits, invoice.currency), { bold: true });
  if (invoice.capturedTotalMinorUnits > 0) row("Paid to date", formatMoneyForPdf(invoice.capturedTotalMinorUnits, invoice.currency));
  if (invoice.refundedTotalMinorUnits > 0) row("Refunded", formatMoneyForPdf(invoice.refundedTotalMinorUnits, invoice.currency));
  if (invoice.dueMinorUnits > 0 && invoice.status !== "void") row("Amount due", formatMoneyForPdf(invoice.dueMinorUnits, invoice.currency), { bold: true });
}

function drawFooter(ctx: DocContext, settings: BillingSettings | null, gstConfigured: boolean): void {
  ctx.y -= 10;
  hr(ctx);
  if (settings?.invoiceFooterNote) {
    for (const line of settings.invoiceFooterNote.split("\n")) text(ctx, line, { size: 8.5, color: [0.4, 0.4, 0.4] });
  }
  if (!gstConfigured) {
    ctx.y -= 4;
    text(ctx, "This is not a GST tax invoice. Tax registration details have not been configured.", { size: 8, color: [0.55, 0.35, 0.1] });
  }
  text(ctx, "Generated by CareerPath AI. This document reflects records held in our system at the time of generation.", { size: 7.5, color: [0.55, 0.55, 0.55] });
}

/** Builds the full invoice PDF (a request for payment) as bytes. */
export async function generateInvoicePdf(invoice: Invoice, settings: BillingSettings | null): Promise<Uint8Array> {
  const ctx = await newContext();
  const gstConfigured = isGstConfigured(settings);
  const docLabel = invoiceDocumentLabel(settings);
  ctx.doc.setTitle(`${docLabel} ${invoice.invoiceNumber ?? invoice.id}`);

  drawHeader(ctx, docLabel, settings);
  drawBillTo(ctx, invoice);
  drawMeta(ctx, invoice);
  ctx.y -= 10;
  drawLineItemsTable(ctx, invoice);
  drawTotals(ctx, invoice);
  drawFooter(ctx, settings, gstConfigured);

  return ctx.doc.save();
}

/** Builds a receipt PDF for one specific CAPTURED payment (gateway-verified or offline) against an invoice. Callers must verify transaction.status === "captured" (or a refund-adjusted state) before calling this — a receipt is never generated for an unverified/pending payment. */
export async function generateReceiptPdf(invoice: Invoice, transaction: PaymentTransaction, settings: BillingSettings | null): Promise<Uint8Array> {
  const ctx = await newContext();
  ctx.doc.setTitle(`Receipt for ${invoice.invoiceNumber ?? invoice.id}`);

  text(ctx, "PAYMENT RECEIPT", { size: 20, bold: true, gap: 26 });
  if (settings?.legalEntityName) text(ctx, settings.legalEntityName, { bold: true, size: 11 });
  if (settings?.businessAddress) {
    for (const line of settings.businessAddress.split("\n")) text(ctx, line, { size: 9, color: [0.35, 0.35, 0.35] });
  }
  ctx.y -= 6;
  hr(ctx);

  drawBillTo(ctx, invoice);
  ctx.y -= 6;

  text(ctx, `Invoice: ${invoice.invoiceNumber ?? invoice.id}`, { size: 10 });
  text(ctx, `Amount paid: ${formatMoneyForPdf(transaction.amountMinorUnits, transaction.currency)}`, { size: 12, bold: true });
  text(ctx, `Payment date: ${transaction.capturedAt ? new Date(transaction.capturedAt).toISOString().slice(0, 10) : "-"}`, { size: 9.5 });
  text(ctx, `Payment method: ${transaction.isManual ? "Recorded manually (offline)" : (transaction.methodCategory ?? "Online payment via Razorpay")}`, { size: 9.5 });
  if (!transaction.isManual && transaction.providerPaymentId) {
    text(ctx, `Gateway reference: ${transaction.providerPaymentId}`, { size: 8.5, color: [0.4, 0.4, 0.4] });
  }
  if (transaction.isManual) {
    ctx.y -= 4;
    text(ctx, "This payment was recorded manually by an administrator and was not processed through the online payment gateway.", { size: 8, color: [0.55, 0.35, 0.1] });
  }

  drawFooter(ctx, settings, isGstConfigured(settings));

  return ctx.doc.save();
}
