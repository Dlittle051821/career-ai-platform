import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/sections/profile/onboarding/OnboardingWizard";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";

export const metadata: Metadata = {
  title: "Build Your Profile",
};

interface OnboardingPageProps {
  searchParams: Promise<{ step?: string }>;
}

/**
 * The middleware already blocks logged-out visitors before this ever
 * renders (see `/profile` in `PROTECTED_PATHS`), so `snapshot` is only
 * `null` in the rare race right after registration — the redirect below is
 * defense in depth, not the primary gate.
 */
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const snapshot = await getStudentProfileSnapshot();
  if (!snapshot) redirect("/login?next=/profile/onboarding");

  const { step } = await searchParams;
  const parsedStep = step ? Number.parseInt(step, 10) : undefined;
  const initialStep = parsedStep && Number.isInteger(parsedStep) ? parsedStep : undefined;

  return <OnboardingWizard initialSnapshot={snapshot} initialStep={initialStep} />;
}
