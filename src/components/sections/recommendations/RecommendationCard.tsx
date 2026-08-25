import Link from "next/link";
import { ArrowRight, CircleCheck, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MatchBandBadge } from "./MatchBandBadge";
import { EVIDENCE_LEVEL_LABELS } from "@/lib/recommendations";
import type { RecommendationResult } from "@/lib/recommendations";

/**
 * One ranked career on `/recommendations`. Deliberately shows no number,
 * percentage, or raw score anywhere — only the qualitative match band,
 * evidence-coverage note, and plain-language reasons/gaps the engine
 * produced. See `src/lib/recommendations/` and
 * docs/recommendation-engine-guide.md for how those are derived.
 */
export function RecommendationCard({ result }: { result: RecommendationResult }) {
  return (
    <Card as="article" className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{result.familyName}</Badge>
          {result.isFeatured ? <Badge tone="accent">Featured</Badge> : null}
        </div>
        <MatchBandBadge band={result.matchBand} />
      </div>

      <h3 className="mt-3 text-lg font-semibold text-primary">{result.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{result.summary}</p>

      {result.reasons.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {result.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-soft">
              <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{reason.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {result.gaps.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {result.gaps.map((gap, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted">
              <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <span>{gap.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-muted">{EVIDENCE_LEVEL_LABELS[result.evidenceLevel]}.</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/careers/${result.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
        >
          View full career profile
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        <Link href={`/compare?a=${result.slug}`} className="text-sm font-medium text-muted transition-colors hover:text-primary">
          Compare
        </Link>
      </div>
    </Card>
  );
}
