import type { Metadata } from "next";
import Image from "next/image";
import { getCurrentProfile, firstNameFrom } from "@/lib/supabase/profile";
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
import { getMyRecommendationReadiness } from "@/lib/supabase/recommendation-readiness";
import { getCareersForMatching } from "@/lib/supabase/careers";
import { getRecommendations, hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import { getNextBestAction } from "@/lib/dashboard/next-best-action";
import { computeJourneyProgress } from "@/lib/dashboard/journey-progress";
import { getImportantDates } from "@/lib/dashboard/important-dates";
import { JourneyTracker } from "@/components/dashboard/JourneyTracker";
import { NextBestActionCard } from "@/components/dashboard/NextBestActionCard";
import { ProfileCompletenessCard } from "@/components/dashboard/ProfileCompletenessCard";
import { RecommendedForYou } from "@/components/dashboard/RecommendedForYou";
import { SavedShortlistCard, type SavedPreviewItem } from "@/components/dashboard/SavedShortlistCard";
import { ApplicationsCard } from "@/components/dashboard/ApplicationsCard";
import { DiscoverySessionCard } from "@/components/dashboard/DiscoverySessionCard";
import { ImportantDatesCard } from "@/components/dashboard/ImportantDatesCard";

export const metadata: Metadata = {
  title: "Dashboard",
  // M17A Step 2 — permanent, page-level noindex protection, carried over
  // unchanged from the page this one replaces (see this milestone's
  // layout.tsx for the full route-move rationale).
  robots: { index: false, follow: false },
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * UX10-D01 "STUDENT DASHBOARD EXACT REFERENCE IMPLEMENTATION".
 *
 * Every data call below is ported, unchanged, from the former
 * `src/app/(site)/dashboard/page.tsx` (now removed as part of this
 * milestone's route move — see `src/app/dashboard/layout.tsx`'s
 * docblock) plus the same career-recommendation fetch pattern already
 * used on `/recommendations`. No business logic was reimplemented here —
 * this page only composes real, already-existing data into the
 * reference's visual layout. See UX10-D01_REFERENCE_AUDIT.md for the
 * section-by-section mockup-vs-real-data mapping.
 */
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const firstName = firstNameFrom(profile);

  const studentSnapshot = await getStudentProfileSnapshot();
  const studentCompletion = studentSnapshot
    ? calculateCompletion(studentSnapshot)
    : { percent: 0, status: "not_started" as const, sections: [] };

  const invoices = await listMyInvoices();
  const payableInvoices = invoices.filter((inv) => PAYABLE_INVOICE_STATUSES.includes(inv.status));
  const agreements = await listMyAgreements();

  const savedItems = await listSavedItems();
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

  const applications = await listMyApplications();
  const activeDiscoverySession = await getMyActiveDiscoverySession();
  const recommendationReadiness = await getMyRecommendationReadiness();
  const careerReadiness = recommendationReadiness?.career ?? null;

  const hasProfileDataForRecommendations = studentSnapshot ? hasMinimumProfileDataForRecommendations(studentSnapshot) : false;
  const topCareerRecommendation =
    studentSnapshot && hasProfileDataForRecommendations
      ? (await getRecommendations(studentSnapshot, await getCareersForMatching())).results[0] ?? null
      : null;

  const nextBestAction = getNextBestAction({
    profileStatus: studentCompletion.status,
    profilePercent: studentCompletion.percent,
    payableInvoiceCount: payableInvoices.length,
    pendingSignatureAgreement: agreements.find((a) => a.signatureStatus === "pending_signature"),
    careerReadiness,
    hasActiveDiscoverySession: Boolean(activeDiscoverySession),
  });

  const journeyProgress = computeJourneyProgress({
    profileStatus: studentCompletion.status,
    profilePercent: studentCompletion.percent,
    careerReadinessLevel: careerReadiness?.level ?? null,
    savedItemCount: savedItems.length,
    applicationCount: applications.length,
  });

  const importantDates = getImportantDates({
    applications,
    discoverySession: activeDiscoverySession,
    payableInvoices,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting header — a subtle aspirational campus visual behind the
          greeting only (not a full hero banner), reusing the homepage's
          own already-approved campus-skyline asset rather than inventing
          new imagery for this milestone. */}
      <div className="relative -mx-4 -mt-6 overflow-hidden rounded-b-[1.5rem] px-4 pb-6 pt-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:-mt-8 lg:px-10 lg:pb-8 lg:pt-8">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image src="/hero/campus-sky-backdrop.png" alt="" fill priority className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
        </div>
        <h1 className="font-sans text-2xl font-semibold text-text sm:text-3xl">
          {greeting()}, {firstName} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted sm:text-base">Let&apos;s make today another step towards your global future.</p>
      </div>

      <JourneyTracker progress={journeyProgress} />

      {/* The two-column Next Best Action / Profile Completeness split only
          has room at xl: (>=1280px) — Profile Completeness's own checklist
          needs two un-cramped columns, which a narrower lg: (1024px) share
          of this split doesn't leave room for (see the 1024px QA pass in
          UX10-D01_COMPLETION_REPORT.md). At 1024px these stack full-width
          instead, matching the brief's own "1024: cards may stack"
          allowance. */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <NextBestActionCard action={nextBestAction} />
        </div>
        <div className="xl:col-span-2">
          <ProfileCompletenessCard completion={studentCompletion} />
        </div>
      </div>

      <RecommendedForYou
        career={{ hasProfileData: hasProfileDataForRecommendations, topResult: topCareerRecommendation }}
        courseHref="/courses"
        universityHref="/universities"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <SavedShortlistCard count={savedItems.length} previews={savedPreviews} />
        <ApplicationsCard applications={applications} />
        <DiscoverySessionCard session={activeDiscoverySession} />
        <ImportantDatesCard items={importantDates} />
      </div>
    </div>
  );
}
