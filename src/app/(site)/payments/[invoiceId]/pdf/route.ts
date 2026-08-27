import { NextResponse } from "next/server";
import { getMyInvoiceById } from "@/lib/supabase/payments/student-invoices";
import { getBillingSettingsForDocument } from "@/lib/supabase/admin/billing-settings";
import { generateInvoicePdf } from "@/lib/payments/pdf";

/** Student's own invoice PDF download — getMyInvoiceById scopes to the signed-in student's own invoices (backed by RLS); no other authorization needed here. */
export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<NextResponse> {
  const { invoiceId } = await params;
  const invoice = await getMyInvoiceById(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const settings = await getBillingSettingsForDocument();
  const bytes = await generateInvoicePdf(invoice, settings);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber ?? invoice.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
