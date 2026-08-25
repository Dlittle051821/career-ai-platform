import type { Metadata } from "next";
import Link from "next/link";
import { Compass, LibraryBig, Mail, Map, Phone, Sparkles, UserRound } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { LinkButton } from "@/components/ui/Button";
import { ProfileProgressBar } from "@/components/sections/profile/ProfileProgressBar";
import { getCurrentProfile, firstNameFrom } from "@/lib/supabase/profile";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { calculateCompletion } from "@/lib/profile/completion";

const STUDENT_PROFILE_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Complete",
};

export const metadata: Metadata = {
  title: "Dashboard",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  // No manual redirect needed here — the middleware already sends
  // logged-out visitors to /login before this page ever renders. This
  // fetch just gets the real, logged-in student's data to display.
  const profile = await getCurrentProfile();
  const firstName = firstNameFrom(profile);

  const studentSnapshot = await getStudentProfileSnapshot();
  const studentCompletion = studentSnapshot
    ? calculateCompletion(studentSnapshot)
    : { percent: 0, status: "not_started" as const, sections: [] };

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          This is your account home. Career readiness scores and personalised recommendations below are demo
          content for now — real career discovery results arrive in a later milestone.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-primary">Your account</h2>
            <Badge tone="success">Active</Badge>
          </div>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <UserRound aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Full name</dt>
                <dd className="text-sm font-medium text-text">{profile?.fullName ?? "Not set"}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Mail aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
                <dd className="text-sm font-medium text-text">{profile?.email ?? "Not set"}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Phone aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Phone</dt>
                <dd className="text-sm font-medium text-text">{profile?.phone ?? "Not set"}</dd>
              </div>
            </div>
          </dl>
        </Card>

        <Card>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-accent-dark">
            <Map aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-primary">Your roadmap</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A sample, illustrative career-to-course roadmap based on the CareerPath AI journey.
          </p>
          <LinkButton href="/roadmap" size="sm" variant="outline" className="mt-4 w-full justify-center">
            View roadmap
          </LinkButton>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <Compass aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-primary">Career discovery</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                You haven&apos;t started career discovery yet. It&apos;s the first step toward a roadmap built
                around your interests, not just your marks.
              </p>
              <LinkButton href="/career-discovery" size="sm" className="mt-4">
                Start career discovery
              </LinkButton>
            </div>
          </div>
        </Card>

        <Card>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-primary">Counselling</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            No sessions booked yet. A free first conversation is a good place to start.
          </p>
          <LinkButton href="/book-counselling" size="sm" variant="outline" className="mt-4 w-full justify-center">
            Book free counselling
          </LinkButton>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <LibraryBig aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-primary">Career Explorer</h2>
              <p className="mt-1 text-sm text-muted">
                Browse a structured library of careers — what each one involves, relevant subjects and skills, and
                common education routes. Not a personalised match yet.
              </p>
            </div>
          </div>
          <LinkButton href="/careers" size="sm" variant="outline" className="shrink-0">
            Explore careers
          </LinkButton>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <UserRound aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Student Digital Profile</h2>
                <Badge tone={studentCompletion.status === "completed" ? "success" : studentCompletion.status === "in_progress" ? "info" : "neutral"}>
                  {STUDENT_PROFILE_STATUS_LABEL[studentCompletion.status] ?? studentCompletion.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {studentCompletion.status === "not_started"
                  ? "Tell us about yourself so we can personalise your career guidance later."
                  : `${studentCompletion.percent}% complete — pick up where you left off.`}
              </p>
            </div>
          </div>
          <LinkButton
            href={studentCompletion.status === "completed" ? "/profile" : "/profile/onboarding"}
            size="sm"
            className="shrink-0"
          >
            {studentCompletion.status === "not_started"
              ? "Start my profile"
              : studentCompletion.status === "completed"
                ? "View profile"
                : "Continue profile"}
          </LinkButton>
        </div>
        <ProfileProgressBar percent={studentCompletion.percent} className="mt-4" />
      </Card>

      <DemoNotice className="mt-8">
        Career discovery status, roadmap content, and counselling activity shown here are illustrative demo data.
        Your account details above (name, email, phone) are real and stored securely. Your Student Digital Profile
        below is real and stored securely too.
      </DemoNotice>
    </Section>
  );
}
