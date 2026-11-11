import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { lookupPublicUniversityBySlugCached } from "@/lib/supabase/education/detail-lookups";

/**
 * CC-24 — answers a genuine HTTP 404 for an unknown, draft or unpublished
 * university. This check has to live here rather than in page.tsx: the
 * page renders inside ./loading.tsx's Suspense boundary, after the 200
 * status has been sent. The not-found card is ../not-found.tsx.
 */
export default async function UniversityDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lookup = await lookupPublicUniversityBySlugCached(slug);
  if (lookup.status === "not_found") notFound();
  return children;
}
