import { NextResponse } from "next/server";
import { getMyInvoiceById, getMyPaymentTransaction } from "@/lib/supabase/payments/student-invoices";
import { getBillingSettingsForDocument } from "@/lib/supabase/admin/billing-settings";
import { generateReceiptPdf } from "@/lib/payments/pdf";

/** Student's own receipt PDF download for one captured payment on one of their own invoices. */
export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string; transactionId: string }> }): Promise<NextResponse> {
  const { invoiceId, transactionId } = await params;
  const [invoice, transaction] = await Promise.all([getMyInvoiceById(invoiceId), getMyPaymentTransaction(invoiceId, transactionId)]);
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (!transaction) return NextResponse.json({ error: "Payment not found on this invoice." }, { status: 404 });
  if (transaction.status !== "captured" && transaction.status !== "refunded" && transaction.status !== "partially_refunded") {
    return NextResponse.json({ error: "A receipt is only available for a captured payment." }, { status: 400 });
  }

  const settings = await getBillingSettingsForDocument();
  const bytes = await generateReceiptPdf(invoice, transaction, settings);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${invoice.invoiceNumber ?? invoice.id}-${transactionId.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
