import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Globe2, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getCurrentProfile, firstNameFrom } from "@/lib/supabase/profile";
import { getMyProductEntitlements } from "@/lib/products/entitlements";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { listMyInvoices } from "@/lib/supabase/payments/student-invoices";
import { listMyAgreements } from "@/lib/supabase/agreements/my-agreements";
import { PAYABLE_INVOICE_STATUSES } from "@/types/payments";
import { listSavedItems } from "@/lib/supabase/education/saved-items";
import { getUniversitiesByIds } from "@/lib/supabase/education/universities";
import { getCoursesByIds } from "@/lib/supabase/education/courses";
import { listMyApplications } from "@/lib/supabase/education/applications";
import { getMyActiveDiscoverySession } from "@/lib/supabase/discovery-sessions/book";
import { listMyRecommendationReports } from "@/lib/supabase/education/recommendation-reports";
import { getMyRecommendationReadiness } from "@/lib/supabase/recommendation-readiness";
import { getCareersForMatching } from "@/lib/supabase/careers";
import { getRecommendations, hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import { getNextBestAction } from "@/lib/dashboard/next-best-action";
import { StudentJourneyOverview } from "@/components/dashboard/StudentJourneyOverview";
import { NextBestActionCard } from "@/components/dashboard/NextBestActionCard";
import { SavedShortlistCard, type SavedPreviewItem } from "@/components/dashboard/SavedShortlistCard";
import { DiscoverySessionCard } from "@/components/dashboard/DiscoverySessionCard";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

/**
 * NW03.3 / NW05.2 — the Studio hub (`/studio`).
 *
 * The one shared landing point for a signed-in student choosing between
 * Nextwise's two independent product workspaces. The two workspace cards
 * remain deliberately equal and ungated — per AC-04 ("a student must be
 * able to use either product fully without being forced through the
 * other"), neither "Open workspace" link is hidden, disabled, or
 * reordered based on entitlement or activity.
 *
 * NW05.2 adds a real, cross-product account overview beneath the cards:
 * a "Your journey so far" snapshot (`StudentJourneyOverview` — profile
 * completion, saved items, applications, career-recommendation
 * readiness), the same "Next Best Action" guidance the Career Workspace
 * shows (`getNextBestAction()`, reused unchanged), a Saved Items preview,
 * and an optional Discovery Session / counselling entry point. Every
 * number on this page comes from a real, student-scoped Supabase query —
 * nothing here is seeded, hardcoded, or copied from the NW05 mockup's
 * illustrative "Aarav Sharma" sample data. A brand-new account simply
 * shows honest zero/empty states (e.g. "Not started", "None yet") rather
 * than a fabricated starting value — see `StudentJourneyOverview`'s own
 * docblock for why this is NOT a reuse of the Career-specific
 * `computeJourneyProgress()`/`JourneyTracker` used on `/dashboard`.
 *
 * Data-fetch shape mirrors `src/app/dashboard/page.tsx` closely (same
 * functions, same `getNextBestAction()` input shape) so the two pages can
 * never quietly disagree about what "next best action" or "readiness"
 * means — see that file's own docblock. Independent queries are run
 * concurrently to keep this page's single load bounded, per the brief's
 * "avoid expensive repeated queries" instruction.
 */
export default async function StudioHubPage() {
  const [profile, entitlements] = await Promise.all([getCurrentProfile(), getMyProductEntitlements()]);
  const firstName = firstNameFrom(profile);

  const [studentSnapshot, invoices, agreements, savedItems, applications, activeDiscoverySession, recommendationReadiness, recommendationReports] = await Promise.all([
    getStudentProfileSnapshot(),
    listMyInvoices(),
    listMyAgreements(),
    listSavedItems(),
    listMyApplications(),
    getMyActiveDiscoverySession(),
    getMyRecommendationReadiness(),
    listMyRecommendationReports(),
  ]);

  const studentCompletion = studentSnapshot
    ? calculateCompletion(studentSnapshot)
    : { percent: 0, status: "not_started" as const, sections: [] };
  const payableInvoices = invoices.filter((inv) => PAYABLE_INVOICE_STATUSES.includes(inv.status));
  const careerReadiness = recommendationReadiness?.career ?? null;

  const savedUniversityIds = savedItems.filter((i) => i.entityType === "university").map((i) => i.entityId);
  const savedCourseIds = savedItems.filter((i) => i.entityType === "course").map((i) => i.entityId);
  const [savedUniversities, savedCourses] = await Promise.all([
    getUniversitiesByIds(savedUniversityIds),
    getCoursesByIds(savedCourseIds, savedCourseIds.length),
  ]);
  const savedPreviews: SavedPreviewItem[] = [
    ...savedUniversities.map((u) => ({ key: `university-${u.id}`, label: u.name, logoUrl: u.logoUrl })),
    ...savedCourses.map((c) => ({ key: `course-${c.id}`, label: c.name, logoUrl: null })),
  ];

  // Same real "do usable recommendations actually exist right now?" check
  // used by /dashboard and /recommendations — see that page's docblock.
  // Only run when the profile has enough data to be worth matching, to
  // avoid an unnecessary careers-catalogue fetch for a brand-new account.
  const hasProfileDataForRecommendations = studentSnapshot ? hasMinimumProfileDataForRecommendations(studentSnapshot) : false;
  const careerRecommendationResults =
    studentSnapshot && hasProfileDataForRecommendations
      ? (await getRecommendations(studentSnapshot, await getCareersForMatching())).results
      : [];
  const hasUsableCareerRecommendations = careerRecommendationResults.length > 0;

  const nextBestAction = getNextBestAction({
    profileStatus: studentCompletion.status,
    profilePercent: studentCompletion.percent,
    payableInvoiceCount: payableInvoices.length,
    pendingSignatureAgreement: agreements.find((a) => a.signatureStatus === "pending_signature"),
    careerReadiness,
    hasUsableCareerRecommendations,
    hasActiveDiscoverySession: Boolean(activeDiscoverySession),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-2 text-base text-muted">
          Nextwise runs two independent workspaces. Pick one — you can always switch, and using one never requires the other.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link href="/studio/career" className="group block">
          <Card className="flex h-full flex-col transition-shadow group-hover:shadow-soft">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Compass aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-primary">Career Intelligence</h2>
              {entitlements.hasCareerEntitlement ? <Badge tone="success">Active plan</Badge> : null}
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              Your career discovery, applications, counselling, and recommendations — the existing Nextwise dashboard.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark">
              Open workspace
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>

        <Link href="/studio/abroad" className="group block">
          <Card className="flex h-full flex-col transition-shadow group-hover:shadow-soft">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Globe2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-primary">Nextwise Abroad</h2>
              {entitlements.hasAbroadEntitlement ? <Badge tone="success">Active plan</Badge> : null}
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              Your study-abroad workspace — saved countries and courses, with more to come.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark">
              Open workspace
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>
      </div>

      <StudentJourneyOverview
        profilePercent={studentCompletion.percent}
        profileStatus={studentCompletion.status}
        savedItemCount={savedItems.length}
        applicationCount={applications.length}
        careerReadinessLevel={careerReadiness?.level ?? null}
      />

      <NextBestActionCard action={nextBestAction} />

      <div className="grid gap-6 sm:grid-cols-2">
        <SavedShortlistCard count={savedItems.length} previews={savedPreviews} />
        <DiscoverySessionCard session={activeDiscoverySession} />
      </div>

      {/* NW07.6 — surfaced only once there's something to see: counsellor-authored, independently-reviewed guidance, distinct from the AI/engine-based career matches above. */}
      {recommendationReports.length > 0 ? (
        <Link href="/studio/recommendation-reports" className="group block">
          <Card className="flex items-center justify-between gap-3 transition-shadow group-hover:shadow-soft">
            <div className="flex items-center gap-3">
              <FileCheck2 aria-hidden="true" className="h-5 w-5 text-secondary-dark" />
              <div>
                <p className="font-medium text-text">Recommendation Reports</p>
                <p className="text-sm text-muted">
                  {recommendationReports.length} report{recommendationReports.length === 1 ? "" : "s"} from your counsellor
                </p>
              </div>
            </div>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
