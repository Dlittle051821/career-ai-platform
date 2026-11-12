import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/profile";
import { getMyApplicationByIdCached } from "@/lib/supabase/education/application-lookup-cached";

/**
 * CC-26 — answers a genuine HTTP 404 for an application that does not exist
 * or is not the signed-in student's own (the two are indistinguishable by
 * design: get_my_application() only returns the caller's rows). The check
 * lives here rather than in page.tsx because the page renders inside
 * ./loading.tsx's Suspense boundary, after the 200 status has been sent.
 * Same pattern as src/app/(site)/universities/[slug]/layout.tsx (CC-24).
 */
export default async function ApplicationDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/applications/${id}`);
  const application = await getMyApplicationByIdCached(id);
  if (!application) notFound();
  return children;
}
