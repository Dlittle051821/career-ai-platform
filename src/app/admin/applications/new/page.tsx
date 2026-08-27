import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ApplicationForm } from "@/components/admin/applications/ApplicationForm";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCourseOptions } from "@/lib/supabase/admin/courses";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { createApplicationAction } from "../actions";

export const metadata: Metadata = { title: "New Application" };

export default async function NewApplicationPage() {
  const [universityOptions, courseOptions, counsellorOptions] = await Promise.all([
    listUniversityOptions(),
    listCourseOptions(),
    listCounsellorOptions(),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to applications
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Applications</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New application</h1>
      </div>
      <ApplicationForm
        action={createApplicationAction}
        universityOptions={universityOptions}
        courseOptions={courseOptions}
        counsellorOptions={counsellorOptions}
        submitLabel="Create application"
      />
    </div>
  );
}
