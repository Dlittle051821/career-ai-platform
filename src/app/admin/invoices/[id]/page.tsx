import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InvoiceHeaderForm } from "@/components/admin/invoices/InvoiceHeaderForm";
import { LineItemsEditor } from "@/components/admin/invoices/LineItemsEditor";
import {
  IssueInvoiceForm,
  VoidInvoiceForm,
  RecordOfflinePaymentForm,
  CreatePaymentLinkForm,
  ReconcileAttemptForm,
  InitiateRefundForm,
} from "@/components/admin/invoices/InvoiceActionForms";
import { getInvoiceById, listStudentOptions } from "@/lib/supabase/admin/invoices";
import { getInvoicePaymentActivity } from "@/lib/supabase/admin/payment-attempts";
import { formatMoney } from "@/lib/admin/money";
import { INVOICE_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { INVOICE_STATUS_LABELS, PAYABLE_INVOICE_STATUSES, PAYMENT_ATTEMPT_STATUS_LABELS, PAYMENT_TRANSACTION_STATUS_LABELS } from "@/types/payments";
import {
  updateInvoiceHeaderAction,
  replaceLineItemsAction,
  issueInvoiceAction,
  voidInvoiceAction,
  recordOfflinePaymentAction,
  createPaymentLinkAction,
  reconcilePaymentAttemptAction,
  initiateRefundAction,
} from "../actions";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  const [invoice, studentOptions, activity] = await Promise.all([getInvoiceById(id), listStudentOptions(), getInvoicePaymentActivity(id)]);
  if (!invoice) notFound();

  const isDraft = invoice.status === "draft";
  const canVoid = isValidTransition(INVOICE_STATUS_TRANSITIONS, invoice.status, "void");
  const isPayable = PAYABLE_INVOICE_STATUSES.includes(invoice.status);

  const boundUpdateHeader = updateInvoiceHeaderAction.bind(null, id);
  const boundReplaceLineItems = replaceLineItemsAction.bind(null, id);
  const boundIssue = issueInvoiceAction.bind(null, id);
  const boundVoid = voidInvoiceAction.bind(null, id);
  const boundRecordOffline = recordOfflinePaymentAction.bind(null, id);
  const boundCreateLink = createPaymentLinkAction.bind(null, id);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/invoices" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to invoices
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Invoices</p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-primary sm:text-3xl">
            {invoice.invoiceNumber ?? `Draft ${invoice.id.slice(0, 8)}`}
            <StatusBadge status={invoice.status} labelOverride={INVOICE_STATUS_LABELS[invoice.status]} />
          </h1>
          <p className="mt-2 text-sm text-muted">
            {invoice.studentName ?? "Unnamed student"} {invoice.studentEmail ? `(${invoice.studentEmail})` : ""}
          </p>
        </div>
        {!isDraft ? (
          <a
            href={`/admin/invoices/${invoice.id}/pdf`}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-control)] border border-border-strong px-4 py-2 text-sm font-medium text-primary hover:bg-surface-alt"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download PDF
          </a>
        ) : null}
      </div>

      <Card className="mb-6">
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Subtotal</dt>
            <dd className="mt-1 text-sm font-medium text-text">{formatMoney(invoice.subtotalMinorUnits, invoice.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Tax</dt>
            <dd className="mt-1 text-sm font-medium text-text">{formatMoney(invoice.taxMinorUnits, invoice.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Total</dt>
            <dd className="mt-1 text-sm font-semibold text-text">{formatMoney(invoice.totalMinorUnits, invoice.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Due</dt>
            <dd className="mt-1 text-sm font-semibold text-text">{formatMoney(invoice.dueMinorUnits, invoice.currency)}</dd>
          </div>
        </dl>
        {invoice.capturedTotalMinorUnits > 0 || invoice.refundedTotalMinorUnits > 0 ? (
          <p className="mt-4 text-xs text-muted">
            Paid to date: {formatMoney(invoice.capturedTotalMinorUnits, invoice.currency)}
            {invoice.refundedTotalMinorUnits > 0 ? ` · Refunded: ${formatMoney(invoice.refundedTotalMinorUnits, invoice.currency)}` : ""}
          </p>
        ) : null}
      </Card>

      {isDraft ? (
        <>
          <Card className="mb-6">
            <h2 className="mb-4 text-base font-semibold text-primary">Invoice details</h2>
            <InvoiceHeaderForm action={boundUpdateHeader} defaultValues={invoice} studentOptions={studentOptions} submitLabel="Save details" />
          </Card>
          <Card className="mb-6">
            <h2 className="mb-4 text-base font-semibold text-primary">Line items</h2>
            <LineItemsEditor action={boundReplaceLineItems} currency={invoice.currency} initialLineItems={invoice.lineItems} />
          </Card>
          <Card className="mb-6">
            <h2 className="mb-2 text-base font-semibold text-primary">Issue this invoice</h2>
            <IssueInvoiceForm action={boundIssue} />
          </Card>
        </>
      ) : (
        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold text-primary">Line items</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2">Description</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Unit</th>
                  <th className="py-2">Tax</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-2 text-text">{li.description}</td>
                    <td className="py-2 text-text-soft">{li.quantity}</td>
                    <td className="py-2 text-text-soft">{formatMoney(li.unitAmountMinorUnits, invoice.currency)}</td>
                    <td className="py-2 text-text-soft">{li.taxRateBps ? `${(li.taxRateBps / 100).toFixed(2)}%` : "—"}</td>
                    <td className="py-2 text-right text-text">{formatMoney(li.lineTotalMinorUnits, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoice.billingSnapshot ? (
            <p className="mt-4 text-xs text-muted">
              Billed to {invoice.billingSnapshot.studentName}
              {invoice.billingSnapshot.gstRegisteredAtIssuance ? " · GST-registered at issuance" : ""} — frozen at issuance on{" "}
              {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString("en-IN") : "—"}, unaffected by later profile changes.
            </p>
          ) : null}
        </Card>
      )}

      {isPayable ? (
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-primary">Record offline payment</h2>
            <RecordOfflinePaymentForm action={boundRecordOffline} currency={invoice.currency} dueMinorUnits={invoice.dueMinorUnits} />
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-semibold text-primary">Payment link</h2>
            <p className="mb-3 text-sm text-muted">Generate a copyable link the student can use to pay online via Razorpay.</p>
            <CreatePaymentLinkForm action={boundCreateLink} />
          </Card>
        </div>
      ) : null}

      {canVoid ? (
        <Card className="mb-6 border-error/20">
          <h2 className="mb-3 text-base font-semibold text-error">Void this invoice</h2>
          <VoidInvoiceForm action={boundVoid} />
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 text-base font-semibold text-primary">Payment activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted">No payment attempts yet.</p>
        ) : (
          <ul className="space-y-4">
            {activity.map(({ attempt, transactions }) => (
              <li key={attempt.id} className="rounded-[var(--radius-control)] border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{attempt.provider === "offline" ? "Offline" : "Razorpay"} attempt</span>
                    <StatusBadge status={attempt.status} labelOverride={PAYMENT_ATTEMPT_STATUS_LABELS[attempt.status]} />
                  </div>
                  <span className="text-xs text-muted">{new Date(attempt.createdAt).toLocaleString("en-IN")}</span>
                </div>
                {transactions.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">No gateway response recorded for this attempt yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {transactions.map((txn) => {
                      const remaining = txn.amountMinorUnits - txn.amountRefundedMinorUnits;
                      const canRefund = !txn.isManual && (txn.status === "captured" || txn.status === "partially_refunded") && remaining > 0;
                      const canReceipt = txn.status === "captured" || txn.status === "refunded" || txn.status === "partially_refunded";
                      const canReconcile = !txn.isManual && !!txn.providerPaymentId && (attempt.status === "created" || attempt.status === "pending" || attempt.status === "authorized");
                      const boundReconcile = reconcilePaymentAttemptAction.bind(null, id, attempt.id);
                      const boundRefund = initiateRefundAction.bind(null, id);
                      return (
                        <li key={txn.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={txn.status} labelOverride={PAYMENT_TRANSACTION_STATUS_LABELS[txn.status]} />
                              {txn.isManual ? <StatusBadge status="offline" labelOverride="Offline (manual)" /> : null}
                              <span className="text-sm font-medium text-text">{formatMoney(txn.amountMinorUnits, txn.currency)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {canReceipt ? (
                                <a href={`/admin/invoices/${id}/receipts/${txn.id}`} className="text-xs font-semibold text-secondary-dark hover:text-primary">
                                  Download receipt
                                </a>
                              ) : null}
                              {canReconcile ? <ReconcileAttemptForm action={boundReconcile} /> : null}
                            </div>
                          </div>
                          {txn.failureReason ? <p className="mt-1 text-xs text-error">{txn.failureReason}</p> : null}
                          {canRefund ? (
                            <div className="mt-3">
                              <InitiateRefundForm action={boundRefund} transactionId={txn.id} remainingMinorUnits={remaining} currency={txn.currency} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
