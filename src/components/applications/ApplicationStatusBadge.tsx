import { StatusBadge } from "@/components/admin/StatusBadge";
import { APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/types/admin";

/**
 * Milestone 16 — the one place a student-facing application stage is
 * rendered. Deliberately just a thin wrapper over the SAME shared
 * StatusBadge/STATUS_TONE system every admin page already uses (see
 * src/components/sections/profile/ProvenanceSummaryCard.tsx for the
 * existing precedent of a site-facing component reusing it) — never a
 * bespoke color map, so "submitted" reads the same accent tone everywhere
 * in the product, admin or student-facing.
 */
export function ApplicationStatusBadge({ stage }: { stage: ApplicationStage }) {
  return <StatusBadge status={stage} labelOverride={APPLICATION_STAGE_LABELS[stage]} />;
}
