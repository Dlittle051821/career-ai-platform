import Link from "next/link";
import { X } from "lucide-react";
import { humanizeEnumValue } from "@/components/sections/education/UniversityCard";
import { formatMoney } from "@/lib/admin/money";
import type { PublicCourseDetail } from "@/lib/supabase/education/courses";
import type { EnglishRequirements } from "@/types/education";

interface CourseComparisonTableProps {
  courses: PublicCourseDetail[];
  /** One href per course, same order as `courses` — navigating there removes just that course from the comparison. */
  removeHrefs: string[];
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function formatDuration(course: PublicCourseDetail): string {
  if (course.durationText) return course.durationText;
  if (course.durationValue != null && course.durationUnit) return `${course.durationValue} ${humanizeEnumValue(course.durationUnit).toLowerCase()}`;
  return "Not available";
}

function formatTuition(course: PublicCourseDetail): string {
  if (course.tuitionAmountMinorUnits == null) return "Not available";
  const amount = formatMoney(course.tuitionAmountMinorUnits, course.tuitionCurrency);
  return course.tuitionPeriod ? `${amount} / ${humanizeEnumValue(course.tuitionPeriod).toLowerCase()}` : amount;
}

function englishOverview(req: EnglishRequirements | null): string {
  if (!req) return "Not available";
  const lines: string[] = [];
  if (req.ielts?.overall != null) lines.push(`IELTS ${req.ielts.overall}`);
  if (req.toefl?.overall != null) lines.push(`TOEFL ${req.toefl.overall}`);
  if (req.pte?.overall != null) lines.push(`PTE ${req.pte.overall}`);
  if (req.duolingo?.overall != null) lines.push(`Duolingo ${req.duolingo.overall}`);
  return lines.length > 0 ? lines.join(" / ") : "Not available";
}

interface Row {
  key: string;
  label: string;
  values: string[];
}

/**
 * Simple flat comparison table (no highlighting/matching-band scoring — see
 * src/components/sections/compare/ComparisonTable.tsx's docblock for why
 * career comparison uses a richer matrix; a course comparison is purely
 * factual field-by-field, so a plain row list is sufficient here). Each
 * course keeps its OWN stored tuitionCurrency — the tuition row never
 * converts or normalizes between two different currencies (spec
 * requirement), it just prints each course's own formatMoney() output
 * side by side.
 */
export function CourseComparisonTable({ courses, removeHrefs }: CourseComparisonTableProps) {
  const rows: Row[] = [
    { key: "university", label: "University", values: courses.map((c) => c.universityName) },
    { key: "country", label: "Country", values: courses.map((c) => c.countryName ?? "Not available") },
    { key: "level", label: "Qualification level", values: courses.map((c) => (c.educationLevel ? humanizeEnumValue(c.educationLevel) : "Not available")) },
    { key: "tuition", label: "Tuition", values: courses.map(formatTuition) },
    { key: "duration", label: "Duration", values: courses.map(formatDuration) },
    { key: "delivery", label: "Delivery mode", values: courses.map((c) => (c.deliveryMode ? humanizeEnumValue(c.deliveryMode) : "Not available")) },
    { key: "pace", label: "Study pace", values: courses.map((c) => (c.studyPace ? humanizeEnumValue(c.studyPace) : "Not available")) },
    { key: "entry", label: "Entry requirements", values: courses.map((c) => c.entryRequirementsSummary ?? "Not available") },
    { key: "english", label: "English requirement", values: courses.map((c) => englishOverview(c.englishRequirements)) },
    { key: "scholarships", label: "Scholarships available", values: courses.map((c) => (c.scholarshipsAvailable == null ? "Not available" : c.scholarshipsAvailable ? "Yes" : "No")) },
    { key: "verification", label: "Verification status", values: courses.map((c) => humanizeEnumValue(c.verificationStatus)) },
    { key: "lastVerified", label: "Last verified", values: courses.map((c) => formatDate(c.lastVerifiedAt) ?? "Not available") },
  ];

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-48 px-4 py-3 text-left align-bottom text-xs font-medium uppercase tracking-wide text-muted">
              Comparing
            </th>
            {courses.map((course, i) => (
              <th key={course.id} scope="col" className="px-4 py-3 text-left align-bottom">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/courses/${course.universitySlug}/${course.slug}`} className="font-semibold text-primary hover:text-secondary-dark">
                      {course.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">{course.universityName}</p>
                  </div>
                  {courses.length > 2 ? (
                    <Link
                      href={removeHrefs[i]}
                      aria-label={`Remove ${course.name} from comparison`}
                      className="mt-0.5 shrink-0 rounded-full p-1 text-muted hover:bg-surface-alt hover:text-error"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-4 py-2.5 text-text-soft">{row.label}</td>
              {row.values.map((value, i) => (
                <td key={i} className="px-4 py-2.5 text-text-soft">
                  {value || <span className="text-muted">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
