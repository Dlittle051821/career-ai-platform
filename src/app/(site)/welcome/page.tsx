import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, Compass, Sparkles } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getStudentProfileSnapshot, getOnboardingPath } from "@/lib/supabase/student-profile";
import { trackEvent } from "@/lib/supabase/analytics/track";
import { chooseDiscoverySessionAction, chooseSelfServeAction } from "./actions";

export const metadata: Metadata = { title: "Welcome" };

/**
 * Milestone 11-B1 — the Assisted Onboarding Revision's post-registration
 * choice screen (LOCKED requirement: never a mandatory long profile form).
 * Protected via PROTECTED_PATHS (src/lib/supabase/middleware.ts); the
 * redirect below is defense in depth, matching every other protected page.
 *
 * A student who already made a choice is sent straight to /dashboard —
 * this screen is a one-time fork, not a recurring gate. Both choices (and
 * the "explore first" skip) always remain reachable afterwards from the
 * dashboard's own Counselling / Student Digital Profile cards, so nothing
 * here is a student's only path to either flow.
 */
export default async function WelcomePage() {
  const snapshot = await getStudentProfileSnapshot();
  if (!snapshot) redirect("/login?next=/welcome");

  const { onboardingPath } = await getOnboardingPath();
  if (onboardingPath) redirect("/dashboard");

  void trackEvent({
    eventName: "onboarding_choice_viewed",
    source: "welcome_page",
    path: "/welcome",
    feature: "onboarding",
    entityType: "profile",
    entityId: snapshot.profile.userId,
  });

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Welcome to NextWise</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">How would you like to start?</h1>
        <p className="mt-3 text-muted">
          There&apos;s no wrong answer here — you can always change your mind later. Either way, you can keep
          browsing careers, courses, and colleges freely whenever you like.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
        <Card className="relative flex flex-col border-2 border-secondary/40">
          <Badge tone="success" className="absolute -top-3 left-6">
            Recommended
          </Badge>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <CalendarHeart aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-primary">Book a Free NextWise Discovery Session</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Talk it through with a counsellor first. They&apos;ll ask about your goals, academics, and interests, and
            help build out your profile with you — no forms to fill in alone. Completely free, no obligation to buy
            anything.
          </p>
          <form action={chooseDiscoverySessionAction} className="mt-5">
            <Button type="submit" className="w-full justify-center">
              Book my free session
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-light text-accent-dark">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-primary">Build My Profile Myself</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Prefer to get started on your own? Fill in your Student Digital Profile at your own pace — you can save
            progress and come back anytime, and book a Discovery Session later if you change your mind.
          </p>
          <form action={chooseSelfServeAction} className="mt-5">
            <Button type="submit" variant="outline" className="w-full justify-center">
              Build my profile
            </Button>
          </form>
        </Card>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-sm">
        <Compass aria-hidden="true" className="h-4 w-4 text-muted" />
        <Link href="/dashboard" className="font-medium text-secondary-dark underline underline-offset-2">
          I&apos;ll explore first — take me to my dashboard
        </Link>
      </div>
    </Section>
  );
}
