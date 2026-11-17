import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Building2, ExternalLink, Lock } from "lucide-react";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { DataStatusBadge } from "@/components/sections/education/DataStatusBadge";
import { getCurrentUser } from "@/lib/supabase/profile";
import { listMySavedCourseLabels, listSavedItems } from "@/lib/supabase/education/saved-items";
import { getUniversitiesByIds } from "@/lib/supabase/education/universities";
import { getUniversityAccess } from "@/lib/supabase/education/university-access";
import { canUseUniversityDirectory } from "@/lib/education/university-discovery/access";
import { getVerifiedOffer } from "@/lib/education/university-discovery/offer";
import { UniversityDirectoryCard } from "@/components/sections/university-discovery/UniversityDirectoryCard";
import { VerifiedAccessDialog } from "@/components/sections/university-discovery/VerifiedAccessDialog";
import { removeSavedItemAction } from "./actions";
import { RemoveSavedButton } from "./RemoveSavedButton";
import { SavedCareersSection } from "@/components/career-explorer/SavedCareersSection";
import "@/styles/university-discovery.css";

export const metadata: Metadata = {
  title: "Saved",
  // M17A Step 2 — permanent, page-level noindex protection; see
  // src/app/(site)/dashboard/page.tsx's metadata comment for why this is
  // needed independent of the temporary site-wide noindex.
  robots: { index: false, follow: false },
};

interface SavedPageProps {
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Saved Items (University Discovery V3): the signed-in student's own
 * shortlist, with a Universities tab and a Courses tab.
 *
 * `/saved` is covered by PROTECTED_PATHS, and the redirect below is defence in
 * depth. Every row comes from the student's own education_saved_items rows
 * (RLS: auth.uid() = student_user_id), so one student can never see another's
 * list. University records are resolved only when the student has Verified
 * directory access; without it the page shows how many are saved and keeps
 * them locked. Nothing is ever deleted by a change of access.
 *
 * Courses: the internal course database is staff-only, so courses saved
 * earlier are listed by title with a link to the official page instead of an
 * internal course page.
 */
export default async function SavedPage({ searchParams }: SavedPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/saved");
  const { tab } = await searchParams;
  const activeTab = tab === "courses" ? "courses" : "universities";

  const [access, savedItems] = await Promise.all([getUniversityAccess(), listSavedItems()]);
  const savedUniversityIds = savedItems.filter((item) => item.entityType === "university").map((item) => item.entityId);
  const savedCourseCount = savedItems.filter((item) => item.entityType === "course").length;
  const hasAccess = canUseUniversityDirectory(access);

  const [universities, courseLabels] = await Promise.all([
    hasAccess && activeTab === "universities" ? getUniversitiesByIds(savedUniversityIds) : Promise.resolve([]),
    activeTab === "courses" && savedCourseCount > 0 ? listMySavedCourseLabels() : Promise.resolve([]),
  ]);
  const unavailableUniversities = hasAccess && activeTab === "universities" ? savedUniversityIds.length - universities.length : 0;

  return (
    <div className="ud">
      <div className="ud-wrap ud-section" style={{ paddingTop: "7rem" }}>
        <span className="ud-kicker" style={{ color: "var(--ud-blue)" }}>Your Studio</span>
        <h1 className="ud-h2" style={{ fontSize: "clamp(1.9rem,1.4rem + 1.6vw,2.5rem)", marginTop: ".5rem" }}>Saved items</h1>
        <p style={{ margin: ".9rem 0 0", maxWidth: 680, color: "var(--ud-muted)", lineHeight: 1.55 }}>
          Your shortlist, kept on your account. Only you can see it.
        </p>

        <nav className="ud-tabs" aria-label="Saved items">
          <Link href="/saved" aria-current={activeTab === "universities" ? "page" : undefined}>
            <Building2 aria-hidden="true" style={{ width: 16, height: 16 }} />
            Universities
            {savedUniversityIds.length > 0 ? <em>{savedUniversityIds.length}</em> : null}
          </Link>
          <Link href="/saved?tab=courses" aria-current={activeTab === "courses" ? "page" : undefined}>
            <BookOpen aria-hidden="true" style={{ width: 16, height: 16 }} />
            Courses
            {savedCourseCount > 0 ? <em>{savedCourseCount}</em> : null}
          </Link>
        </nav>

        {activeTab === "universities" ? (
          !hasAccess && savedUniversityIds.length > 0 ? (
            <div className="ud-lockrow">
              <i aria-hidden="true"><Lock /></i>
              <div>
                <b>Your shortlist of {savedUniversityIds.length} universit{savedUniversityIds.length === 1 ? "y is" : "ies are"} safe.</b>
                <span>Nextwise Verified is not active on your account right now, so university profiles are locked. Nothing has been deleted, and your shortlist returns as soon as access is active again.</span>
              </div>
              <VerifiedAccessDialog accessState={access} offer={getVerifiedOffer()} returnTo="/saved" triggerLabel="See how to unlock" triggerVariant="coral" />
            </div>
          ) : savedUniversityIds.length === 0 ? (
            <div className="ud-state">
              <i aria-hidden="true"><Building2 /></i>
              <h2>No universities saved yet</h2>
              <p>
                {hasAccess
                  ? "Tap the heart on any university in the directory to add it to your shortlist."
                  : "Saving universities is part of Nextwise Verified. You can explore every destination and its official portals for free."}
              </p>
              <Link href="/universities" className="ud-btn" data-variant="navy">
                {hasAccess ? "Explore universities" : "Explore destinations"}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <ul className="ud-uc-grid">
                {universities.map((university, index) => (
                  <li key={university.id}>
                    <UniversityDirectoryCard university={university} saved index={index} removeLabel canSave={access !== "admin"} />
                    <span className="sr-only">
                      <DataStatusBadge verificationStatus={university.verificationStatus} freshnessBand={university.freshnessBand} />
                    </span>
                  </li>
                ))}
              </ul>
              {unavailableUniversities > 0 ? (
                <p className="ud-src" style={{ marginTop: 16 }}>
                  {unavailableUniversities} saved universit{unavailableUniversities === 1 ? "y is" : "ies are"} not shown because the listing is no longer published. You can remove it by saving and un-saving it once it returns.
                </p>
              ) : null}
            </>
          )
        ) : savedCourseCount === 0 ? (
          <div className="ud-state">
            <i aria-hidden="true"><BookOpen /></i>
            <h2>No courses saved</h2>
            <p>Course search now happens on official public portals, where programme details, fees and deadlines are always current.</p>
            <Link href="/courses" className="ud-btn" data-variant="navy">
              Explore official course portals
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="ud-lockrow" style={{ marginBottom: "1rem" }}>
              <i aria-hidden="true"><BookOpen /></i>
              <div>
                <b>Course search has moved to official portals.</b>
                <span>The courses you saved earlier are kept below by title, each with a link to its official page. Nothing has been deleted.</span>
              </div>
              <Link href="/courses" className="ud-btn" data-variant="white">Official course portals</Link>
            </div>
            {courseLabels === null ? (
              <p className="ud-src">
                You have {savedCourseCount} saved course{savedCourseCount === 1 ? "" : "s"}. Their titles cannot be listed on this page yet; they remain on your account.
              </p>
            ) : (
              <ul className="ud-list">
                {courseLabels.map((course) => (
                  <li key={course.courseId}>
                    <div>
                      <b>{course.courseName}</b>
                      <span>{course.universityName}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {course.officialUrl ? (
                        <a href={course.officialUrl} target="_blank" rel="noopener noreferrer" className="ud-btn" data-variant="line">
                          Official page
                          <ExternalLink aria-hidden="true" />
                        </a>
                      ) : null}
                      <form action={removeSavedItemAction.bind(null, "course", course.courseId)}>
                        <RemoveSavedButton />
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {courseLabels !== null && courseLabels.length < savedCourseCount ? (
              <p className="ud-src" style={{ marginTop: 12 }}>
                {savedCourseCount - courseLabels.length} saved course{savedCourseCount - courseLabels.length === 1 ? " is" : "s are"} not listed because the record is no longer published. It remains on your account.
              </p>
            ) : null}
          </>
        )}

        <GuidanceNotice className="mt-8">
          Always confirm programmes, fees, deadlines and admission requirements on the institution&apos;s own website before you decide or apply.
        </GuidanceNotice>
        {/* Career Explorer V5: saved careers, a self-contained block that reads only career_saved_items and
            renders nothing when no career is saved. The V3 tabs and shortlist above are unchanged. */}
        <div style={{ marginTop: "3rem" }}>
          <SavedCareersSection />
        </div>
      </div>
    </div>
  );
}
