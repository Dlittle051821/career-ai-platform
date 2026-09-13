import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  MarkUnderReviewForm,
  ApproveRefundForm,
  RejectRefundForm,
  CancelRefundForm,
  ProcessApprovedRefundForm,
  ReconcileRefundForm,
} from "@/components/admin/refunds/RefundActionForms";
import { getRefundDetailForAdmin } from "@/lib/supabase/admin/refunds";
import { formatMoney } from "@/lib/admin/money";
import { REFUND_STATUS_LABELS } from "@/types/payments";
import {
  markRefundUnderReviewAction,
  approveRefundAction,
  rejectRefundAction,
  cancelRefundAction,
  processApprovedRefundAction,
  reconcileRefundAction,
} from "../actions";

interface RefundDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Refund" };

export default async function RefundDetailPage({ params }: RefundDetailPageProps) {
  const { id } = await params;
  const detail = await getRefundDetailForAdmin(id);
  if (!detail) notFound();

  const { refund, transaction, invoiceNumber, studentName, studentEmail } = detail;

  const boundMarkUnderReview = markRefundUnderReviewAction.bind(null, id);
  const boundApprove = approveRefundAction.bind(null, id);
  const boundReject = rejectRefundAction.bind(null, id);
  const boundCancel = cancelRefundAction.bind(null, id);
  const boundProcess = processApprovedRefundAction.bind(null, id);
  const boundReconcile = reconcileRefundAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/refunds" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to refunds
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Refund</p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-primary sm:text-3xl">
            {formatMoney(refund.amountMinorUnits, transaction.currency)}
            <StatusBadge status={refund.status} labelOverride={REFUND_STATUS_LABELS[refund.status]} />
          </h1>
          <p className="mt-2 text-sm text-muted">
            {studentName ?? "Unnamed student"} {studentEmail ? `(${studentEmail})` : ""} ·{" "}
            <Link href={`/admin/invoices/${refund.invoiceId}`} className="font-medium text-secondary-dark hover:text-primary hover:underline">
              {invoiceNumber ?? "View invoice"}
            </Link>
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-primary">Case details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Requested amount</dt>
            <dd className="mt-1 text-sm font-medium text-text">{formatMoney(refund.amountMinorUnits, transaction.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Payment captured</dt>
            <dd className="mt-1 text-sm text-text">{formatMoney(transaction.amountMinorUnits, transaction.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Already refunded (all cases)</dt>
            <dd className="mt-1 text-sm text-text">{formatMoney(transaction.amountRefundedMinorUnits, transaction.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Remaining refundable</dt>
            <dd className="mt-1 text-sm text-text">{formatMoney(detail.currentMaximumRefundableAmountMinorUnits, transaction.currency)}</dd>
          </div>
          {refund.reason ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Reason given at request</dt>
              <dd className="mt-1 text-sm text-text">{refund.reason}</dd>
            </div>
          ) : null}
          {refund.rejectionReason ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Rejection reason</dt>
              <dd className="mt-1 text-sm text-text">{refund.rejectionReason}</dd>
            </div>
          ) : null}
          {refund.providerRefundId ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Gateway reference</dt>
              <dd className="mt-1 font-mono text-sm text-text">{refund.providerRefundId}</dd>
            </div>
          ) : null}
        </dl>
        <ul className="mt-5 space-y-1 text-xs text-muted">
          <li>Requested {new Date(refund.createdAt).toLocaleString("en-IN")}</li>
          {refund.reviewedAt ? <li>Reviewed {new Date(refund.reviewedAt).toLocaleString("en-IN")}</li> : null}
          {refund.approvedAt ? <li>Approved {new Date(refund.approvedAt).toLocaleString("en-IN")}</li> : null}
          {refund.rejectedAt ? <li>Rejected {new Date(refund.rejectedAt).toLocaleString("en-IN")}</li> : null}
          {refund.cancelledAt ? <li>Cancelled {new Date(refund.cancelledAt).toLocaleString("en-IN")}</li> : null}
          {refund.finalizedAt ? <li>Finalized {new Date(refund.finalizedAt).toLocaleString("en-IN")}</li> : null}
        </ul>
      </Card>

      {refund.status === "requested" ? (
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-primary">Start review</h2>
            <MarkUnderReviewForm action={boundMarkUnderReview} />
          </Card>
          <Card className="border-error/20">
            <h2 className="mb-3 text-base font-semibold text-error">Cancel</h2>
            <CancelRefundForm action={boundCancel} />
          </Card>
        </div>
      ) : null}

      {refund.status === "under_review" ? (
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-primary">Approve</h2>
            <p className="mb-3 text-sm text-muted">
              Approving is a commercial decision — check your refund policy (window, fees, GST treatment) before approving; this system does
              not compute any of that for you.
            </p>
            <ApproveRefundForm action={boundApprove} currency={transaction.currency} currentAmountMinorUnits={refund.amountMinorUnits} />
          </Card>
          <Card className="border-error/20">
            <h2 className="mb-3 text-base font-semibold text-error">Reject</h2>
            <RejectRefundForm action={boundReject} />
          </Card>
          <Card className="border-error/20 sm:col-span-2">
            <h2 className="mb-3 text-base font-semibold text-error">Cancel</h2>
            <CancelRefundForm action={boundCancel} />
          </Card>
        </div>
      ) : null}

      {refund.status === "approved" ? (
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <Card className="border-primary/20">
            <h2 className="mb-3 text-base font-semibold text-primary">Process refund</h2>
            <ProcessApprovedRefundForm action={boundProcess} />
          </Card>
          <Card className="border-error/20">
            <h2 className="mb-3 text-base font-semibold text-error">Cancel</h2>
            <CancelRefundForm action={boundCancel} />
          </Card>
        </div>
      ) : null}

      {refund.status === "processing" ? (
        <Card className="mb-6">
          <h2 className="mb-2 text-base font-semibold text-primary">Processing</h2>
          <p className="mb-3 text-sm text-muted">
            This refund has been sent to Razorpay. It will be confirmed automatically by webhook — if it has been unexpectedly slow, check
            directly with Razorpay below rather than assuming it failed.
          </p>
          <ReconcileRefundForm action={boundReconcile} />
        </Card>
      ) : null}

      {refund.status === "processed" ? (
        <Card className="mb-6 border-success/20 bg-success-light">
          <p className="text-sm text-success">This refund completed successfully.</p>
        </Card>
      ) : null}

      {refund.status === "failed" ? (
        <Card className="mb-6 border-error/20 bg-error-light">
          <p className="text-sm text-error">This refund attempt failed at the gateway. Open a new refund case if the student should still be refunded.</p>
        </Card>
      ) : null}
    </div>
  );
}
