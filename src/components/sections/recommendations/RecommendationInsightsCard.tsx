import { BadgeCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MATCH_BAND_LABELS, EVIDENCE_LEVEL_LABELS } from "@/lib/recommendations";
import type { RecommendationResult } from "@/lib/recommendations";
import { RECOMMENDATION_CONFIDENCE_LABELS, type RecommendationReadiness } from "@/types/recommendation-readiness";

function formatVerifiedDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * UX10-REC01 — "Recommendation Insights" sidebar card. Every statement
 * here must be defensible against real data (brief section 16, the
 * milestone's own most sensitive requirement):
 *  - "Reviewed by our counselling framework" does NOT appear anywhere —
 *    no such real, user-facing signal exists in this codebase.
 *  - A "Counsellor verified" line appears ONLY when the real
 *    `careerReadiness.level === "COUNSELLOR_VERIFIED"` is true for this
 *    specific student, and shows only the real verification date — never
 *    a counsellor's name (`verifiedByCounsellorName` is always `null` to
 *    a student, by design — see `getMyRecommendationReadiness()`'s own
 *    docblock). A completed Discovery Session is a separate, unrelated
 *    real system and is never used to infer this badge.
 *  - The match band / evidence level come straight from the real
 *    engine's own `MATCH_BAND_LABELS`/`EVIDENCE_LEVEL_LABELS` — no new
 *    copy, no percentage.
 */
export function RecommendationInsightsCard({
  topResult,
  careerReadiness,
}: {
  topResult: RecommendationResult | null;
  careerReadiness: RecommendationReadiness | null;
}) {
  const verifiedDate = careerReadiness?.level === "COUNSELLOR_VERIFIED" ? formatVerifiedDate(careerReadiness.verifiedAt) : null;

  return (
    <section aria-labelledby="recommendation-insights-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
        <h2 id="recommendation-insights-heading" className="font-sans text-base font-semibold text-text">
          Recommendation Insights
        </h2>
      </div>

      <div className="mt-3 space-y-3 text-sm text-text-soft">
        {topResult ? (
          <p>
            Your strongest match right now is <span className="font-semibold text-text">{topResult.title}</span> —{" "}
            <Badge tone="info" className="align-middle">
              {MATCH_BAND_LABELS[topResult.matchBand]}
            </Badge>
            , {EVIDENCE_LEVEL_LABELS[topResult.evidenceLevel].toLowerCase()}.
          </p>
        ) : (
          <p>Complete more of your profile to see which careers match best.</p>
        )}

        {careerReadiness ? (
          <p className="text-xs text-muted">
            Confidence in these results: {RECOMMENDATION_CONFIDENCE_LABELS[careerReadiness.confidence].toLowerCase()}.
          </p>
        ) : null}

        {verifiedDate ? (
          <p className="flex items-start gap-2 rounded-xl bg-success-light px-3 py-2 text-xs font-medium text-success">
            <BadgeCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Counsellor verified on {verifiedDate}.
          </p>
        ) : null}
      </div>
    </section>
  );
}
