"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/supabase/analytics/track";

/**
 * Milestone 11-B1 — records the student's Assisted Onboarding choice and
 * sends them to the matching next step. Never blocks either path on the
 * other: recording 'discovery_session' does not touch the student's actual
 * profile, and recording 'self_serve' does not book anything. A student who
 * never lands here at all (or who navigates back later) is unaffected —
 * onboarding_path staying null changes no gating anywhere in this app (see
 * docs/milestones/M11-electronic-stamping-assisted-onboarding.md).
 */
export async function recordOnboardingChoiceAction(choice: "discovery_session" | "self_serve"): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const { error } = await supabase
    .from("student_profiles")
    .update({ onboarding_path: choice, onboarding_path_chosen_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) {
    console.error("[welcome/actions] recordOnboardingChoiceAction:", error);
    // Never block the redirect on this write failing — the choice screen
    // recording a preference is a nicety, not a gate; the student must
    // still reach their chosen next step.
  }

  void trackEvent({
    eventName: choice === "discovery_session" ? "onboarding_discovery_selected" : "onboarding_self_profile_selected",
    source: "welcome_page",
    path: "/welcome",
    feature: "onboarding",
    entityType: "profile",
    entityId: user.id,
  });

  redirect(choice === "discovery_session" ? "/discovery-session/book" : "/profile/onboarding");
}

export async function chooseDiscoverySessionAction(): Promise<void> {
  await recordOnboardingChoiceAction("discovery_session");
}

export async function chooseSelfServeAction(): Promise<void> {
  await recordOnboardingChoiceAction("self_serve");
}
