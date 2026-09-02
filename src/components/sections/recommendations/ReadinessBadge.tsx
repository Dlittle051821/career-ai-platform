import { Badge } from "@/components/ui/Badge";
import { READINESS_LEVEL_LABELS, type ReadinessLevel } from "@/types/recommendation-readiness";

/**
 * Milestone 11-C2 — student-facing readiness badge. Deliberately its own
 * small component (not a reuse of src/components/admin/StatusBadge, which
 * is an admin-only-styled component with its own much larger status
 * vocabulary) — this is the one place a student-facing page shows a
 * Recommendation Readiness level.
 */
const READINESS_TONE: Record<ReadinessLevel, "neutral" | "info" | "success"> = {
  NOT_READY: "neutral",
  PRELIMINARY: "info",
  READY: "success",
  COUNSELLOR_VERIFIED: "success",
};

export function ReadinessBadge({ level }: { level: ReadinessLevel }) {
  return <Badge tone={READINESS_TONE[level]}>{READINESS_LEVEL_LABELS[level]}</Badge>;
}
