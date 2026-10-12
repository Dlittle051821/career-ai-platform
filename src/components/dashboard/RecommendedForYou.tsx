import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, LibraryBig } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MatchBandBadge } from "@/components/sections/recommendations/MatchBandBadge";
import type { RecommendationResult } from "@/lib/recommendations";
import { cn } from "@/lib/utils";

/**
 * UX10-D01 — "Recommended for You".
 *
 * Only Career has a real matching engine in this product today
 * (`RECOMMENDATION_TYPE_HAS_ENGINE`, src/types/recommendation-readiness.ts)
 * — Course and University have no engine and no real "match" to show, so
 * rather than fake one (or imply completing a profile would unlock a
 * match that structurally can't exist yet), those two are always an
 * honest "coming soon, browse the library instead" state. The engine
 * never exposes a numeric score to students (see RecommendationCard's own
 * docblock) — `career` below renders the same qualitative `MatchBandBadge`
 * used on /recommendations, never a percentage.
 *
 * `books.png` was one of seven assets named in this milestone's brief but
 * was not actually among the images attached with it (only six asset
 * images + the one mockup reference were attached) — see the completion
 * report. Rather than invent a new illustration (explicitly forbidden),
 * the Course card falls back to the `LibraryBig` lucide icon already used
 * for this exact "course library" concept elsewhere in this codebase
 * (the former dashboard page's own "Career Explorer" card).
 */

interface CareerRecommendationProps {
  hasProfileData: boolean;
  topResult: RecommendationResult | null;
}

export function RecommendedForYou({ career, courseHref, universityHref }: { career: CareerRecommendationProps; courseHref: string; universityHref: string }) {
  return (
    <section aria-labelledby="recommended-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="recommended-heading" className="font-sans text-lg font-semibold text-text">
            Recommended for You
          </h2>
          <p className="mt-0.5 text-sm text-muted">Based on your profile and our real career matching engine.</p>
        </div>
        <Link href="/recommendations" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-light">
          View All Recommendations
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <CareerCard {...career} />

        <ComingSoonCard
          typeLabel="Course"
          tone="info"
          icon={<LibraryBig aria-hidden="true" className="h-7 w-7" />}
          title="Course matching is coming soon"
          body="We're still building course-specific matching. Browse the full course library in the meantime."
          cta="Browse courses"
          href={courseHref}
        />

        <ComingSoonCard
          typeLabel="University"
          tone="success"
          imageSrc="/dashboard/global-education.png"
          title="University matching is coming soon"
          body="We're still building university-specific matching. Browse universities in the meantime."
          cta="Browse universities"
          href={universityHref}
        />
      </div>
    </section>
  );
}

function CareerCard({ hasProfileData, topResult }: CareerRecommendationProps) {
  if (!hasProfileData) {
    return (
      <div className="flex flex-col rounded-2xl border border-border bg-primary/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Career</Badge>
        </div>
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
          <Image src="/dashboard/compass.png" alt="" aria-hidden="true" width={56} height={56} className="opacity-60" />
          <p className="text-sm text-muted">Complete your profile to unlock personalised recommendations.</p>
        </div>
        <Link href="/profile/onboarding" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-light">
          Continue my profile
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (!topResult) {
    return (
      <div className="flex flex-col rounded-2xl border border-border bg-primary/[0.03] p-4">
        <Badge tone="neutral">Career</Badge>
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
          <Image src="/dashboard/compass.png" alt="" aria-hidden="true" width={56} height={56} className="opacity-60" />
          <p className="text-sm text-muted">Your recommendations aren&apos;t available right now — please check back shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/careers/${topResult.slug}`} className="group flex flex-col rounded-2xl border border-border bg-primary/[0.03] p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.06]">
      <div className="flex items-start justify-between gap-2">
        <Badge tone="neutral">Career</Badge>
        <Image src="/dashboard/compass.png" alt="" aria-hidden="true" width={28} height={28} />
      </div>
      <h3 className="mt-3 font-sans text-base font-semibold text-text">{topResult.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{topResult.summary}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <MatchBandBadge band={topResult.matchBand} />
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted transition-colors group-hover:text-primary" />
      </div>
    </Link>
  );
}

function ComingSoonCard({
  typeLabel,
  tone,
  icon,
  imageSrc,
  title,
  body,
  cta,
  href,
}: {
  typeLabel: string;
  tone: "info" | "success";
  icon?: React.ReactNode;
  imageSrc?: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-border bg-primary/[0.03] p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.06]">
      <div className="flex items-start justify-between gap-2">
        <Badge tone={tone}>{typeLabel}</Badge>
        {imageSrc ? (
          <Image src={imageSrc} alt="" aria-hidden="true" width={28} height={28} />
        ) : (
          <span className={cn("text-muted")}>{icon}</span>
        )}
      </div>
      <h3 className="mt-3 font-sans text-base font-semibold text-text">{title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{body}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary">
        {cta}
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-colors group-hover:text-primary-light" />
      </div>
    </Link>
  );
}
