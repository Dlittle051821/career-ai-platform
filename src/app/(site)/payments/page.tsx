import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Download } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listMyInvoices } from "@/lib/supabase/payments/student-invoices";
import { formatMoney } from "@/lib/admin/money";
import { INVOICE_STATUS_LABELS, PAYABLE_INVOICE_STATUSES } from "@/types/payments";

export const metadata: Metadata = { title: "Payments" };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
  issued: "info",
  overdue: "warning",
  partially_paid: "warning",
  paid: "success",
  void: "neutral",
  refunded: "neutral",
  partially_refunded: "warning",
};

export default async function PaymentsPage() {
  const invoices = await listMyInvoices();

  return (
    <>
      <PageHero
        eyebrow="Your account"
        title="Payments"
        description="Invoices issued to you, their payment status, and downloadable receipts. A status only ever shows as paid once a payment has been genuinely verified — never just because a checkout window closed."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments" }]}
      />
      <Section>
        {invoices.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14 text-center">
            <Receipt aria-hidden="true" className="h-9 w-9 text-muted" />
            <h2 className="text-base font-semibold text-primary">No invoices yet</h2>
            <p className="max-w-sm text-sm text-muted">Any invoice issued to you will appear here.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {invoices.map((inv) => (
              <Card key={inv.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/payments/${inv.id}`} className="text-base font-semibold text-primary hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatMoney(inv.totalMinorUnits, inv.currency)}
                    {inv.dueDate ? ` · Due ${new Date(inv.dueDate).toLocaleDateString("en-IN")}` : ""}
                  </p>
                  {PAYABLE_INVOICE_STATUSES.includes(inv.status) && inv.dueMinorUnits > 0 ? (
                    <p className="mt-1 text-sm font-medium text-warning">{formatMoney(inv.dueMinorUnits, inv.currency)} due</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <a href={`/payments/${inv.id}/pdf`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                    <Download aria-hidden="true" className="h-4 w-4" />
                    PDF
                  </a>
                  <Link href={`/payments/${inv.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    View
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
