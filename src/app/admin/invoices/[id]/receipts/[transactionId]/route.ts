import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/supabase/admin/invoices";
import { getInvoicePaymentTransaction } from "@/lib/supabase/admin/payment-attempts";
import { getBillingSettingsForDocument } from "@/lib/supabase/admin/billing-settings";
import { generateReceiptPdf } from "@/lib/payments/pdf";
import { AdminAuthorizationError } from "@/lib/supabase/admin-auth";

/** Admin receipt PDF download for one specific captured payment_transaction. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; transactionId: string }> }): Promise<NextResponse> {
  const { id, transactionId } = await params;

  let invoice;
  let transaction;
  try {
    [invoice, transaction] = await Promise.all([getInvoiceById(id), getInvoicePaymentTransaction(id, transactionId)]);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
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
