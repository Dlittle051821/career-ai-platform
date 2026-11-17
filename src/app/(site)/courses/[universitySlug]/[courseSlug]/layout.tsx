import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { hasInternalCourseAccess } from "@/lib/supabase/education/university-access";
import { lookupPublicCourseBySlugPairCached } from "@/lib/supabase/education/detail-lookups";

/**
 * CC-24 — answers a genuine HTTP 404 for an unknown or unpublished course
 * (or an unpublished parent university). This check has to live here
 * rather than in page.tsx: the page renders inside ./loading.tsx's
 * Suspense boundary, after the 200 status has been sent. The not-found
 * card is ../not-found.tsx.
 */
export default async function CourseDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ universitySlug: string; courseSlug: string }> }) {
  const { universitySlug, courseSlug } = await params;
  // University Discovery V3 — a student never learns whether a programme record exists: no lookup, and a redirect to /courses before anything is streamed.
  if (!(await hasInternalCourseAccess())) redirect("/courses?moved=course");
  const lookup = await lookupPublicCourseBySlugPairCached(universitySlug, courseSlug);
  if (lookup.status === "not_found") notFound();
  return children;
}
