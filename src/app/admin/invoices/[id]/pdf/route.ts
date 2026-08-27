import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/supabase/admin/invoices";
import { getBillingSettingsForDocument } from "@/lib/supabase/admin/billing-settings";
import { generateInvoicePdf } from "@/lib/payments/pdf";
import { AdminAuthorizationError } from "@/lib/supabase/admin-auth";

/** Admin invoice PDF download. Permission-gated inside getInvoiceById (invoices:read) — this route has no separate check of its own, matching the rest of this module's "data access is the boundary" convention. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;

  let invoice;
  try {
    invoice = await getInvoiceById(id);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (invoice.status === "draft") return NextResponse.json({ error: "A draft invoice has no PDF yet — issue it first." }, { status: 400 });

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
