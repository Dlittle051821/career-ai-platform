import { Badge } from "@/components/ui/Badge";
import {
  RECOMMENDATION_TYPES,
  RECOMMENDATION_TYPE_LABELS,
  RECOMMENDATION_TYPE_HAS_ENGINE,
  READINESS_LEVEL_LABELS,
  type RecommendationReadiness,
  type RecommendationType,
  type ReadinessLevel,
} from "@/types/recommendation-readiness";
import { cn } from "@/lib/utils";

const TONE_BY_LEVEL: Record<ReadinessLevel, "neutral" | "info" | "success"> = {
  NOT_READY: "neutral",
  PRELIMINARY: "info",
  READY: "success",
  COUNSELLOR_VERIFIED: "success",
};

/**
 * UX10-REC01 — "Your Recommendation Readiness". The reference mockup
 * shows exactly 4 status chips; this product's real readiness model
 * (`src/types/recommendation-readiness.ts`, Milestone 11-C2) already has
 * exactly 4 recommendation types (`RECOMMENDATION_TYPES`) — career,
 * course, college, pathway — so the 4 chips map one-to-one onto real
 * data, not an invented count.
 *
 * Only `career` has a real ranked-recommendation engine today
 * (`RECOMMENDATION_TYPE_HAS_ENGINE`); the other three chips still show a
 * real, computed readiness level (a counsellor can assess these today
 * even without a ranking engine behind them) but their caption is
 * explicit that no ranked list exists yet for that type — never implying
 * one does.
 */
export function ReadinessOverviewChips({ readiness }: { readiness: Record<RecommendationType, RecommendationReadiness> | null }) {
  return (
    <section aria-labelledby="readiness-overview-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-6">
      <h2 id="readiness-overview-heading" className="font-sans text-base font-semibold text-text">
        Your Recommendation Readiness
      </h2>
      <p className="mt-1 text-sm text-muted">
        How much of your Student Digital Profile is in place for each kind of recommendation.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RECOMMENDATION_TYPES.map((type) => {
          const entry = readiness?.[type] ?? null;
          const level = entry?.level ?? "NOT_READY";
          const hasEngine = RECOMMENDATION_TYPE_HAS_ENGINE[type];
          return (
            <div key={type} className="flex flex-col gap-2 rounded-2xl border border-border-strong bg-surface-alt p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">{RECOMMENDATION_TYPE_LABELS[type]}</p>
                <Badge tone={TONE_BY_LEVEL[level]} className={cn(!entry && "opacity-70")}>
                  {READINESS_LEVEL_LABELS[level]}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {hasEngine
                  ? "A real, ranked match list is available once your profile has enough evidence."
                  : "Readiness only — there's no ranked list for this yet, just a plain-language sense of what's missing."}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
