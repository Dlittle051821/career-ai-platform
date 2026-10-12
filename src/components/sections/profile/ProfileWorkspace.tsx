"use client";

import Image from "next/image";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import type { ProfileSectionKey, SectionProvenance } from "@/types/profile-provenance";
import type { RecommendationReadiness } from "@/types/recommendation-readiness";
import { useProfileWizard } from "./onboarding/useProfileWizard";
import { ProfileSummaryCard } from "./ProfileSummaryCard";
import { ProfileSectionNav } from "./ProfileSectionNav";
import { ProfileFormPanel } from "./ProfileFormPanel";
import { ProfileWhyItMatters } from "./ProfileWhyItMatters";
import { ProfileReadinessCard } from "./ProfileReadinessCard";
import { ProfileCounsellorCard } from "./ProfileCounsellorCard";

interface ProfileWorkspaceProps {
  initialSnapshot: StudentProfileSnapshot;
  initialStep?: number;
  fullName: string | null;
  email: string | null;
  joinedAt: string | null;
  provenanceMap: Record<ProfileSectionKey, SectionProvenance> | null;
  careerReadiness: RecommendationReadiness | null;
}

/**
 * UX10-P01 — the real `/profile` page's client-side workspace: header band,
 * profile summary card, and the 3-column (section nav / active form /
 * context cards) layout, all driven by `useProfileWizard()` — the exact
 * same real save/validation/navigation logic `/profile/onboarding` uses
 * (see `useProfileWizard.tsx`'s own docblock). This component owns no
 * business logic of its own; it is presentation composed around the
 * shared hook and the server-fetched, read-mostly props (profile identity,
 * provenance, recommendation readiness) passed down from `page.tsx`.
 *
 * Mobile order follows the brief's own specified sequence exactly (DOM
 * order, no CSS reordering needed): header -> summary -> section selector
 * -> active form -> Why This Matters -> Profile Readiness -> Counsellor
 * Verified. At `lg:` (1024px, matching `/dashboard`'s own sidebar
 * breakpoint) the section nav and form sit side by side with the context
 * cards stacked below; at `xl:` (1280px) all three become a true 3-column
 * row — the same "give the real breakpoint genuinely enough room" lesson
 * UX10-D01 learned the hard way (see its own Profile Completeness/Next
 * Best Action breakpoint fix) applied here before any bug has to be found.
 */
export function ProfileWorkspace({ initialSnapshot, initialStep, fullName, email, joinedAt, provenanceMap, careerReadiness }: ProfileWorkspaceProps) {
  const wizard = useProfileWizard({ initialSnapshot, initialStep });
  const { draft, step, completion } = wizard;

  return (
    <div className="flex flex-col">
      {/* Header band — subtle, fades into the normal workspace background rather than a large hero banner, per the brief's own section 6. */}
      <div className="relative -mx-4 -mt-6 overflow-hidden sm:-mx-6 sm:-mt-8 lg:-mx-10">
        <div className="absolute inset-0" aria-hidden="true">
          {/* `public/profile/profile-hero-bg.png` (cropped from the
              reference mockup itself) has the mockup's own title/search/
              avatar chrome baked into the same flat image — using it here
              would show a faint duplicate of this page's real header
              behind the real one. It's kept on disk since it's a provided
              asset, but this reuses the same already-approved, chrome-free
              campus photograph `/dashboard`'s own greeting band already
              uses (UX10-D01), which is the honest "reuse an approved real
              asset" substitution this project has used before when a
              provided image wasn't directly usable as-is. */}
          <Image src="/hero/campus-sky-backdrop.png" alt="" fill priority sizes="100vw" className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/70 to-background" />
        </div>
        <div className="relative px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:px-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Student Digital Profile</p>
          <h1 className="mt-2 font-sans text-3xl font-semibold text-text sm:text-4xl">Your Profile</h1>
          <p className="mt-2 max-w-2xl text-text-soft">
            Build a complete profile to get personalised recommendations for your global future.
          </p>
        </div>
      </div>

      <ProfileSummaryCard
        fullName={fullName}
        email={email}
        city={draft.aboutYou.city}
        state={draft.aboutYou.state}
        country={draft.aboutYou.country || "India"}
        joinedAt={joinedAt}
        bioText={draft.careerGoals.lifeGoalsText}
        completion={completion}
        careerReadiness={careerReadiness}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] xl:grid-cols-12">
        <div className="xl:col-span-3">
          <ProfileSectionNav completion={completion} activeStep={step} onSelect={wizard.goToStep} />
        </div>

        <div className="xl:col-span-6">
          <ProfileFormPanel wizard={wizard} />
        </div>

        <div className="space-y-6 lg:col-span-2 xl:col-span-3">
          <ProfileWhyItMatters step={step} />
          <ProfileReadinessCard draft={draft} completion={completion} />
          <ProfileCounsellorCard provenanceMap={provenanceMap} />
        </div>
      </div>
    </div>
  );
}
