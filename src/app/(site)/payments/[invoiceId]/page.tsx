import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PayButton } from "@/components/payments/PayButton";
import { getMyInvoiceById } from "@/lib/supabase/payments/student-invoices";
import { formatMoney } from "@/lib/admin/money";
import { INVOICE_STATUS_LABELS, PAYABLE_INVOICE_STATUSES } from "@/types/payments";

interface PaymentDetailPageProps {
  params: Promise<{ invoiceId: string }>;
}

export const metadata: Metadata = { title: "Invoice" };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
  issued: "info",
  overdue: "warning",
  partially_paid: "warning",
  paid: "success",
  void: "neutral",
  refunded: "neutral",
  partially_refunded: "warning",
};

export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const { invoiceId } = await params;
  const invoice = await getMyInvoiceById(invoiceId);
  if (!invoice) notFound();

  const isPayable = PAYABLE_INVOICE_STATUSES.includes(invoice.status) && invoice.dueMinorUnits > 0;

  return (
    <>
      <PageHero
        eyebrow="Payments"
        title={invoice.invoiceNumber ?? "Invoice"}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: invoice.invoiceNumber ?? "Invoice" }]}
      />
      <Section>
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={STATUS_TONE[invoice.status] ?? "neutral"}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
              <a href={`/payments/${invoice.id}/pdf`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                <Download aria-hidden="true" className="h-4 w-4" />
                Download PDF
              </a>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Total</dt>
                <dd className="mt-1 text-lg font-semibold text-text">{formatMoney(invoice.totalMinorUnits, invoice.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Amount due</dt>
                <dd className="mt-1 text-lg font-semibold text-text">{formatMoney(invoice.dueMinorUnits, invoice.currency)}</dd>
              </div>
              {invoice.issueDate ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Issue date</dt>
                  <dd className="mt-1 text-sm text-text">{new Date(invoice.issueDate).toLocaleDateString("en-IN")}</dd>
                </div>
              ) : null}
              {invoice.dueDate ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Due date</dt>
                  <dd className="mt-1 text-sm text-text">{new Date(invoice.dueDate).toLocaleDateString("en-IN")}</dd>
                </div>
              ) : null}
            </dl>

            {invoice.studentNotes ? <p className="mt-5 rounded-[var(--radius-control)] bg-surface-alt p-3 text-sm text-text-soft">{invoice.studentNotes}</p> : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-primary">Line items</h2>
            <ul className="divide-y divide-border">
              {invoice.lineItems.map((li) => (
                <li key={li.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-text">
                    {li.description} {li.quantity !== 1 ? `× ${li.quantity}` : ""}
                  </span>
                  <span className="text-text-soft">{formatMoney(li.lineTotalMinorUnits, invoice.currency)}</span>
                </li>
              ))}
            </ul>
          </Card>

          {isPayable ? (
            <Card>
              <h2 className="mb-3 text-base font-semibold text-primary">Pay this invoice</h2>
              <p className="mb-4 text-sm text-muted">
                Payment is processed securely by Razorpay. We never see or store your card, UPI, or bank details.
              </p>
              <PayButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
            </Card>
          ) : invoice.status === "paid" ? (
            <Card className="border-success/20 bg-success-light">
              <p className="text-sm text-success">This invoice has been paid in full.</p>
            </Card>
          ) : invoice.status === "void" ? (
            <Card>
              <p className="text-sm text-muted">This invoice was voided and is no longer payable.{invoice.voidReason ? ` (${invoice.voidReason})` : ""}</p>
            </Card>
          ) : null}

          <p className="text-xs text-muted">
            Need help with this invoice? Contact support — see the Trust Center for current contact details.
          </p>
        </div>
      </Section>
    </>
  );
}
