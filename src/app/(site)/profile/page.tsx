import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { ProfileProgressBar } from "@/components/sections/profile/ProfileProgressBar";
import { ProfileView } from "@/components/sections/profile/ProfileView";
import { ProvenanceSummaryCard } from "@/components/sections/profile/ProvenanceSummaryCard";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { getMySectionProvenanceMap } from "@/lib/supabase/profile-provenance";
import { calculateCompletion } from "@/lib/profile/completion";
import { snapshotToDraft } from "@/lib/profile/draft";

export const metadata: Metadata = {
  title: "Your Profile",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Complete",
};

/**
 * The middleware already blocks logged-out visitors before this ever
 * renders (see `/profile` in `PROTECTED_PATHS`), so `snapshot` is only
 * `null` in the rare race right after registration — the redirect below is
 * defense in depth, not the primary gate.
 */
export default async function ProfilePage() {
  const [snapshot, provenanceMap] = await Promise.all([getStudentProfileSnapshot(), getMySectionProvenanceMap()]);
  if (!snapshot) redirect("/login?next=/profile");

  const draft = snapshotToDraft(snapshot);
  const completion = calculateCompletion(snapshot);

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Student Digital Profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Your Profile</h1>
          <p className="mt-2 max-w-2xl text-muted">
            This is what you&apos;ve told us so far. It&apos;s private to you, and it already shapes your career
            recommendations below. Edit any section below at any time.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <LinkButton href="/recommendations" variant="outline">
            View recommendations
          </LinkButton>
          <LinkButton href="/profile/onboarding">
            {completion.status === "completed" ? "Open in wizard" : "Continue setup"}
          </LinkButton>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Profile completion</p>
            <p className="text-sm text-muted">{completion.percent}% complete</p>
          </div>
          <span className="rounded-full bg-secondary-light px-3 py-1 text-xs font-semibold text-secondary-dark">
            {STATUS_LABEL[completion.status] ?? completion.status}
          </span>
        </div>
        <ProfileProgressBar percent={completion.percent} className="mt-3" />
      </Card>

      {provenanceMap && <ProvenanceSummaryCard provenanceMap={provenanceMap} />}

      <ProfileView draft={draft} completion={completion} />

      <DemoNotice className="mt-8">
        University recommendations and roadmap content are still illustrative demo data. Your profile itself, and
        the career recommendations built from it at <Link href="/recommendations" className="font-medium underline underline-offset-2">/recommendations</Link>, are real.
      </DemoNotice>
    </Section>
  );
}
