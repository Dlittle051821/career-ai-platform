import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { PublicationWorkflowCard } from "@/components/admin/universities/PublicationWorkflowCard";
import { IntakeForm } from "@/components/admin/courses/IntakeForm";
import { AddTuitionFeeForm } from "@/components/admin/courses/AddTuitionFeeForm";
import { AddAdmissionRequirementForm } from "@/components/admin/courses/AddAdmissionRequirementForm";
import { AddScholarshipForm } from "@/components/admin/courses/AddScholarshipForm";
import { Card } from "@/components/ui/Card";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getCourseById } from "@/lib/supabase/admin/courses";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCampusOptionsForUniversity } from "@/lib/supabase/admin/education-campuses";
import { listCountryOptions } from "@/lib/supabase/admin/education-countries";
import { listCourseIntakesForCourse } from "@/lib/supabase/admin/education-course-intakes";
import { listTuitionFeesForCourse } from "@/lib/supabase/admin/education-tuition-fees";
import { listAdmissionRequirementsForCourse } from "@/lib/supabase/admin/education-admission-requirements";
import { listScholarshipsForCourse } from "@/lib/supabase/admin/education-scholarships";
import {
  updateCourseAction,
  submitCourseForReviewAction,
  publishCourseAction,
  archiveCourseAction,
  restoreCourseToDraftAction,
} from "../actions";
import { createCourseIntakeAction, deleteCourseIntakeAction } from "./intakes/actions";
import { createTuitionFeeAction, deleteTuitionFeeAction } from "./tuition-fees/actions";
import { createAdmissionRequirementAction, deleteAdmissionRequirementAction } from "./admission-requirements/actions";
import { createCourseScholarshipAction, deleteCourseScholarshipAction } from "./scholarships/actions";

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Course" };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatIntakeStart(startMonth: number | null, startYear: number | null): string {
  const monthLabel = startMonth && startMonth >= 1 && startMonth <= 12 ? MONTH_NAMES[startMonth - 1] : null;
  if (monthLabel && startYear) return `${monthLabel} ${startYear}`;
  if (startYear) return String(startYear);
  return "—";
}

/** Amount + currency code shown together, e.g. "45000.00 EUR" — the source's own original currency, NEVER converted. */
function formatMinorAmount(minorUnits: number | null, currencyCode: string | null): string {
  if (minorUnits === null) return "—";
  const amount = (minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currencyCode ? `${amount} ${currencyCode}` : amount;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const course = await getCourseById(id);
  if (!course) notFound();

  const [universityOptions, campusOptions, countryOptions, intakes, tuitionFees, admissionRequirements, scholarships] = await Promise.all([
    listUniversityOptions(),
    listCampusOptionsForUniversity(course.universityId),
    listCountryOptions(),
    listCourseIntakesForCourse(id),
    listTuitionFeesForCourse(id),
    listAdmissionRequirementsForCourse(id),
    listScholarshipsForCourse(id),
  ]);

  const boundAction = updateCourseAction.bind(null, id);
  const submitForReviewAction = submitCourseForReviewAction.bind(null, id);
  const publishAction = publishCourseAction.bind(null, id);
  const archiveAction = archiveCourseAction.bind(null, id);
  const restoreAction = restoreCourseToDraftAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/courses" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to courses
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Courses</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{course.name}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(course.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <CourseForm action={boundAction} defaultValues={course} universityOptions={universityOptions} campusOptions={campusOptions} submitLabel="Save changes" />

      <div className="mt-6 space-y-6">
        <PublicationWorkflowCard
          status={course.publicationStatus}
          onSubmitForReview={submitForReviewAction}
          onPublish={publishAction}
          onArchive={archiveAction}
          onRestore={restoreAction}
        />

        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Intakes</h2>
            <p className="mt-1 text-sm text-muted">Enrollment intakes/cohorts for this course.</p>
          </div>

          {intakes.length === 0 ? (
            <p className="text-sm text-muted">No intakes yet.</p>
          ) : (
            <AdminTable headers={["Intake", "Start", "Priority deadline", "Final deadline", "Capacity", "Status", ""]}>
              {intakes.map((intake) => (
                <tr key={intake.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">
                    <Link href={`/admin/courses/${id}/intakes/${intake.id}`} className="hover:text-primary hover:underline">
                      {intake.intakeName}
                    </Link>
                  </Td>
                  <Td className="text-text-soft">{formatIntakeStart(intake.startMonth, intake.startYear)}</Td>
                  <Td className="text-text-soft">{intake.priorityDeadline ?? "—"}</Td>
                  <Td className="text-text-soft">{intake.finalDeadline ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={intake.capacityStatus} />
                  </Td>
                  <Td>
                    <StatusBadge status={intake.intakeStatus} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/courses/${id}/intakes/${intake.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                        Edit
                      </Link>
                      <form action={deleteCourseIntakeAction}>
                        <input type="hidden" name="intakeId" value={intake.id} />
                        <input type="hidden" name="courseId" value={id} />
                        <SubmitButton savingLabel="Deleting…">Delete</SubmitButton>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">Add intake</h3>
            <IntakeForm action={createCourseIntakeAction} courseId={id} submitLabel="Add intake" />
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Tuition &amp; fees</h2>
            <p className="mt-1 text-sm text-muted">
              Recorded in the institution&rsquo;s own original currency. Amounts are never converted or compared across records.
            </p>
          </div>

          {tuitionFees.length === 0 ? (
            <p className="text-sm text-muted">No tuition fees yet.</p>
          ) : (
            <AdminTable headers={["Category", "Amount", "Academic year", "Billing period", ""]}>
              {tuitionFees.map((fee) => (
                <tr key={fee.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">{fee.studentCategory}</Td>
                  <Td className="text-text-soft">{formatMinorAmount(fee.amountMinorUnits, fee.currencyCode)}</Td>
                  <Td className="text-text-soft">{fee.academicYear}</Td>
                  <Td className="text-text-soft">{fee.billingPeriod ? fee.billingPeriod.replace(/_/g, " ") : "—"}</Td>
                  <Td>
                    <form action={deleteTuitionFeeAction}>
                      <input type="hidden" name="tuitionFeeId" value={fee.id} />
                      <input type="hidden" name="courseId" value={id} />
                      <SubmitButton savingLabel="Deleting…">Delete</SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">Add tuition fee</h3>
            <AddTuitionFeeForm action={createTuitionFeeAction} courseId={id} />
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Admission requirements</h2>
            <p className="mt-1 text-sm text-muted">Qualification, grade, and test requirements for this course.</p>
          </div>

          {admissionRequirements.length === 0 ? (
            <p className="text-sm text-muted">No admission requirements yet.</p>
          ) : (
            <AdminTable headers={["Accepted qualification", "Minimum grade/GPA", "Language test", ""]}>
              {admissionRequirements.map((req) => (
                <tr key={req.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">{req.acceptedQualification}</Td>
                  <Td className="text-text-soft">{[req.minimumGrade, req.minimumGpa != null ? String(req.minimumGpa) : null].filter(Boolean).join(" / ") || "—"}</Td>
                  <Td className="text-text-soft">
                    {req.languageTest ? `${req.languageTest}${req.languageTestMinScore != null ? ` (min ${req.languageTestMinScore})` : ""}` : "—"}
                  </Td>
                  <Td>
                    <form action={deleteAdmissionRequirementAction}>
                      <input type="hidden" name="admissionRequirementId" value={req.id} />
                      <input type="hidden" name="courseId" value={id} />
                      <SubmitButton savingLabel="Deleting…">Delete</SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">Add admission requirement</h3>
            <AddAdmissionRequirementForm action={createAdmissionRequirementAction} courseId={id} countryOptions={countryOptions} />
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Scholarships</h2>
            <p className="mt-1 text-sm text-muted">Scholarships offered specifically for this course.</p>
          </div>

          {scholarships.length === 0 ? (
            <p className="text-sm text-muted">No scholarships yet.</p>
          ) : (
            <AdminTable headers={["Name", "Award", "Deadline", "Active", ""]}>
              {scholarships.map((s) => (
                <tr key={s.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">{s.name}</Td>
                  <Td className="text-text-soft">{formatMinorAmount(s.awardAmountMinorUnits, s.currencyCode)}</Td>
                  <Td className="text-text-soft">{s.deadline ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={s.isActive ? "active" : "inactive"} />
                  </Td>
                  <Td>
                    <form action={deleteCourseScholarshipAction}>
                      <input type="hidden" name="scholarshipId" value={s.id} />
                      <input type="hidden" name="courseId" value={id} />
                      <SubmitButton savingLabel="Deleting…">Delete</SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">Add scholarship</h3>
            <AddScholarshipForm action={createCourseScholarshipAction} courseId={id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
