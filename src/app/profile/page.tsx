import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { getMySectionProvenanceMap } from "@/lib/supabase/profile-provenance";
import { getMyRecommendationReadiness } from "@/lib/supabase/recommendation-readiness";
import { ProfileWorkspace } from "@/components/sections/profile/ProfileWorkspace";

export const metadata: Metadata = {
  title: "Your Profile",
};

/**
 * UX10-P01 "STUDENT PROFILE EXACT REFERENCE IMPLEMENTATION" — the real,
 * canonical `/profile` page.
 *
 * Step 0 of this milestone's own brief required inspecting the existing
 * repository before writing any code. That audit found the canonical
 * `/profile` route already existed at `src/app/(site)/profile/page.tsx`
 * (inside the public site's route group, rendering the marketing Header/
 * Footer around a single-column read view). Per the brief's own
 * "IMPORTANT LESSON FROM D01" — never create a second app route that
 * resolves to the same URL — this page REPLACES that one; the old file is
 * deleted as part of this change (see this milestone's own completion
 * report). It lives at `src/app/profile/` (its own independent root
 * layout, `src/app/profile/layout.tsx`, mirroring `/dashboard`'s) for the
 * same reason `/dashboard` itself moved out of `(site)` in UX10-D01: this
 * page's reference is the dashboard's own navy-sidebar app shell, not the
 * public marketing chrome.
 *
 * Every data source here is real and already existed before this
 * milestone:
 *  - `getCurrentProfile()` — the real `profiles` row (name/email/join
 *    date), the same source `/dashboard`'s greeting and UserMenu use.
 *  - `getStudentProfileSnapshot()` — the real Student Digital Profile,
 *    the same 10-table fetch `/profile/onboarding` and the old `/profile`
 *    page already used.
 *  - `getMySectionProvenanceMap()` — the real per-section counsellor
 *    provenance, the same function the old `/profile` page's
 *    `ProvenanceSummaryCard` already used.
 *  - `getMyRecommendationReadiness()` — the real, already-existing
 *    readiness computation also used by `/recommendations`.
 *
 * `calculateCompletion()` is NOT called here directly — it (and the real
 * draft shape) are derived once, inside `useProfileWizard()`, from the
 * same `snapshot` passed down as `initialSnapshot`, so there is exactly
 * one real completion number live on this page at any time (brief section
 * 20's explicit "dashboard and profile completion MUST remain
 * consistent" — both ultimately call the same `calculateCompletion()`).
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const [profile, snapshot, provenanceMap, readiness, resolvedSearchParams] = await Promise.all([
    getCurrentProfile(),
    getStudentProfileSnapshot(),
    getMySectionProvenanceMap(),
    getMyRecommendationReadiness(),
    searchParams,
  ]);

  // The middleware already blocks logged-out visitors before this ever
  // renders (see `/profile` in `PROTECTED_PATHS`) — this redirect is
  // defense in depth only, same convention as every other profile route.
  if (!snapshot) redirect("/login?next=/profile");

  const requestedStep = resolvedSearchParams.step ? Number(resolvedSearchParams.step) : undefined;

  return (
    <ProfileWorkspace
      initialSnapshot={snapshot}
      initialStep={requestedStep}
      fullName={profile?.fullName ?? null}
      email={profile?.email ?? null}
      joinedAt={profile?.createdAt ?? null}
      provenanceMap={provenanceMap}
      careerReadiness={readiness?.career ?? null}
    />
  );
}
