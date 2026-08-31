import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { getPricingAnalyticsSummary } from "@/lib/supabase/admin/pricing-analytics";
import { formatMoney } from "@/lib/admin/money";

export const metadata: Metadata = { title: "Pricing Analytics" };

/** Simple non-clickable rate display, e.g. "12 / 340 (3.5%)" — never implies a target or benchmark, just the raw funnel counts. */
function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return `${numerator}`;
  return `${numerator} (${((numerator / denominator) * 100).toFixed(1)}%)`;
}

export default async function PricingAnalyticsPage() {
  const summary = await getPricingAnalyticsSummary();

  return (
    <div className="max-w-6xl">
      <Link href="/admin/pricing" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to pricing
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Pricing</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Pricing analytics</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Views, selections, and checkout starts come from anonymous funnel events. Revenue and purchase/failure
          counts are computed live from actual invoices and payments — never a second, independently-tracked figure.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total revenue</p>
          <p className="mt-2 text-2xl font-semibold text-primary">{formatMoney(summary.totalRevenueMinorUnits, "INR")}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Successful purchases</p>
          <p className="mt-2 text-2xl font-semibold text-primary">{summary.totalPurchases}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Failed payments</p>
          <p className="mt-2 text-2xl font-semibold text-primary">{summary.totalFailedPayments}</p>
        </Card>
      </div>

      <Card className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-primary">By plan</h2>
        {summary.planStats.length === 0 ? (
          <p className="text-sm text-muted">No plans yet.</p>
        ) : (
          <AdminTable headers={["Plan", "Views", "Selected", "Checkout started", "Purchases", "Failed", "Revenue"]}>
            {summary.planStats.map((stat) => (
              <tr key={stat.planId} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">{stat.planTitle}</Td>
                <Td className="text-text-soft">{stat.views}</Td>
                <Td className="text-text-soft">{rate(stat.selections, stat.views)}</Td>
                <Td className="text-text-soft">{rate(stat.checkoutStarts, stat.selections)}</Td>
                <Td className="text-text-soft">{rate(stat.purchases, stat.checkoutStarts)}</Td>
                <Td className="text-text-soft">{stat.failedPayments}</Td>
                <Td className="text-text-soft">{formatMoney(stat.revenueMinorUnits, stat.currency)}</Td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">By offer</h2>
        {summary.offerStats.length === 0 ? (
          <p className="text-sm text-muted">No offers yet.</p>
        ) : (
          <AdminTable headers={["Offer", "Coupon", "Redemptions", "Total discount given"]}>
            {summary.offerStats.map((stat) => (
              <tr key={stat.offerId} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">{stat.offerName}</Td>
                <Td className="text-text-soft">{stat.couponCode ?? "—"}</Td>
                <Td className="text-text-soft">
                  {stat.redemptionCount}
                  {stat.maxRedemptions ? ` / ${stat.maxRedemptions}` : ""}
                </Td>
                <Td className="text-text-soft">{formatMoney(stat.totalDiscountMinorUnits, stat.currency)}</Td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Card>
    </div>
  );
}
