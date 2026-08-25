import { Badge } from "@/components/ui/Badge";
import { MATCH_BAND_LABELS } from "@/lib/recommendations";
import type { MatchBand } from "@/lib/recommendations";

const TONE_BY_BAND: Record<MatchBand, "success" | "info" | "accent" | "neutral"> = {
  strong_match: "success",
  promising_match: "info",
  worth_exploring: "accent",
  limited_evidence: "neutral",
};

/** Qualitative-only badge — never renders a number/percentage, only the four fixed band labels. See docs/recommendation-engine-guide.md. */
export function MatchBandBadge({ band, className }: { band: MatchBand; className?: string }) {
  return (
    <Badge tone={TONE_BY_BAND[band]} className={className}>
      {MATCH_BAND_LABELS[band]}
    </Badge>
  );
}
