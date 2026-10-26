import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, Receipt, RotateCcw, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/admin/CommandCentreWidgets";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { getCommercialFinanceOverview } from "@/lib/supabase/admin/commercial-finance";
import { PAYMENT_STATUS_LABELS } from "@/types/admin";
import { INVOICE_STATUS_LABELS, REFUND_STATUS_LABELS } from "@/types/payments";

export const metadata: Metadata = { title: "Commercial & Finance" };

const INVOICE_STATUS_TONE = { draft: "neutral", issued: "info", partially_paid: "warning", paid: "success", overdue: "error", void: "neutral", refunded: "neutral", partially_refunded: "neutral" } as const;
const PAYMENT_STATUS_TONE = { pending: "warning", paid: "success", failed: "error", refunded: "neutral", partially_refunded: "neutral", cancelled: "neutral" } as const;
const REFUND_STATUS_TONE = {
  requested: "warning",
  under_review: "warning",
  approved: "info",
  processing: "info",
  processed: "success",
  failed: "error",
  rejected: "neutral",
  cancelled: "neutral",
} as const;

function StatusRow({ label, count, tone }: { label: string; count: number; tone: "neutral" | "success" | "warning" | "error" | "info" | "accent" }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-soft">{label}</span>
      <Badge tone={tone}>{count}</Badge>
    </div>
  );
}

/**
 * NW08.6 — Commercial Operations & Finance overview. Composes
 * getCommercialFinanceOverview() (pricing/payments/invoices/refunds, each
 * independently permission-gated) into one page. Purchase, payment,
 * invoice, and refund are rendered as four separate panels on purpose —
 * never merged into one number — per the brief's own "keep these concepts
 * distinct" rule (see that function's own docblock for the full reasoning,
 * and NW08_01_ADMIN_AUDIT.md §6 for the Payment.refundStatus vs.
 * refunds.status distinction this page's Refunds panel reflects).
 *
 * The known GST/checkout-calculation risk disclosed in an earlier
 * milestone is NOT addressed, re-verified, or touched by this page or its
 * data function — it remains open, exactly as before. Nothing here enables
 * or changes a checkout flow.
 */
export default async function AdminFinancePage() {
  const admin = await getCurrentAdmin();
  const overview = await getCommercialFinanceOverview(admin?.role);

  const hasAnySection = overview.invoiceStatusDistribution !== null || overview.paymentStatusDistribution !== null || overview.refundStatusDistribution !== null || overview.pricing !== null;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Commercial & Finance</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Commercial Operations & Finance</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pricing, payments, invoices, and refunds stay four separate concepts here, never merged into one figure.
          Nextwise Verified is INR 1,999 inclusive of applicable GST; a previously disclosed checkout-calculation
          risk remains open and untouched by this page — see docs/milestones/NW08/NW08_06_COMMERCIAL_FINANCE.md.
        </p>
      </div>

      {!hasAnySection ? (
        <Card>
          <p className="text-sm text-muted">Your role does not have access to any commercial or finance module.</p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {overview.pricing ? (
            <SectionCard
              title="Pricing"
              subtitle="Active, publishable plans and offers — not a sales total."
              action={
                <Link href="/admin/pricing" className="flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary">
                  <Tag aria-hidden="true" className="h-4 w-4" /> Pricing
                </Link>
              }
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-soft">Active plans</span>
                  <Badge tone="accent">{overview.pricing.activePlanCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-soft">Active offers</span>
                  <Badge tone="accent">{overview.pricing.activeOfferCount}</Badge>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {overview.paymentStatusDistribution ? (
            <SectionCard
              title="Payments"
              subtitle="Operational tracking only — never a processor. Only 'paid' counts as recorded revenue."
              action={
                <Link href="/admin/payments" className="flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary">
                  <Wallet aria-hidden="true" className="h-4 w-4" /> Payments
                </Link>
              }
            >
              <div className="space-y-2">
                {overview.paymentStatusDistribution.every((r) => r.count === 0) ? (
                  <p className="text-sm text-muted">No payments recorded yet.</p>
                ) : (
                  overview.paymentStatusDistribution.map((r) => <StatusRow key={r.status} label={PAYMENT_STATUS_LABELS[r.status]} count={r.count} tone={PAYMENT_STATUS_TONE[r.status]} />)
                )}
              </div>
            </SectionCard>
          ) : null}

          {overview.invoiceStatusDistribution ? (
            <SectionCard
              title="Invoices"
              subtitle="Billing documents — independent of a single payment's own status."
              action={
                <Link href="/admin/invoices" className="flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary">
                  <Receipt aria-hidden="true" className="h-4 w-4" /> Invoices
                </Link>
              }
            >
              <div className="space-y-2">
                {overview.invoiceStatusDistribution.every((r) => r.count === 0) ? (
                  <p className="text-sm text-muted">No invoices yet.</p>
                ) : (
                  overview.invoiceStatusDistribution.map((r) => <StatusRow key={r.status} label={INVOICE_STATUS_LABELS[r.status]} count={r.count} tone={INVOICE_STATUS_TONE[r.status]} />)
                )}
              </div>
            </SectionCard>
          ) : null}

          {overview.refundStatusDistribution ? (
            <SectionCard
              title="Refunds"
              subtitle="A 'requested' or 'under review' case is not money that has left the business."
              action={
                <Link href="/admin/refunds" className="flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary">
                  <RotateCcw aria-hidden="true" className="h-4 w-4" /> Refunds
                </Link>
              }
            >
              <div className="space-y-2">
                {overview.refundStatusDistribution.every((r) => r.count === 0) ? (
                  <p className="text-sm text-muted">No refund cases yet.</p>
                ) : (
                  overview.refundStatusDistribution.map((r) => <StatusRow key={r.status} label={REFUND_STATUS_LABELS[r.status]} count={r.count} tone={REFUND_STATUS_TONE[r.status]} />)
                )}
              </div>
            </SectionCard>
          ) : null}
        </div>
      )}
    </div>
  );
}
