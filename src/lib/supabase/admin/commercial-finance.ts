import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import type { AdminRole, PaymentStatus } from "@/types/admin";
import { INVOICE_STATUSES, REFUND_STATUSES, type InvoiceStatus, type RefundStatus } from "@/types/payments";

/**
 * NW08.6 — Commercial Operations & Finance overview.
 *
 * This module composes a read-only summary across the four EXISTING,
 * independently-mature commercial modules (pricing, payments, invoices,
 * refunds) — it is not a second ledger, it does not write anything, and it
 * never conflates the four distinct concepts the NW08 brief insists stay
 * distinct on screen:
 *   - a PURCHASE/offer is a pricing concept (pricing_plans/pricing_offers);
 *   - a PAYMENT is a record of money changing hands (or attempting to —
 *     `payments.status` includes `pending`/`failed`, neither of which is
 *     revenue);
 *   - an INVOICE is a billing document, independent of whether it has been
 *     fully paid (`invoices.status` has its own `partially_paid`/`overdue`
 *     states that a Payment's own status does not mirror 1:1);
 *   - a REFUND is a request/decision/execution lifecycle
 *     (`REFUND_STATUS_TRANSITIONS` in src/lib/admin/status.ts) — a
 *     `requested` or `under_review` refund is never money that has left
 *     the business, and this module never reports it as such.
 *
 * Every section below is independently permission-gated (hasPermission
 * checked, never requireAdminPermission's throwing form) so a role with
 * only SOME of pricing:read/payments:read/invoices:read/refunds:read still
 * gets the sections it's entitled to, exactly as
 * src/app/admin/crm/page.tsx's per-section gating already does for
 * students:read/leads:read. The GST/checkout-calculation risk this
 * codebase has disclosed since an earlier milestone is NOT touched by
 * anything here — this module only reads already-recorded payment/invoice
 * rows, it never computes or re-computes a price, tax, or checkout total.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/commercial-finance] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function tallyByStatus<S extends string>(supabase: Supabase, table: "invoices" | "payments" | "refunds", statuses: readonly S[]): Promise<{ status: S; count: number }[]> {
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("status", status);
      if (error) {
        logDbError(`tallyByStatus:${table}:${status}`, error);
        return { status, count: 0 };
      }
      return { status, count: count ?? 0 };
    })
  );
  return counts;
}

const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded", "partially_refunded", "cancelled"];

export interface PricingActiveCounts {
  activePlanCount: number;
  activeOfferCount: number;
}

async function getPricingActiveCounts(supabase: Supabase): Promise<PricingActiveCounts> {
  const [plansRes, offersRes] = await Promise.all([
    supabase.from("pricing_plans").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("pricing_offers").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);
  if (plansRes.error) logDbError("getPricingActiveCounts:plans", plansRes.error);
  if (offersRes.error) logDbError("getPricingActiveCounts:offers", offersRes.error);
  return { activePlanCount: plansRes.count ?? 0, activeOfferCount: offersRes.count ?? 0 };
}

export interface CommercialFinanceOverview {
  /** null when the caller lacks invoices:read — distinct from an empty array (which means "permitted, zero invoices"). */
  invoiceStatusDistribution: { status: InvoiceStatus; count: number }[] | null;
  paymentStatusDistribution: { status: PaymentStatus; count: number }[] | null;
  refundStatusDistribution: { status: RefundStatus; count: number }[] | null;
  pricing: PricingActiveCounts | null;
}

export async function getCommercialFinanceOverview(role: AdminRole | undefined): Promise<CommercialFinanceOverview> {
  const supabase = await createClient();
  const canInvoices = hasPermission(role, "invoices:read");
  const canPayments = hasPermission(role, "payments:read");
  const canRefunds = hasPermission(role, "refunds:read");
  const canPricing = hasPermission(role, "pricing:read");

  // Defense-in-depth, same convention as every other admin data-access
  // module: hasPermission() above decides which sections to even attempt
  // (so a role missing one permission never sees that section at all,
  // rather than hitting a thrown error), and requireAdminPermission() here
  // re-verifies the CURRENT session's own role server-side before each
  // query actually runs — it is never satisfied merely by the `role`
  // parameter the caller passed in.
  const [invoiceStatusDistribution, paymentStatusDistribution, refundStatusDistribution, pricing] = await Promise.all([
    canInvoices ? requireAdminPermission("invoices:read").then(() => tallyByStatus(supabase, "invoices", INVOICE_STATUSES)) : Promise.resolve(null),
    canPayments ? requireAdminPermission("payments:read").then(() => tallyByStatus(supabase, "payments", PAYMENT_STATUSES)) : Promise.resolve(null),
    canRefunds ? requireAdminPermission("refunds:read").then(() => tallyByStatus(supabase, "refunds", REFUND_STATUSES)) : Promise.resolve(null),
    canPricing ? requireAdminPermission("pricing:read").then(() => getPricingActiveCounts(supabase)) : Promise.resolve(null),
  ]);

  return { invoiceStatusDistribution, paymentStatusDistribution, refundStatusDistribution, pricing };
}
