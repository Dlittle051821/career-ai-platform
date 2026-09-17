import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/supabase/profile";
import { listMyApplications } from "@/lib/supabase/education/applications";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { APPLICATION_BUCKET_LABELS, getApplicationBucket, type ApplicationBucket } from "@/lib/applications/application-lifecycle";

export const metadata: Metadata = {
  title: "My Applications",
};

const BUCKET_ORDER: ApplicationBucket[] = ["active", "submitted", "decision", "closed"];

/**
 * Milestone 16 — the real /applications product surface (spec §8): the
 * student's own applications grouped into the four honest buckets
 * getApplicationBucket() defines (Active/Submitted/Decision/Closed), with
 * real counts (never a vanity metric — each count is just
 * `applications.length` for that bucket) and a clear empty state. Replaces
 * the Milestone 9 read-only listing (which showed every application in one
 * flat list with no grouping and no student-facing actions) — this page is
 * still primarily a read surface; the actionable detail (advance/withdraw/
 * note) lives on /applications/[id], reached from each card.
 */
export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/applications");

  const applications = await listMyApplications();

  if (applications.length === 0) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Your account</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">My Applications</h1>
        </div>
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <ClipboardList aria-hidden="true" className="h-9 w-9 text-muted" />
          <h2 className="text-base font-semibold text-primary">No applications started yet</h2>
          <p className="max-w-sm text-sm text-muted">
            Explore courses to get started — you can start an application directly from any course page.
          </p>
          <LinkButton href="/courses" size="sm" className="mt-2">
            Start your first application
          </LinkButton>
        </Card>
      </Section>
    );
  }

  const byBucket = new Map<ApplicationBucket, typeof applications>();
  for (const bucket of BUCKET_ORDER) byBucket.set(bucket, []);
  for (const application of applications) {
    byBucket.get(getApplicationBucket(application.stage))?.push(application);
  }

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Your account</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">My Applications</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every application you&apos;ve started, grouped by where it stands, with the real deadline and next step for each.
        </p>
      </div>

      <div className="space-y-10">
        {BUCKET_ORDER.map((bucket) => {
          const items = byBucket.get(bucket) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={bucket}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-primary">
                {APPLICATION_BUCKET_LABELS[bucket]}
                <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-soft">{items.length}</span>
              </h2>
              <div className="space-y-4">
                {items.map((application) => (
                  <ApplicationCard key={application.id} application={application} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
