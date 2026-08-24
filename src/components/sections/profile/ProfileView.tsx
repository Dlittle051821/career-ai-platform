"use client";

import { useRouter } from "next/navigation";
import { ReviewStep } from "./onboarding/steps/ReviewStep";
import type { OnboardingDraftState } from "./onboarding/onboarding-types";
import type { CompletionResult } from "@/types/student-profile";

interface ProfileViewProps {
  draft: OnboardingDraftState;
  completion: CompletionResult;
}

/**
 * Read/edit surface for `/profile`. Reuses the same `ReviewStep` the
 * onboarding wizard's last step renders (per Milestone 3's "reuse existing
 * components" constraint) — the only difference here is that "Edit" sends
 * the student to `/profile/onboarding?step=N` instead of jumping within an
 * in-memory wizard, since this page has no wizard session of its own.
 */
export function ProfileView({ draft, completion }: ProfileViewProps) {
  const router = useRouter();

  return (
    <ReviewStep
      draft={draft}
      completion={completion}
      onEditSection={(step) => router.push(`/profile/onboarding?step=${step}`)}
    />
  );
}
