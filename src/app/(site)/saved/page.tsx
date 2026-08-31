import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, MapPin } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { FreshnessBadge, humanizeEnumValue } from "@/components/sections/education/UniversityCard";
import { getCurrentUser } from "@/lib/supabase/profile";
import { listSavedItems } from "@/lib/supabase/education/saved-items";
import { getUniversitiesByIds } from "@/lib/supabase/education/universities";
import { getCoursesByIds } from "@/lib/supabase/education/courses";
import { formatMoney } from "@/lib/admin/money";
import { removeSavedItemAction } from "./actions";
import { RemoveSavedButton } from "./RemoveSavedButton";

export const metadata: Metadata = {
  title: "Saved",
};

// Comfortably above what any real student is expected to save — this is not
// a pagination mechanism, just a safety cap on the batch lookup (see
// getCoursesByIds's docblock for why the default cap of 4 is too low here).
const SAVED_COURSES_LOOKUP_LIMIT = 100;

/**
 * The logged-in student's saved universities/courses. `/saved` is already
 * covered by PROTECTED_PATHS in src/lib/supabase/middleware.ts, so a
 * logged-out visitor is redirected before this ever renders — the redirect
 * below is defense in depth for the rare race right after logout, same
 * reasoning as src/app/(site)/profile/page.tsx's own comment.
 */
export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/saved");

  const savedItems = await listSavedItems();
  const savedUniversityIds = savedItems.filter((i) => i.entityType === "university").map((i) => i.entityId);
  const savedCourseIds = savedItems.filter((i) => i.entityType === "course").map((i) => i.entityId);

  const [universities, courses] = await Promise.all([
    getUniversitiesByIds(savedUniversityIds),
    getCoursesByIds(savedCourseIds, SAVED_COURSES_LOOKUP_LIMIT),
  ]);

  const hasNothingSaved = universities.length === 0 && courses.length === 0;
  const unavailableCount = savedUniversityIds.length + savedCourseIds.length - universities.length - courses.length;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Your account</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Saved</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Universities and courses you&apos;ve bookmarked while browsing, all in one place.
        </p>
      </div>

      {hasNothingSaved ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <Bookmark aria-hidden="true" className="h-9 w-9 text-muted" />
          <h2 className="text-base font-semibold text-primary">Nothing saved yet</h2>
          <p className="max-w-sm text-sm text-muted">
            Browse universities and courses and use the save button on any listing to keep it here for later.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <LinkButton href="/universities" size="sm">
              Browse universities
            </LinkButton>
            <LinkButton href="/courses" size="sm" variant="outline">
              Browse courses
            </LinkButton>
          </div>
        </Card>
      ) : (
        <div className="space-y-10">
          {universities.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Saved universities <span className="font-normal text-muted">({universities.length})</span>
              </h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {universities.map((university) => (
                  <Card key={university.id} as="article" className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-primary">{university.name}</h3>
                      <FreshnessBadge band={university.freshnessBand} />
                    </div>
                    {university.city || university.countryName ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {[university.city, university.countryName].filter(Boolean).join(", ")}
                      </p>
                    ) : null}
                    {university.institutionType ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone="info" className="text-[11px]">
                          {humanizeEnumValue(university.institutionType)}
                        </Badge>
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-1 items-end justify-between gap-3">
                      <Link
                        href={`/universities/${university.slug}`}
                        className="text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
                      >
                        View university
                      </Link>
                      <form action={removeSavedItemAction.bind(null, "university", university.id)}>
                        <RemoveSavedButton />
                      </form>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {courses.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Saved courses <span className="font-normal text-muted">({courses.length})</span>
              </h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <Card key={course.id} as="article" className="flex h-full flex-col">
                    <h3 className="text-lg font-semibold text-primary">{course.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {course.universityName}
                      {course.city || course.countryName ? ` · ${[course.city, course.countryName].filter(Boolean).join(", ")}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {course.educationLevel ? (
                        <Badge tone="info" className="text-[11px]">
                          {humanizeEnumValue(course.educationLevel)}
                        </Badge>
                      ) : null}
                      {course.deliveryMode ? (
                        <Badge tone="neutral" className="text-[11px]">
                          {humanizeEnumValue(course.deliveryMode)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 flex-1 text-sm text-text-soft">
                      {course.tuitionAmountMinorUnits != null
                        ? formatMoney(course.tuitionAmountMinorUnits, course.tuitionCurrency)
                        : "Tuition not available"}
                      {course.durationText ? ` · ${course.durationText}` : ""}
                    </p>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <Link
                        href={`/courses/${course.universitySlug}/${course.slug}`}
                        className="text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
                      >
                        View course
                      </Link>
                      <form action={removeSavedItemAction.bind(null, "course", course.id)}>
                        <RemoveSavedButton />
                      </form>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {unavailableCount > 0 ? (
        <p className="mt-6 text-sm text-muted">
          {unavailableCount} saved item{unavailableCount === 1 ? "" : "s"} could not be shown — the listing may have since been
          taken down or updated.
        </p>
      ) : null}

      <GuidanceNotice className="mt-8">
        This shows the current published details for what you&apos;ve saved from a representative starter dataset,
        not an exhaustive worldwide database. Always confirm current fees, deadlines, and admission requirements
        directly with the institution before you act on them.
      </GuidanceNotice>
    </Section>
  );
}
