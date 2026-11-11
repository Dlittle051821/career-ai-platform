import type { ReactNode } from "react";
import { notFound } from "next/navigation";
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
  const lookup = await lookupPublicCourseBySlugPairCached(universitySlug, courseSlug);
  if (lookup.status === "not_found") notFound();
  return children;
}
