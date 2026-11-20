import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * NW-PAYMENT-V1 — what Student Studio shows about the student's package,
 * read with the student's own session (RLS: own purchases, own invoices).
 * "active" is true only when the purchase's invoice is paid — the same rule
 * src/lib/products/entitlements.ts applies to every access decision.
 */

export interface MyPlanService {
  title: string;
  explanation: string | null;
  category: string | null;
  isHighlight: boolean;
}

export interface MyPlanOverview {
  purchaseId: string;
  quoteId: string | null;
  planName: string;
  status: "active" | "confirming" | "refunded" | "inactive";
  activatedAt: string | null;
  amountMinor: number;
  currency: string;
  includedUniversities: number | null;
  additionalUniversities: number;
  totalUniversities: number | null;
  services: MyPlanService[];
  invoice: { id: string; number: string | null; status: string; totalMinor: number; paidAt: string | null } | null;
  receipt: { transactionId: string; paymentId: string | null; amountMinor: number; method: string | null; capturedAt: string | null } | null;
}

type PurchaseRow = {
  id: string;
  pricing_quote_id: string | null;
  plan_name_at_purchase: string;
  final_amount_minor_units: number;
  currency: string;
  invoice_id: string | null;
  inclusions_at_purchase: unknown;
  included_universities_at_purchase: number | null;
  additional_universities_at_purchase: number | null;
  total_universities_at_purchase: number | null;
  purchased_at: string;
};

function services(raw: unknown): MyPlanService[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      title: String(r.title ?? ""),
      explanation: typeof r.explanation === "string" ? r.explanation : null,
      category: typeof r.category === "string" ? r.category : null,
      isHighlight: r.isHighlight === true,
    }))
    .filter((s) => s.title);
}

/** The student's most relevant Payment V1 package: the active one if any, otherwise the newest one being paid for. */
export async function getMyPlanOverview(): Promise<MyPlanOverview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("pricing_purchases")
    .select("id, pricing_quote_id, plan_name_at_purchase, final_amount_minor_units, currency, invoice_id, inclusions_at_purchase, included_universities_at_purchase, additional_universities_at_purchase, total_universities_at_purchase, purchased_at")
    .eq("student_user_id", user.id)
    .not("pricing_quote_id", "is", null)
    .order("purchased_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as unknown as PurchaseRow[];
  if (rows.length === 0) return null;

  const invoiceIds = rows.map((r) => r.invoice_id).filter((v): v is string => !!v);
  const { data: invRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_minor_units, paid_at, voided_at, settled_transaction_id")
    .in("id", invoiceIds);
  const invoices = new Map((invRows ?? []).map((i) => [i.id, i as unknown as { id: string; invoice_number: string | null; status: string; total_minor_units: number; paid_at: string | null; voided_at: string | null; settled_transaction_id: string | null }]));

  const statusOf = (r: PurchaseRow): MyPlanOverview["status"] => {
    const inv = r.invoice_id ? invoices.get(r.invoice_id) : undefined;
    if (!inv) return "inactive";
    if (inv.status === "paid") return "active";
    if (inv.status === "refunded" || inv.status === "partially_refunded") return "refunded";
    if (inv.status === "draft" && !inv.voided_at) return "confirming";
    return "inactive";
  };

  const chosen = rows.find((r) => statusOf(r) === "active") ?? rows.find((r) => statusOf(r) === "confirming") ?? null;
  if (!chosen) return null;
  const inv = chosen.invoice_id ? invoices.get(chosen.invoice_id) : undefined;

  let receipt: MyPlanOverview["receipt"] = null;
  if (inv?.settled_transaction_id) {
    const { data: txn } = await supabase.from("payment_transactions").select("id, provider_payment_id, amount_minor_units, method_category, captured_at").eq("id", inv.settled_transaction_id).maybeSingle();
    if (txn) receipt = { transactionId: txn.id, paymentId: txn.provider_payment_id, amountMinor: txn.amount_minor_units, method: txn.method_category, capturedAt: txn.captured_at };
  }

  return {
    purchaseId: chosen.id,
    quoteId: chosen.pricing_quote_id,
    planName: chosen.plan_name_at_purchase,
    status: statusOf(chosen),
    activatedAt: inv?.paid_at ?? null,
    amountMinor: Number(chosen.final_amount_minor_units),
    currency: chosen.currency,
    includedUniversities: chosen.included_universities_at_purchase,
    additionalUniversities: chosen.additional_universities_at_purchase ?? 0,
    totalUniversities: chosen.total_universities_at_purchase,
    services: services(chosen.inclusions_at_purchase),
    invoice: inv && inv.status !== "draft" ? { id: inv.id, number: inv.invoice_number, status: inv.status, totalMinor: inv.total_minor_units, paidAt: inv.paid_at } : null,
    receipt,
  };
}
