import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { IntakeForm } from "@/components/admin/courses/IntakeForm";
import { getCourseIntakeById } from "@/lib/supabase/admin/education-course-intakes";
import { getCourseById } from "@/lib/supabase/admin/courses";
import { updateCourseIntakeAction } from "../actions";

interface IntakeDetailPageProps {
  params: Promise<{ id: string; intakeId: string }>;
}

export const metadata: Metadata = { title: "Edit Intake" };

export default async function IntakeDetailPage({ params }: IntakeDetailPageProps) {
  const { id, intakeId } = await params;
  const intake = await getCourseIntakeById(intakeId);
  if (!intake || intake.courseId !== id) notFound();

  const course = await getCourseById(id);
  const boundAction = updateCourseIntakeAction.bind(null, id, intakeId);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/courses/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to {course?.name ?? "course"}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Intakes</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{intake.intakeName}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(intake.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <IntakeForm action={boundAction} courseId={id} defaultValues={intake} submitLabel="Save changes" />
    </div>
  );
}
