"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, Globe2, Columns3, ListChecks, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { Badge } from "@/components/ui/Badge";
import { RecommendationCard } from "./RecommendationCard";
import { NextBestActionCard } from "@/components/dashboard/NextBestActionCard";
import type { RecommendationResult } from "@/lib/recommendations";
import type { NextBestAction } from "@/lib/dashboard/next-best-action";
import {
  RECOMMENDATION_TYPE_LABELS,
  READINESS_LEVEL_LABELS,
  type RecommendationReadiness,
} from "@/types/recommendation-readiness";
import { cn } from "@/lib/utils";

/**
 * UX10-REC01 — the reference mockup's 6-tab workspace (Overview / Career
 * Paths / Courses / Countries / Compare / Next Steps). Every tab was
 * individually audited before being built (see
 * `UX10-REC01_REFERENCE_AUDIT.md` section 4) — none is a fake tab that
 * leads nowhere:
 *  - Overview and Career Paths are backed by the real career-matching
 *    engine (`getRecommendations()`), passed in as `careerResults`.
 *  - Courses and Countries have NO real ranked-recommendation engine
 *    today (`RECOMMENDATION_TYPE_HAS_ENGINE.course === false`, and there
 *    is no per-student country engine at all) — both show real readiness
 *    / real approved-destination information plus a link into the real
 *    catalogue/explorer, never a fabricated ranked card.
 *  - Compare deep-links into the real, existing `/compare` page
 *    (career-only) rather than building a second comparison UI.
 *  - Next Steps reuses the real `getNextBestAction()` output verbatim,
 *    plus each readiness type's own real `nextActions` copy.
 *
 * This is a client component only so the tab switch itself is instant —
 * every byte of data it renders was fetched server-side in
 * `src/app/recommendations/page.tsx` and passed in as props; nothing here
 * fetches, mutates, or re-derives anything.
 */

const EUROPE_APPROVED_COUNTRIES = ["Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"];

type TabKey = "overview" | "career-paths" | "courses" | "countries" | "compare" | "next-steps";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "career-paths", label: "Career Paths" },
  { key: "courses", label: "Courses" },
  { key: "countries", label: "Countries" },
  { key: "compare", label: "Compare" },
  { key: "next-steps", label: "Next Steps" },
];

export interface RecommendationsTabsProps {
  careerResults: RecommendationResult[];
  totalCareersConsidered: number;
  courseReadiness: RecommendationReadiness | null;
  nextBestAction: NextBestAction;
  nextActionsByType: { typeLabel: string; actions: string[] }[];
  compareHref: string;
}

export function RecommendationsTabs({
  careerResults,
  totalCareersConsidered,
  courseReadiness,
  nextBestAction,
  nextActionsByType,
  compareHref,
}: RecommendationsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const topCareerResults = careerResults.slice(0, 3);

  return (
    <div>
      <div role="tablist" aria-label="Recommendations sections" className="flex gap-1 overflow-x-auto rounded-full bg-surface-alt p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key ? "bg-surface text-primary shadow-soft" : "text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {topCareerResults.map((result) => (
                <RecommendationCard key={result.careerId} result={result} />
              ))}
            </div>
            {careerResults.length === 0 ? (
              <Card className="py-10 text-center text-sm text-muted">
                No career matches yet — complete more of your profile to see results here.
              </Card>
            ) : null}
            <NextBestActionCard action={nextBestAction} />
          </div>
        ) : null}

        {activeTab === "career-paths" ? (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Compared against {totalCareersConsidered} career{totalCareersConsidered === 1 ? "" : "s"} in our
              library — showing your top {careerResults.length}.
            </p>
            {careerResults.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {careerResults.map((result) => (
                  <RecommendationCard key={result.careerId} result={result} />
                ))}
              </div>
            ) : (
              <Card className="py-10 text-center text-sm text-muted">
                No career matches yet — complete more of your profile to see results here.
              </Card>
            )}
            <GuidanceNotice>
              These are structured, rules-based comparisons against the profile you&apos;ve entered — not a
              scientifically validated psychometric assessment, and not generated by an AI model. A lower-ranked
              career isn&apos;t automatically unsuitable, it&apos;s just less evidenced right now.
            </GuidanceNotice>
          </div>
        ) : null}

        {activeTab === "courses" ? (
          <div className="space-y-5">
            <Card className="flex flex-col gap-3 p-6">
              <div className="flex items-center gap-2">
                <GraduationCap aria-hidden="true" className="h-5 w-5 text-secondary-dark" />
                <h3 className="text-base font-semibold text-text">Course readiness</h3>
                {courseReadiness ? (
                  <Badge tone={courseReadiness.level === "NOT_READY" ? "neutral" : "info"}>
                    {READINESS_LEVEL_LABELS[courseReadiness.level]}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted">
                There isn&apos;t a personalised, ranked course list yet — that&apos;s real, forward-looking
                infrastructure a counsellor can already review with you, not a live feature on this page. You can
                browse the full real course catalogue any time.
              </p>
              {courseReadiness && courseReadiness.nextActions.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-text-soft">
                  {courseReadiness.nextActions.slice(0, 3).map((action) => (
                    <li key={action} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary-dark" />
                      {action}
                    </li>
                  ))}
                </ul>
              ) : null}
              <LinkButton href="/courses" variant="outline" className="mt-1 w-full sm:w-auto" trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Browse courses
              </LinkButton>
            </Card>
          </div>
        ) : null}

        {activeTab === "countries" ? (
          <div className="space-y-5">
            <Card className="flex flex-col gap-3 p-6">
              <div className="flex items-center gap-2">
                <Globe2 aria-hidden="true" className="h-5 w-5 text-secondary-dark" />
                <h3 className="text-base font-semibold text-text">Study destinations — India &amp; Europe</h3>
              </div>
              <p className="text-sm text-muted">
                There&apos;s no personalised country ranking yet, so nothing here is scored or &ldquo;recommended
                for you&rdquo; — this is the same real set of Europe destinations Nextwise currently covers, for
                you to explore at your own pace.
              </p>
              <div className="flex flex-wrap gap-2">
                {EUROPE_APPROVED_COUNTRIES.map((country) => (
                  <Badge key={country} tone="neutral">
                    {country}
                  </Badge>
                ))}
              </div>
              <LinkButton href="/study-europe" variant="outline" className="mt-1 w-full sm:w-auto" trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Explore study-in-Europe options
              </LinkButton>
            </Card>
          </div>
        ) : null}

        {activeTab === "compare" ? (
          <div className="space-y-5">
            <Card className="flex flex-col gap-3 p-6">
              <div className="flex items-center gap-2">
                <Columns3 aria-hidden="true" className="h-5 w-5 text-secondary-dark" />
                <h3 className="text-base font-semibold text-text">Compare careers side by side</h3>
              </div>
              <p className="text-sm text-muted">
                Compare uses the same real, deterministic engine as your recommendations above — career comparison
                only today, nothing fabricated for courses or universities.
              </p>
              <LinkButton href={compareHref} className="mt-1 w-full sm:w-auto" trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Open Compare
              </LinkButton>
            </Card>
          </div>
        ) : null}

        {activeTab === "next-steps" ? (
          <div className="space-y-5">
            <NextBestActionCard action={nextBestAction} />
            {nextActionsByType
              .filter((entry) => entry.actions.length > 0)
              .map((entry) => (
                <Card key={entry.typeLabel} className="flex flex-col gap-2 p-5">
                  <div className="flex items-center gap-2">
                    <ListChecks aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
                    <h3 className="text-sm font-semibold text-text">{entry.typeLabel}</h3>
                  </div>
                  <ul className="space-y-1.5 text-sm text-text-soft">
                    {entry.actions.map((action) => (
                      <li key={action} className="flex items-start gap-2">
                        <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            {nextActionsByType.every((entry) => entry.actions.length === 0) ? (
              <Card className="py-8 text-center text-sm text-muted">Nothing outstanding right now — nice work.</Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { EUROPE_APPROVED_COUNTRIES };
