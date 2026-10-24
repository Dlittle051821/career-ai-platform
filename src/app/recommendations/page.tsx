import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Compass, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentProfile, firstNameFrom } from "@/lib/supabase/profile";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { listMyInvoices } from "@/lib/supabase/payments/student-invoices";
import { listMyAgreements } from "@/lib/supabase/agreements/my-agreements";
import { PAYABLE_INVOICE_STATUSES } from "@/types/payments";
import { listSavedItems } from "@/lib/supabase/education/saved-items";
import { getUniversitiesByIds } from "@/lib/supabase/education/universities";
import { getCoursesByIds } from "@/lib/supabase/education/courses";
import { getMyActiveDiscoverySession } from "@/lib/supabase/discovery-sessions/book";
import { getCareersForMatching } from "@/lib/supabase/careers";
import { getRecommendations, hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import { getMyRecommendationReadiness } from "@/lib/supabase/recommendation-readiness";
import { getNextBestAction } from "@/lib/dashboard/next-best-action";
import { RECOMMENDATION_TYPE_LABELS, RECOMMENDATION_TYPES } from "@/types/recommendation-readiness";
import { trackEvent } from "@/lib/supabase/analytics/track";
import { RecommendationsHero } from "@/components/sections/recommendations/RecommendationsHero";
import { ReadinessOverviewChips } from "@/components/sections/recommendations/ReadinessOverviewChips";
import { RecommendationsTabs } from "@/components/sections/recommendations/RecommendationsTabs";
import { ProfileAtAGlanceCard } from "@/components/sections/recommendations/ProfileAtAGlanceCard";
import { RecommendationInsightsCard } from "@/components/sections/recommendations/RecommendationInsightsCard";
import { NextBestActionSidebarCard } from "@/components/sections/recommendations/NextBestActionSidebarCard";
import { SavedShortlistCard, type SavedPreviewItem } from "@/components/dashboard/SavedShortlistCard";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";

export const metadata: Metadata = {
  title: "Recommendations",
  description: "Careers, courses, and study destinations matched against your Student Digital Profile, with plain-language reasons for each match.",
  robots: { index: false, follow: false },
};

/**
 * UX10-REC01 "RECOMMENDATIONS EXPERIENCE REDESIGN" — the real, canonical
 * `/recommendations` page, now composed into the reference mockup's
 * dashboard-style workspace (left app nav via `DashboardShell` in this
 * route's own `layout.tsx`, greeting hero, readiness overview, 6-tab
 * body, right-hand sidebar) while keeping every data source exactly what
 * it already was (Milestone 5's real recommendation engine, Milestone
 * 11-C2's real readiness model, the real saved-items/compare/next-best-
 * action systems). See `UX10-REC01_REFERENCE_AUDIT.md` for the full
 * section-by-section mapping and every deliberate deviation from the
 * mockup (no match percentages, no fabricated course/country rankings,
 * no fabricated saved career, no unconditional counsellor-verified
 * framing).
 *
 * Protected via `PROTECTED_PATHS` in `src/lib/supabase/middleware.ts`;
 * the `redirect` below is defense in depth, matching `/profile`'s own
 * pattern.
 */
export default async function RecommendationsPage() {
  const [profile, snapshot] = await Promise.all([getCurrentProfile(), getStudentProfileSnapshot()]);
  if (!snapshot) redirect("/login?next=/recommendations");

  const firstName = firstNameFrom(profile);
  const completion = calculateCompletion(snapshot);

  const [invoices, agreements, savedItems, activeDiscoverySession, allReadiness] = await Promise.all([
    listMyInvoices(),
    listMyAgreements(),
    listSavedItems(),
    getMyActiveDiscoverySession(),
    getMyRecommendationReadiness(),
  ]);

  const payableInvoices = invoices.filter((inv) => PAYABLE_INVOICE_STATUSES.includes(inv.status));
  const careerReadiness = allReadiness?.career ?? null;

  const savedUniversityIds = savedItems.filter((i) => i.entityType === "university").map((i) => i.entityId);
  const savedCourseIds = savedItems.filter((i) => i.entityType === "course").map((i) => i.entityId);
  const [savedUniversities, savedCourses] = await Promise.all([
    getUniversitiesByIds(savedUniversityIds),
    getCoursesByIds(savedCourseIds, savedCourseIds.length || 1),
  ]);
  const savedPreviews: SavedPreviewItem[] = [
    ...savedUniversities.map((u) => ({ key: `university-${u.id}`, label: u.name, logoUrl: u.logoUrl })),
    ...savedCourses.map((c) => ({ key: `course-${c.id}`, label: c.name, logoUrl: null })),
  ];

  const nextActionsByType = RECOMMENDATION_TYPES.map((type) => ({
    typeLabel: `${RECOMMENDATION_TYPE_LABELS[type]} next steps`,
    actions: allReadiness?.[type]?.nextActions.slice(0, 3) ?? [],
  }));

  const hasProfileData = hasMinimumProfileDataForRecommendations(snapshot);

  if (!hasProfileData) {
    return (
      <div className="flex flex-col gap-6">
        <RecommendationsHero firstName={firstName} />
        <ReadinessOverviewChips readiness={allReadiness} />
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <Compass aria-hidden="true" className="h-10 w-10 text-muted" />
          <h2 className="text-lg font-semibold text-primary">Your profile needs a bit more first</h2>
          <p className="max-w-md text-sm text-muted">
            Recommendations compare your Student Digital Profile against our career library — the more of it you
            fill in, the more useful and reliable your results will be.
          </p>
          {careerReadiness && careerReadiness.nextActions.length > 0 ? (
            <ul className="max-w-md space-y-1.5 text-left text-sm text-text-soft">
              {careerReadiness.nextActions.slice(0, 4).map((action) => (
                <li key={action} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary-dark" />
                  {action}
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-md text-sm text-muted">
              Add at least a couple of subject strengths, interests, or skills to get started.
            </p>
          )}
          <LinkButton href="/profile/onboarding" className="mt-2 w-full sm:w-auto">
            Continue your profile
          </LinkButton>
        </Card>
      </div>
    );
  }

  const careers = await getCareersForMatching();

  if (careers.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <RecommendationsHero firstName={firstName} />
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <TriangleAlert aria-hidden="true" className="h-10 w-10 text-muted" />
          <h2 className="text-lg font-semibold text-primary">Recommendations aren&apos;t available right now</h2>
          <p className="max-w-md text-sm text-muted">
            We couldn&apos;t load the career library just now. Please try again in a moment — your profile data is
            safe and nothing here depends on it.
          </p>
        </Card>
      </div>
    );
  }

  const { results, totalCareersConsidered } = getRecommendations(snapshot, careers);

  // NW01 Part D/F — moved below `results` (was computed earlier, before
  // the catalogue-availability check above) specifically so it can pass
  // the same real `hasUsableCareerRecommendations` signal
  // `src/app/dashboard/page.tsx` now also passes — both pages' Next Best
  // Action can never disagree about whether recommendations are
  // genuinely ready, because both derive it from this exact
  // `getRecommendations()` call's own result, not from readiness level
  // alone.
  const nextBestAction = getNextBestAction({
    profileStatus: completion.status,
    profilePercent: completion.percent,
    payableInvoiceCount: payableInvoices.length,
    pendingSignatureAgreement: agreements.find((a) => a.signatureStatus === "pending_signature"),
    careerReadiness,
    hasUsableCareerRecommendations: results.length > 0,
    hasActiveDiscoverySession: Boolean(activeDiscoverySession),
  });

  void trackEvent({
    eventName: "career_recommendations_generated",
    source: "recommendations_page",
    path: "/recommendations",
    feature: "recommendations",
    entityType: "profile",
    entityId: snapshot.profile.userId || null,
    properties: { careersConsidered: totalCareersConsidered, resultsCount: results.length },
  });

  const compareHref = results.length >= 2 ? `/compare?a=${results[0].slug}&b=${results[1].slug}` : "/compare";

  return (
    <div className="flex flex-col gap-6">
      <RecommendationsHero firstName={firstName} />
      <ReadinessOverviewChips readiness={allReadiness} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <RecommendationsTabs
            careerResults={results}
            totalCareersConsidered={totalCareersConsidered}
            courseReadiness={allReadiness?.course ?? null}
            nextBestAction={nextBestAction}
            nextActionsByType={nextActionsByType}
            compareHref={compareHref}
          />
        </div>

        <div className="flex flex-col gap-6">
          <ProfileAtAGlanceCard
            fullName={profile?.fullName ?? null}
            email={profile?.email ?? null}
            city={snapshot.profile.city}
            state={snapshot.profile.state}
            country={snapshot.profile.country}
            completion={completion}
          />
          <RecommendationInsightsCard topResult={results[0] ?? null} careerReadiness={careerReadiness} />
          <GuidanceNotice>
            These are structured, rules-based comparisons against the profile you&apos;ve entered — not a
            scientifically validated psychometric assessment, and not generated by an AI model. Salary, outlook, and
            other career details are curated heuristics, not guarantees. Use this as a starting point for exploring
            options, not a final decision.
          </GuidanceNotice>
          <NextBestActionSidebarCard action={nextBestAction} />
          <SavedShortlistCard count={savedItems.length} previews={savedPreviews} />
        </div>
      </div>
    </div>
  );
}
