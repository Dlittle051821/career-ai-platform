import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FreshnessBadge, humanizeEnumValue } from "@/components/sections/education/UniversityCard";
import { CompareCheckbox } from "@/components/sections/education/CompareTray";
import { formatMoney } from "@/lib/admin/money";
import type { PublicCourseSummary } from "@/lib/supabase/education/courses";

function formatDuration(course: PublicCourseSummary): string | null {
  if (course.durationText) return course.durationText;
  if (course.durationValue != null && course.durationUnit) {
    return `${course.durationValue} ${humanizeEnumValue(course.durationUnit).toLowerCase()}`;
  }
  return null;
}

function formatTuition(course: PublicCourseSummary): string {
  if (course.tuitionAmountMinorUnits == null) return "Not available";
  const amount = formatMoney(course.tuitionAmountMinorUnits, course.tuitionCurrency);
  return course.tuitionPeriod ? `${amount} / ${humanizeEnumValue(course.tuitionPeriod).toLowerCase()}` : amount;
}

/** Mirrors src/components/sections/education/UniversityCard.tsx's shape and reuses its FreshnessBadge/humanizeEnumValue helpers — a deliberate copy for the /courses results grid, not a shared abstraction across the two domains (see that file's docblock for the convention). */
export function CourseCard({ course }: { course: PublicCourseSummary }) {
  const location = [course.city, course.countryName].filter(Boolean).join(", ");
  const duration = formatDuration(course);

  return (
    <Card as="article" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <FreshnessBadge band={course.freshnessBand} />
      </div>

      <h3 className="mt-3 text-lg font-semibold text-primary">{course.name}</h3>
      <Link href={`/universities/${course.universitySlug}`} className="mt-1 text-sm font-medium text-secondary-dark hover:text-primary">
        {course.universityName}
      </Link>

      {location ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {location}
        </p>
      ) : null}

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
        {course.scholarshipsAvailable ? (
          <Badge tone="success" className="text-[11px]">
            Scholarships available
          </Badge>
        ) : null}
      </div>

      <dl className="mt-3 flex-1 space-y-1 text-sm text-text-soft">
        {duration ? (
          <div className="flex gap-1.5">
            <dt className="font-medium text-muted">Duration:</dt>
            <dd>{duration}</dd>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <dt className="font-medium text-muted">Tuition:</dt>
          <dd>{formatTuition(course)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Link
          href={`/courses/${course.universitySlug}/${course.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
        >
          View course
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        <CompareCheckbox courseId={course.id} courseName={course.name} />
      </div>
    </Card>
  );
}
