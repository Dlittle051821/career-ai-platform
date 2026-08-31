import { Badge } from "@/components/ui/Badge";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

/**
 * Status -> visual tone, shared across every module so "paid" is always
 * green, "pending" always neutral/amber, etc. regardless of which table
 * it's a status for. Falls back to "neutral" for any status string not
 * explicitly listed, so a future status value never crashes a page — it
 * just renders unstyled instead of colour-coded.
 */
const STATUS_TONE: Record<string, Tone> = {
  // Generic
  active: "success",
  inactive: "neutral",
  archived: "neutral",
  draft: "neutral",
  published: "success",
  cancelled: "neutral",
  // Leads
  new: "info",
  contacted: "info",
  qualified: "accent",
  nurturing: "accent",
  converted: "success",
  lost: "neutral",
  // Applications
  prospect: "neutral",
  inquiry: "info",
  preparing: "info",
  submitted: "accent",
  under_review: "accent",
  interview: "accent",
  decision_pending: "warning",
  offer_received: "success",
  enrolled: "success",
  rejected: "error",
  withdrawn: "neutral",
  // Payments
  pending: "warning",
  paid: "success",
  failed: "error",
  refunded: "neutral",
  partially_refunded: "warning",
  // Agreements / signatures
  sent: "info",
  signed: "success",
  declined: "error",
  expired: "neutral",
  not_started: "neutral",
  pending_signature: "warning",
  // Milestone 10 (F-122) — signature_requests.status / agreement_versions.status
  viewed: "warning",
  locked: "info",
  superseded: "neutral",
  // Priority
  low: "neutral",
  medium: "info",
  high: "warning",
  // Accreditation / data quality
  unverified: "neutral",
  self_reported: "info",
  verified: "success",
  reviewed: "info",
  approved: "success",
  // Milestone 8 — invoices/payment attempts/transactions/refunds/webhook events
  issued: "info",
  overdue: "warning",
  void: "neutral",
  partially_paid: "warning",
  created: "neutral",
  authorized: "info",
  captured: "success",
  requested: "info",
  processing: "info",
  processed: "success",
  received: "neutral",
  ignored: "neutral",
  // Milestone 9 — CSV import batches (education_import_batches.status) and
  // rows (education_import_rows.status). "cancelled" and "failed" above are
  // shared with existing modules; the rest are unique to the import
  // pipeline, so no collision with any status string used elsewhere.
  uploaded: "neutral",
  validating: "info",
  validated: "accent",
  importing: "info",
  completed: "success",
  completed_with_errors: "warning",
  valid: "success",
  warning: "warning",
  error: "error",
  imported: "success",
  skipped: "neutral",
  duplicate: "warning",
};

function label(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ status, labelOverride }: { status: string; labelOverride?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{labelOverride ?? label(status)}</Badge>;
}
