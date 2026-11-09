import { Badge } from "@/components/ui/Badge";
import { FreshnessBadge } from "@/components/sections/education/UniversityCard";
import { isVerifiedEducationRecord, NOT_YET_VERIFIED_LABEL } from "@/lib/education/verification-display";
import type { EducationFreshnessBand } from "@/types/education";

/**
 * CC-22B — the one status badge for a university or course. A verified
 * record shows its freshness band (Current / Review soon / Stale); anything
 * else shows "Not yet verified", never a green "Current".
 */
export function DataStatusBadge({ verificationStatus, freshnessBand }: { verificationStatus: string; freshnessBand: EducationFreshnessBand }) {
  if (isVerifiedEducationRecord(verificationStatus)) return <FreshnessBadge band={freshnessBand} />;
  return (
    <Badge tone="warning" className="text-[11px]">
      {NOT_YET_VERIFIED_LABEL}
    </Badge>
  );
}
