import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, SearchX, MapPin, Send, TriangleAlert } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, LinkButton } from "@/components/ui/Button";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { Textarea } from "@/components/forms/Textarea";
import { FreshnessBadge, humanizeEnumValue } from "@/components/sections/education/UniversityCard";
import { SaveCourseButton } from "@/components/sections/education/SaveCourseButton";
import { IntakeTracker } from "@/components/sections/education/IntakeTracker";
import {
  getPublicCourseBySlugPair,
  listPublicIntakesForCourse,
  listPublicTuitionFeesForCourse,
  listPublicAdmissionRequirementsForCourse,
  listPublicScholarshipsForCourse,
} from "@/lib/supabase/education/courses";
import { listSavedEntityIds } from "@/lib/supabase/education/saved-items";
import { listMyCourseShares } from "@/lib/supabase/education/shares";
import { listInterestedIntakeIds } from "@/lib/supabase/education/intake-interests";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { formatMoney } from "@/lib/admin/money";
import { trackEvent } from "@/lib/supabase/analytics/track";
import { shareCourseFormAction, startApplicationFormAction } from "./actions";
import { EDUCATION_VERIFICATION_STATUS_LABELS, type EducationVerificationStatus } from "@/types/education";
import type { EnglishRequirements, StandardizedTestRequirements, CourseAdmissionRequirement } from "@/types/education";
import { BRAND_NAME } from "@/config/site";

interface CourseDetailPageProps {
  params: Promise<{ universitySlug: string; courseSlug: string }>;
  searchParams: Promise<{ applyError?: string }>;
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const { universitySlug, courseSlug } = await params;
  const course = await getPublicCourseBySlugPair(universitySlug, courseSlug);
  if (!course) return { title: "Course not found" };
  return { title: `${course.name} — ${course.universityName}`, description: course.entryRequirementsSummary ?? undefined };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function verificationLabel(status: string): string {
  return EDUCATION_VERIFICATION_STATUS_LABELS[status as EducationVerificationStatus] ?? humanizeEnumValue(status);
}

function formatDuration(durationText: string | null, durationValue: number | null, durationUnit: string | null): string | null {
  if (durationText) return durationText;
  if (durationValue != null && durationUnit) return `${durationValue} ${humanizeEnumValue(durationUnit).toLowerCase()}`;
  return null;
}

function englishRequirementLines(req: EnglishRequirements | null): string[] {
  if (!req) return [];
  const lines: string[] = [];
  const labels: { key: keyof EnglishRequirements; label: string }[] = [
    { key: "ielts", label: "IELTS" },
    { key: "toefl", label: "TOEFL" },
    { key: "pte", label: "PTE" },
    { key: "duolingo", label: "Duolingo" },
  ];
  for (const { key, label } of labels) {
    const score = req[key];
    if (!score) continue;
    const parts: string[] = [];
    if (score.overall != null) parts.push(`overall ${score.overall}`);
    if (score.minComponent != null) parts.push(`min component ${score.minComponent}`);
    if (parts.length > 0) lines.push(`${label}: ${parts.join(", ")}`);
  }
  return lines;
}

function standardizedTestLines(req: StandardizedTestRequirements | null): string[] {
  if (!req) return [];
  const lines: string[] = [];
  const labels: { key: keyof StandardizedTestRequirements; label: string }[] = [
    { key: "gre", label: "GRE" },
    { key: "gmat", label: "GMAT" },
  ];
  for (const { key, label } of labels) {
    const test = req[key];
    if (!test) continue;
    const parts: string[] = [];
    if (test.required != null) parts.push(test.required ? "required" : "not required");
    if (test.minScore != null) parts.push(`min score ${test.minScore}`);
    if (parts.length > 0) lines.push(`${label}: ${parts.join(", ")}`);
  }
  return lines;
}

function groupAdmissionRequirements(requirements: CourseAdmissionRequirement[]): Map<string, CourseAdmissionRequirement[]> {
  const groups = new Map<string, CourseAdmissionRequirement[]>();
  for (const req of requirements) {
    const key = req.countryContextName ?? "General (no country specified)";
    const existing = groups.get(key) ?? [];
    existing.push(req);
    groups.set(key, existing);
  }
  return groups;
}

/**
 * Public course detail route (Milestone 9), e.g.
 * `/courses/iit-delhi/msc-computer-science`. Public like `/courses` itself
 * — the middleware doesn't gate this path. Slugs are only unique
 * per-university (see getPublicCourseBySlugPair's docblock), so this is a
 * two-segment route, never a flat `/courses/[slug]`.
 *
 * Never fills in a plausible-looking placeholder for a missing field —
 * every optional value either renders "Not available" or is omitted
 * outright, matching what getPublicCourseBySlugPair actually returns.
 */
export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { universitySlug, courseSlug } = await params;
  const { applyError } = await searchParams;
  const course = await getPublicCourseBySlugPair(universitySlug, courseSlug);

  if (!course) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <SearchX aria-hidden="true" className="h-10 w-10 text-muted" />
          <h1 className="text-lg font-semibold text-primary">We couldn&apos;t find that course</h1>
          <p className="max-w-sm text-sm text-muted">
            It may have been renamed, isn&apos;t published yet, or the link may be out of date.
          </p>
          <LinkButton href="/courses" size="sm" className="mt-2">
            Browse the Course Explorer
          </LinkButton>
        </Card>
      </Section>
    );
  }

  const profile = await getCurrentProfile();
  const isLoggedIn = profile !== null;

  void trackEvent({
    eventName: "course_viewed",
    source: "course_detail_page",
    path: `/courses/${course.universitySlug}/${course.slug}`,
    feature: "course_explorer",
    entityType: "course",
    entityId: course.id,
    properties: { universitySlug: course.universitySlug, courseSlug: course.slug },
  });

  const [intakes, tuitionFees, admissionRequirements, scholarships, savedIds, myShares, interestedIntakeIds] = await Promise.all([
    listPublicIntakesForCourse(course.id),
    listPublicTuitionFeesForCourse(course.id),
    listPublicAdmissionRequirementsForCourse(course.id),
    listPublicScholarshipsForCourse(course.id),
    isLoggedIn ? listSavedEntityIds("course") : Promise.resolve<string[]>([]),
    isLoggedIn ? listMyCourseShares() : Promise.resolve([]),
    isLoggedIn ? listInterestedIntakeIds() : Promise.resolve<string[]>([]),
  ]);

  const location = [course.city, course.countryName].filter(Boolean).join(", ");
  const lastVerifiedLabel = formatDate(course.lastVerifiedAt);
  const duration = formatDuration(course.durationText, course.durationValue, course.durationUnit);
  const englishLines = englishRequirementLines(course.englishRequirements);
  const testLines = standardizedTestLines(course.standardizedTestRequirements);
  const admissionGroups = groupAdmissionRequirements(admissionRequirements);
  const existingShare = myShares.find((s) => s.courseId === course.id) ?? null;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Course Explorer", href: "/courses" },
          { label: course.universityName, href: `/universities/${course.universitySlug}` },
          { label: course.name },
        ]}
      />

      <div className="mt-6 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {course.educationLevel ? <Badge tone="info">{humanizeEnumValue(course.educationLevel)}</Badge> : null}
            {course.deliveryMode ? <Badge tone="neutral">{humanizeEnumValue(course.deliveryMode)}</Badge> : null}
            <FreshnessBadge band={course.freshnessBand} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-primary balance sm:text-4xl">{course.name}</h1>
          <Link href={`/universities/${course.universitySlug}`} className="mt-2 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
            {course.universityName}
          </Link>
          {location ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {location}
            </p>
          ) : null}
        </div>
        <SaveCourseButton courseId={course.id} universitySlug={course.universitySlug} courseSlug={course.slug} isLoggedIn={isLoggedIn} initialSaved={savedIds.includes(course.id)} />
      </div>

      {applyError ? (
        <Card className="mb-6 flex items-center gap-2 border-error/25 bg-error-light text-sm text-error">
          <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          We couldn&apos;t start your application — please try again below.
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-primary">Overview</h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Qualification</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.qualificationTitle ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Award</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.award ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Subject / discipline</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {[course.subjectArea, course.subjectAreaDiscipline].filter(Boolean).join(" — ") || "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Duration</dt>
                <dd className="mt-1 text-sm text-text-soft">{duration ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Study pace</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.studyPace ? humanizeEnumValue(course.studyPace) : "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Teaching language</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.teachingLanguage ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Tuition category</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {course.tuitionDomesticOrInternational ? humanizeEnumValue(course.tuitionDomesticOrInternational) : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Campus</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.campusName ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Program code</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.programCode ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Tuition (list price)</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {course.tuitionAmountMinorUnits != null
                    ? `${formatMoney(course.tuitionAmountMinorUnits, course.tuitionCurrency)}${course.tuitionPeriod ? ` / ${humanizeEnumValue(course.tuitionPeriod).toLowerCase()}` : ""}`
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Application fee</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {course.applicationFeeMinorUnits != null && course.applicationFeeCurrency
                    ? formatMoney(course.applicationFeeMinorUnits, course.applicationFeeCurrency)
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Scholarships available</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {course.scholarshipsAvailable == null ? "Not available" : course.scholarshipsAvailable ? "Yes" : "No"}
                </dd>
              </div>
            </dl>

            {course.additionalFeesSummary ? <p className="mt-4 text-sm text-muted">{course.additionalFeesSummary}</p> : null}

            {course.intakePeriods.length > 0 ? (
              <div className="mt-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Intake periods</dt>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {course.intakePeriods.map((period) => (
                    <Badge key={period} tone="neutral" className="text-[11px]">
                      {period}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-4">
              {course.courseUrl ? (
                <a href={course.courseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  Course page
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {course.applicationUrl ? (
                <a href={course.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  Apply on official site
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-primary">Entry requirements</h2>
            {course.entryRequirementsSummary ? <p className="mt-2 text-sm leading-relaxed text-muted">{course.entryRequirementsSummary}</p> : null}
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Minimum academic requirement</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.minAcademicRequirement ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Work experience</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.workExperienceRequired ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Portfolio required</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.portfolioRequired == null ? "Not available" : course.portfolioRequired ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Interview required</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.interviewRequired == null ? "Not available" : course.interviewRequired ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Study gap policy</dt>
                <dd className="mt-1 text-sm text-text-soft">{course.studyGapPolicy ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Additional documents</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {course.additionalDocumentsRequired.length > 0 ? course.additionalDocumentsRequired.join(", ") : "Not available"}
                </dd>
              </div>
            </dl>

            {englishLines.length > 0 || testLines.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {englishLines.length > 0 ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">English requirements</dt>
                    <dd className="mt-1 space-y-0.5 text-sm text-text-soft">
                      {englishLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {testLines.length > 0 ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Standardized tests</dt>
                    <dd className="mt-1 space-y-0.5 text-sm text-text-soft">
                      {testLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          {admissionGroups.size > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Admission requirements by country</h2>
              <div className="mt-3 space-y-4">
                {Array.from(admissionGroups.entries()).map(([countryName, reqs]) => (
                  <div key={countryName}>
                    <p className="text-sm font-semibold text-text">{countryName}</p>
                    <div className="mt-2 space-y-2">
                      {reqs.map((req) => (
                        <div key={req.id} className="rounded-[var(--radius-control)] border border-border p-3 text-sm text-text-soft">
                          <p className="font-medium text-text">{req.acceptedQualification}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {req.minimumGrade ? <span>Min grade: {req.minimumGrade}</span> : null}
                            {req.minimumGpa != null ? <span>Min GPA: {req.minimumGpa}</span> : null}
                            {req.requiredSubjects.length > 0 ? <span>Required subjects: {req.requiredSubjects.join(", ")}</span> : null}
                            {req.languageTest ? (
                              <span>
                                {req.languageTest}
                                {req.languageTestMinScore != null ? ` ≥ ${req.languageTestMinScore}` : ""}
                              </span>
                            ) : null}
                            {req.standardizedTest ? (
                              <span>
                                {req.standardizedTest}
                                {req.standardizedTestMinScore != null ? ` ≥ ${req.standardizedTestMinScore}` : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {intakes.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Intakes</h2>
              <div className="mt-3 space-y-2">
                {intakes.map((intake) => (
                  <div key={intake.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {intake.intakeName}
                        {intake.startMonth && intake.startYear ? ` — ${intake.startMonth}/${intake.startYear}` : intake.startYear ? ` — ${intake.startYear}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        <span>Capacity: {humanizeEnumValue(intake.capacityStatus)}</span>
                        <span>Status: {humanizeEnumValue(intake.intakeStatus)}</span>
                        {intake.finalDeadline ? <span>Final deadline: {formatDate(intake.finalDeadline) ?? intake.finalDeadline}</span> : null}
                        {intake.internationalDeadline ? <span>International deadline: {formatDate(intake.internationalDeadline) ?? intake.internationalDeadline}</span> : null}
                      </div>
                    </div>
                    <IntakeTracker
                      courseIntakeId={intake.id}
                      universitySlug={course.universitySlug}
                      courseSlug={course.slug}
                      isLoggedIn={isLoggedIn}
                      initialInterested={interestedIntakeIds.includes(intake.id)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {tuitionFees.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Tuition and fees</h2>
              <p className="mt-1 text-xs text-muted">Each figure is shown in its own stated currency — amounts are never converted or combined across currencies.</p>
              <div className="mt-3 space-y-2">
                {tuitionFees.map((fee) => (
                  <div key={fee.id} className="rounded-[var(--radius-control)] border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-text">
                        {fee.academicYear} — {humanizeEnumValue(fee.studentCategory)}
                      </span>
                      <Badge tone="accent" className="text-[11px]">
                        {formatMoney(fee.amountMinorUnits, fee.currencyCode)}
                        {fee.billingPeriod ? ` / ${humanizeEnumValue(fee.billingPeriod).toLowerCase()}` : ""}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {fee.mandatoryFeesMinorUnits > 0 ? <span>Mandatory fees: {formatMoney(fee.mandatoryFeesMinorUnits, fee.currencyCode)}</span> : null}
                      {fee.estimatedLivingCostsMinorUnits != null ? (
                        <span>
                          Estimated living costs: {formatMoney(fee.estimatedLivingCostsMinorUnits, fee.currencyCode)}
                          {fee.estimatedLivingCostsPeriod ? ` / ${humanizeEnumValue(fee.estimatedLivingCostsPeriod).toLowerCase()}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {scholarships.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Scholarships for this course</h2>
              <div className="mt-3 space-y-3">
                {scholarships.map((scholarship) => (
                  <div key={scholarship.id} className="rounded-[var(--radius-control)] border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text">{scholarship.name}</p>
                      {scholarship.awardAmountMinorUnits != null && scholarship.currencyCode ? (
                        <Badge tone="success" className="text-[11px]">
                          {formatMoney(scholarship.awardAmountMinorUnits, scholarship.currencyCode)}
                        </Badge>
                      ) : null}
                    </div>
                    {scholarship.eligibility ? <p className="mt-1.5 text-sm text-muted">{scholarship.eligibility}</p> : null}
                    {scholarship.awardDescription ? <p className="mt-1 text-sm text-muted">{scholarship.awardDescription}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      {scholarship.deadline ? <span>Deadline: {formatDate(scholarship.deadline) ?? scholarship.deadline}</span> : null}
                      {scholarship.internationalEligible != null ? (
                        <span>{scholarship.internationalEligible ? "Open to international students" : "Domestic students only"}</span>
                      ) : null}
                      {scholarship.scholarshipUrl ? (
                        <a href={scholarship.scholarshipUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-secondary-dark hover:text-primary">
                          Details
                          <ExternalLink aria-hidden="true" className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {course.careerOutcomes || course.professionalAccreditation ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Outcomes and accreditation</h2>
              {course.careerOutcomes ? (
                <div className="mt-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Career outcomes</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">{course.careerOutcomes}</dd>
                </div>
              ) : null}
              {course.professionalAccreditation ? (
                <div className="mt-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Professional accreditation</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">{course.professionalAccreditation}</dd>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-primary">Start an application</h2>
            <p className="mt-2 text-sm text-muted">Begin tracking your application for this course through your {BRAND_NAME} dashboard.</p>
            {isLoggedIn ? (
              <form action={startApplicationFormAction} className="mt-3">
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="universityId" value={course.universityId} />
                <input type="hidden" name="universitySlug" value={course.universitySlug} />
                <input type="hidden" name="courseSlug" value={course.slug} />
                <Button type="submit" icon={<Send aria-hidden="true" className="h-4 w-4" />} className="w-full justify-center">
                  Start application
                </Button>
              </form>
            ) : (
              <LinkButton href={`/login?next=/courses/${course.universitySlug}/${course.slug}`} size="sm" variant="outline" className="mt-3 w-full justify-center">
                Log in to apply
              </LinkButton>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-primary">Share with your counsellor</h2>
            {existingShare ? (
              <p className="mt-2 text-sm text-success">
                You shared this course{formatDate(existingShare.createdAt) ? ` on ${formatDate(existingShare.createdAt)}` : ""}.
              </p>
            ) : null}
            {isLoggedIn ? (
              <form action={shareCourseFormAction} className="mt-3 space-y-3">
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="universitySlug" value={course.universitySlug} />
                <input type="hidden" name="courseSlug" value={course.slug} />
                <Textarea name="message" placeholder="Optional note for your counsellor…" maxLength={1000} rows={3} />
                <Button type="submit" variant="outline" className="w-full justify-center">
                  {existingShare ? "Share again" : "Share course"}
                </Button>
              </form>
            ) : (
              <LinkButton href={`/login?next=/courses/${course.universitySlug}/${course.slug}`} size="sm" variant="outline" className="mt-3 w-full justify-center">
                Log in to share
              </LinkButton>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-primary">Data source</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Verification status</dt>
                <dd className="mt-1 text-text-soft">{verificationLabel(course.verificationStatus)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Last verified</dt>
                <dd className="mt-1 text-text-soft">{lastVerifiedLabel ?? "Not available"}</dd>
              </div>
              {course.sourceUrl ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Source</dt>
                  <dd className="mt-1">
                    <a href={course.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-secondary-dark hover:text-primary">
                      View source
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-xs text-muted">
              Always confirm current fees, deadlines, and admission requirements directly with the institution before
              you act on them.
            </p>
          </Card>
        </div>
      </div>

      <GuidanceNotice className="mt-8">
        This page is a representative starter dataset entry, not an exhaustive or guaranteed-current record — see
        the verification status and last-verified date above, and confirm anything time-sensitive directly with the
        institution. Save this course to come back to it later at{" "}
        <Link href="/saved" className="font-medium underline underline-offset-2">/saved</Link>.
      </GuidanceNotice>

      <div className="mt-6">
        <Link href="/courses" className="text-sm font-semibold text-secondary-dark hover:text-primary">
          ← Back to Course Explorer
        </Link>
      </div>
    </Section>
  );
}
