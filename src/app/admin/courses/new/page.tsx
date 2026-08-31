import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { createCourseAction } from "../actions";

export const metadata: Metadata = { title: "New Course" };

export default async function NewCoursePage() {
  const universityOptions = await listUniversityOptions();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/courses" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to courses
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Courses</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New course</h1>
      </div>
      <CourseForm action={createCourseAction} universityOptions={universityOptions} campusOptions={[]} submitLabel="Create course" />
    </div>
  );
}
