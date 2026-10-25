import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Globe2, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { listSavedItems } from "@/lib/supabase/education/saved-items";
import { getUniversitiesByIds } from "@/lib/supabase/education/universities";
import { getCoursesByIds } from "@/lib/supabase/education/courses";
import { listMyApplications } from "@/lib/supabase/education/applications";
import { getMyActiveDiscoverySession } from "@/lib/supabase/discovery-sessions/book";
import { isAbroadDestinationName, getAbroadDestinationPreferences } from "@/lib/abroad/scope";
import { SavedShortlistCard, type SavedPreviewItem } from "@/components/dashboard/SavedShortlistCard";
import { ApplicationsCard } from "@/components/dashboard/ApplicationsCard";
import { DiscoverySessionCard } from "@/components/dashboard/DiscoverySessionCard";
import { AbroadReadinessCard } from "@/components/abroad/AbroadReadinessCard";

export const metadata: Metadata = {
  title: "Nextwise Abroad Workspace",
  robots: { index: false, follow: false },
};

/**
 * NW03.3 / NW05.5 — `/studio/abroad`, the authenticated Abroad workspace.
 *
 * NW03.3 shipped the research tools (Country Explorer, courses/
 * universities) as real and working, and honestly labelled application
 * tracking and recommendations as not-yet-built placeholders. NW05.5
 * replaces the application-tracking placeholder with real, student-scoped
 * data — a saved shortlist, an Abroad Readiness snapshot, and real
 * applications — each filtered to Nextwise Abroad's 6 launch destinations
 * via `isAbroadDestinationName()` (`src/lib/abroad/scope.ts`), which is
 * itself always derived from the single real `EUROPE_COUNTRIES` registry.
 * Abroad-specific RECOMMENDATIONS remain honestly not-built (that engine
 * is explicitly out of this milestone's scope — see the brief's own "do
 * not implement the entire NW06 engine inside NW05" instruction) — the
 * one remaining `ComingSoon` below is for that, and that alone.
 *
 * No new database table or column was needed: saved items
 * (`education_saved_items`), applications (`get_my_applications()`, which
 * already resolves `universityCountryName`), the Student Digital Profile,
 * and the Discovery Session system all already existed — this page only
 * composes and Abroad-filters them, following the exact same reuse
 * pattern NW05.2 uses for `/studio`. See NW05_05_ABROAD_WORKSPACE.md for
 * the full reasoning, including the one real, disclosed data gap
 * (Denmark cannot be selected as a preferred destination anywhere in the
 * product today — `getAbroadDestinationPreferences()`'s own docblock).
 */
export default async function StudioAbroadPage() {
  const [studentSnapshot, savedItems, applications, activeDiscoverySession] = await Promise.all([
    getStudentProfileSnapshot(),
    listSavedItems(),
    listMyApplications(),
    getMyActiveDiscoverySession(),
  ]);

  const studentCompletion = studentSnapshot
    ? calculateCompletion(studentSnapshot)
    : { percent: 0, status: "not_started" as const, sections: [] };
  const destinationPreferences = studentSnapshot
    ? getAbroadDestinationPreferences(studentSnapshot.studyPreferences?.preferredStudyDestinations ?? [])
    : [];
  const budgetBand = studentSnapshot?.fundingPreferences?.budgetBand ?? null;

  const savedUniversityIds = savedItems.filter((i) => i.entityType === "university").map((i) => i.entityId);
  const savedCourseIds = savedItems.filter((i) => i.entityType === "course").map((i) => i.entityId);
  const [savedUniversities, savedCourses] = await Promise.all([
    getUniversitiesByIds(savedUniversityIds),
    getCoursesByIds(savedCourseIds, savedCourseIds.length),
  ]);
  const abroadSavedUniversities = savedUniversities.filter((u) => isAbroadDestinationName(u.countryName));
  const abroadSavedCourses = savedCourses.filter((c) => isAbroadDestinationName(c.countryName));
  const abroadSavedPreviews: SavedPreviewItem[] = [
    ...abroadSavedUniversities.map((u) => ({ key: `university-${u.id}`, label: u.name, logoUrl: u.logoUrl })),
    ...abroadSavedCourses.map((c) => ({ key: `course-${c.id}`, label: c.name, logoUrl: null })),
  ];
  const abroadSavedCount = abroadSavedUniversities.length + abroadSavedCourses.length;

  const abroadApplications = applications.filter((a) => isAbroadDestinationName(a.universityCountryName));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">Nextwise Abroad</h1>
        <p className="mt-2 text-base text-muted">
          Research and plan your study-abroad journey across six European countries — fully usable on its own.
        </p>
      </div>

      <DemoNotice>
        Country and course research, your saved shortlist, your Abroad Readiness snapshot, and your application
        status below all reflect your own real account — none of it is a demo. Abroad-specific recommendations are
        not built yet; see the note further down for what&apos;s coming.
      </DemoNotice>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Globe2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-primary">Country Explorer</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Compare Germany, Ireland, Netherlands, France, Sweden, and Denmark on tuition, English-taught
            programmes, admissions, and post-study options.
          </p>
          <LinkButton href="/study-europe" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Open Country Explorer
          </LinkButton>
        </div>

        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-primary">Courses & universities</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Search and save universities and courses across all seven launch destinations, including your six
            Abroad countries.
          </p>
          <LinkButton href="/courses" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Find courses
          </LinkButton>
        </div>
      </div>

      <AbroadReadinessCard
        profilePercent={studentCompletion.percent}
        profileStatus={studentCompletion.status}
        destinationPreferences={destinationPreferences}
        budgetBand={budgetBand}
        savedAbroadItemCount={abroadSavedCount}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <SavedShortlistCard count={abroadSavedCount} previews={abroadSavedPreviews} />
        <ApplicationsCard applications={abroadApplications} viewAllHref="/studio/abroad/applications" />
      </div>

      <DiscoverySessionCard session={activeDiscoverySession} activeSessionLabel="Discovery Session" />

      <ComingSoon
        title="Abroad recommendations"
        description="Personalised country and course suggestions, based on your saved items and goals. This engine is planned for a future milestone — it is not simulated here."
        className="flex-col items-start"
      />

      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface-alt p-5">
        <ClipboardList aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
        <p className="text-sm leading-relaxed text-text-soft">
          <span className="font-semibold text-primary">Also considering a career path in India? </span>
          That&apos;s a separate workspace —{" "}
          <Link href="/studio/career" className="font-medium text-secondary-dark underline underline-offset-2">
            open Career Intelligence
          </Link>
          . Using this workspace never requires it.
        </p>
      </div>
    </div>
  );
}
