import type { MyApplicationSummary } from "@/lib/supabase/education/applications";
import type { DiscoverySession } from "@/types/discovery-session";
import type { Invoice } from "@/types/payments";

/**
 * UX10-D01 — "Important Dates" aggregator.
 *
 * The reference mockup shows a single merged list of upcoming dates
 * (an application deadline, an intake deadline, a Discovery Session, a
 * document deadline) with invented sample values. This product has no
 * single "dates" table to query instead — a real date worth surfacing
 * here already lives on one of three real records this dashboard already
 * fetches elsewhere:
 *
 *  - an application's own resolved deadline (`resolveApplicationDeadline`,
 *    `src/lib/applications/application-lifecycle.ts`) — a real FK-backed
 *    date off `course_intakes`, never a guess;
 *  - a scheduled (not merely requested) Discovery Session's `scheduledAt`;
 *  - a payable invoice's `dueDate` (the closest honest equivalent of the
 *    mockup's "document deadline" — this product's real document/signature
 *    flow, `MyAgreementSummary`, has no due-by date field to show instead).
 *
 * This module only ever reads fields already present on those records —
 * it invents no dates, no labels, and no counsellor/university names.
 * Items with no real date are simply excluded, never backfilled with a
 * placeholder.
 */

export interface ImportantDateItem {
  key: string;
  label: string;
  sublabel: string;
  date: string;
  href: string;
}

export interface ImportantDatesInput {
  applications: MyApplicationSummary[];
  discoverySession: DiscoverySession | null;
  payableInvoices: Pick<Invoice, "id" | "dueDate" | "status">[];
}

const MAX_ITEMS = 4;

export function getImportantDates(input: ImportantDatesInput): ImportantDateItem[] {
  const items: ImportantDateItem[] = [];

  for (const application of input.applications) {
    if (!application.resolvedDeadline) continue;
    items.push({
      key: `application-${application.id}`,
      label: `${application.universityName ?? "Application"} deadline`,
      sublabel: application.resolvedDeadline.label,
      date: application.resolvedDeadline.date,
      href: `/applications/${application.id}`,
    });
  }

  if (input.discoverySession && input.discoverySession.status === "scheduled" && input.discoverySession.scheduledAt) {
    items.push({
      key: `discovery-${input.discoverySession.id}`,
      label: "Discovery Session",
      sublabel: input.discoverySession.assignedCounsellorName ? `With ${input.discoverySession.assignedCounsellorName}` : "Your session",
      date: input.discoverySession.scheduledAt,
      href: "/discovery-session/book",
    });
  }

  for (const invoice of input.payableInvoices) {
    if (!invoice.dueDate) continue;
    items.push({
      key: `invoice-${invoice.id}`,
      label: "Payment due",
      sublabel: "Invoice",
      date: invoice.dueDate,
      href: "/payments",
    });
  }

  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, MAX_ITEMS);
}
