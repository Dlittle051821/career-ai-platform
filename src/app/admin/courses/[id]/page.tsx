import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { getCourseById } from "@/lib/supabase/admin/courses";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { updateCourseAction } from "../actions";

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Course" };

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const [course, universityOptions] = await Promise.all([getCourseById(id), listUniversityOptions()]);
  if (!course) notFound();

  const boundAction = updateCourseAction.bind(null, id);

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
      <CourseForm action={boundAction} defaultValues={course} universityOptions={universityOptions} submitLabel="Save changes" />
    </div>
  );
}
