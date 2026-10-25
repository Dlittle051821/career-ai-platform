import Link from "next/link";
import { FileText, Bookmark, ClipboardList, Sparkles } from "lucide-react";
import type { ProfileStatus } from "@/types/student-profile";
import { READINESS_LEVEL_LABELS, type ReadinessLevel } from "@/types/recommendation-readiness";

export interface StudentJourneyOverviewProps {
  profilePercent: number;
  profileStatus: ProfileStatus;
  savedItemCount: number;
  applicationCount: number;
  careerReadinessLevel: ReadinessLevel | null;
}

/**
 * NW05.2 — "Student Journey Overview" for the Studio hub (`/studio`).
 *
 * Four real, student-specific indicators — profile completion, saved
 * items, applications, and career recommendation readiness — each derived
 * from data this page already fetches for its other sections (no extra
 * query is run for this component). Nothing here is estimated, rounded up,
 * or shown before the underlying record exists: a brand-new account shows
 * "Not started" / "None yet" tiles, which is itself the honest empty state
 * rather than a fabricated starting percentage.
 *
 * This is deliberately NOT a reuse of `computeJourneyProgress()` /
 * `JourneyTracker` (`src/lib/dashboard/journey-progress.ts`), which models
 * the CAREER-SPECIFIC Explore→Apply funnel (career recommendations, career
 * applications). Showing that funnel on this cross-product hub would
 * misrepresent a student who only uses Nextwise Abroad as "stuck" partway
 * through a Career pipeline they never entered — see the NW05 brief's own
 * "a student must be able to use Abroad independently of Career" rule.
 * These four tiles report plain facts true regardless of which product(s)
 * the student actually uses, each linking to the real page that explains
 * it further.
 */
export function StudentJourneyOverview({
  profilePercent,
  profileStatus,
  savedItemCount,
  applicationCount,
  careerReadinessLevel,
}: StudentJourneyOverviewProps) {
  const tiles = [
    {
      key: "profile",
      icon: FileText,
      label: "Student Digital Profile",
      value: profileStatus === "not_started" ? "Not started" : `${profilePercent}% complete`,
      href: "/profile",
    },
    {
      key: "saved",
      icon: Bookmark,
      label: "Saved items",
      value: savedItemCount === 0 ? "None yet" : `${savedItemCount} saved`,
      href: "/saved",
    },
    {
      key: "applications",
      icon: ClipboardList,
      label: "Applications",
      value: applicationCount === 0 ? "Not started" : `${applicationCount} in progress`,
      href: "/applications",
    },
    {
      key: "readiness",
      icon: Sparkles,
      // Deliberately "Career recommendations", not "Recommendations" — this
      // readiness signal is career-specific (recommendation-readiness.ts's
      // `.career` entry); Abroad has no equivalent readiness signal today,
      // and this tile must not imply it does.
      label: "Career recommendations",
      value: careerReadinessLevel ? READINESS_LEVEL_LABELS[careerReadinessLevel] : "Not yet available",
      href: "/recommendations",
    },
  ] as const;

  return (
    <section aria-labelledby="journey-overview-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
      <h2 id="journey-overview-heading" className="font-sans text-lg font-semibold text-text">
        Your journey so far
      </h2>
      <p className="mt-1 text-sm text-muted">A real-time snapshot of your account — nothing here is estimated.</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.key}
              href={tile.href}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-4 transition-colors hover:border-primary/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <dt className="text-xs font-medium text-muted">{tile.label}</dt>
              <dd className="text-sm font-semibold text-text">{tile.value}</dd>
            </Link>
          );
        })}
      </dl>
    </section>
  );
}
