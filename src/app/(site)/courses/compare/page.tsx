import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { CourseComparisonTable } from "@/components/sections/education/CourseComparisonTable";
import { MAX_COMPARE_COURSES } from "@/components/sections/education/CompareTray";
import { getCoursesByIds } from "@/lib/supabase/education/courses";
import { trackEvent } from "@/lib/supabase/analytics/track";

export const metadata: Metadata = {
  title: "Compare Courses",
  description: "Compare two to four university courses side by side — tuition, duration, entry requirements, and more.",
};

const MIN_COMPARE_COURSES = 2;

interface CompareCoursesPageProps {
  searchParams: Promise<{ ids?: string }>;
}

/**
 * Milestone 9 — Course Comparison. Public, like `/courses` and
 * `/courses/[universitySlug]/[courseSlug]` — no login required to compare
 * courses factually. Selection is by course id (`?ids=uuid1,uuid2,...`),
 * not slug — unlike `/compare`'s slug-based `?a=&b=&c=` shape, since
 * getCoursesByIds() (the only lookup this page needs) takes ids, and a
 * course slug is only unique per-university anyway. Capped at
 * MAX_COMPARE_COURSES (4), matching getCoursesByIds' own default limit —
 * this page never asks for more than that cap can return.
 */
export default async function CompareCoursesPage({ searchParams }: CompareCoursesPageProps) {
  const { ids } = await searchParams;
  const rawIds = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const uniqueIds = Array.from(new Set(rawIds)).slice(0, MAX_COMPARE_COURSES);

  const courses = uniqueIds.length > 0 ? await getCoursesByIds(uniqueIds, MAX_COMPARE_COURSES) : [];
  const missingCount = uniqueIds.length - courses.length;

  if (courses.length < MIN_COMPARE_COURSES) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <PageIntro />
        <Card className="mt-6 flex flex-col items-center gap-3 py-14 text-center">
          <Scale aria-hidden="true" className="h-10 w-10 text-muted" />
          <h2 className="text-lg font-semibold text-primary">Pick at least two courses to compare</h2>
          <p className="max-w-sm text-sm text-muted">
            {uniqueIds.length > 0
              ? "One or more selected courses couldn't be found — they may have been removed or unpublished since you selected them."
              : "Browse the Course Explorer, check “Compare” on two to four courses, then use “Compare selected” to see them here."}
          </p>
          <LinkButton href="/courses" size="sm" className="mt-2">
            Browse courses
          </LinkButton>
        </Card>
      </Section>
    );
  }

  void trackEvent({
    eventName: "course_compared",
    source: "course_compare_page",
    path: "/courses/compare",
    feature: "course_compare",
    entityType: "course",
    entityId: courses[0]?.id ?? null,
    properties: { courseIds: courses.map((c) => c.id), count: courses.length },
  });

  const removeHrefs = courses.map((course) => {
    const remaining = uniqueIds.filter((id) => id !== course.id);
    return `/courses/compare?ids=${remaining.join(",")}`;
  });

  const hasMixedCurrencies = new Set(courses.map((c) => c.tuitionCurrency)).size > 1;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <PageIntro />

      {missingCount > 0 ? (
        <Card className="mt-6 border-warning/25 bg-warning-light text-sm text-warning">
          {missingCount === 1 ? "One selected course" : `${missingCount} selected courses`} couldn&apos;t be found and{" "}
          {missingCount === 1 ? "was" : "were"} left out below.
        </Card>
      ) : null}

      {hasMixedCurrencies ? (
        <Card className="mt-6 border-info/20 bg-info-light text-sm text-info">
          These courses list tuition in different currencies. Each is shown below in its own stated currency —
          amounts are never converted, so treat them as separate figures, not a directly comparable number.
        </Card>
      ) : null}

      <div className="mt-6">
        <CourseComparisonTable courses={courses} removeHrefs={removeHrefs} />
      </div>

      <GuidanceNotice className="mt-8">
        This is a factual, field-by-field comparison drawn from a representative starter dataset — not a ranking,
        recommendation, or guarantee of accuracy. Each course shows its own verification status and last-verified
        date; always confirm current fees, deadlines, and admission requirements directly with each institution
        before you act on them.
      </GuidanceNotice>
    </Section>
  );
}

function PageIntro() {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Compare</p>
      <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Compare courses side by side</h1>
      <p className="mt-2 max-w-2xl text-muted">
        See how two to four courses stack up on tuition, duration, entry requirements, and more — useful whether or
        not you&apos;re signed in.
      </p>
    </div>
  );
}
