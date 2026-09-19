/**
 * UX06A/E — pure visibility predicates for the dashboard's grouped
 * sections. Extracted so the "hide this section when it would just be
 * empty clutter" rule (spec: "Only show modules when relevant. Do not
 * create empty dashboard clutter.") is a small, obviously-correct,
 * independently testable decision rather than an inline boolean baked
 * into JSX. Deliberately does NOT touch getNextBestAction() or
 * computeJourneyProgress() (src/lib/dashboard/next-best-action.ts,
 * journey-progress.ts) — both stay the dashboard's only two "what's
 * next?" / "where am I?" systems; this module only decides which of the
 * lower-priority grouped cards are worth showing at all. A payment due or
 * an agreement awaiting signature is already the dashboard's #1-priority
 * message via getNextBestAction() itself, so there is deliberately no
 * separate "needs attention" section here that would just repeat it.
 */

export interface SavedAndOngoingSectionInput {
  purchaseCount: number;
  agreementCount: number;
  savedItemCount: number;
  invoiceCount: number;
}

/**
 * "Saved & ongoing" (plans purchased, invoices, agreements on file, saved
 * universities/courses) is shown only once the student has at least one
 * of those — a brand-new student with none of this yet sees a shorter,
 * less cluttered dashboard rather than four empty-state cards in a row.
 */
export function shouldShowSavedAndOngoingSection({ purchaseCount, agreementCount, savedItemCount, invoiceCount }: SavedAndOngoingSectionInput): boolean {
  return purchaseCount > 0 || agreementCount > 0 || savedItemCount > 0 || invoiceCount > 0;
}
