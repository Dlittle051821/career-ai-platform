import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";

/** UX07 — route-level loading state for /courses/[universitySlug]/[courseSlug]. See src/app/(site)/pricing/loading.tsx for the skeleton convention this mirrors. */
export default function CourseDetailLoading() {
  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <p role="status" aria-live="polite" className="sr-only">
        Loading course…
      </p>
      <div aria-hidden="true" className="animate-pulse space-y-6">
        <div className="h-4 w-64 rounded bg-border" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className="h-6 w-40 rounded-full bg-border" />
            <div className="h-9 w-96 max-w-full rounded bg-border" />
            <div className="h-4 w-56 rounded bg-border" />
          </div>
          <div className="h-10 w-32 rounded bg-border" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="space-y-3">
              <div className="h-5 w-32 rounded bg-surface-alt" />
              <div className="h-28 w-full rounded bg-surface-alt" />
            </Card>
            <Card className="space-y-3">
              <div className="h-5 w-40 rounded bg-surface-alt" />
              <div className="h-20 w-full rounded bg-surface-alt" />
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="space-y-3">
              <div className="h-5 w-28 rounded bg-surface-alt" />
              <div className="h-10 w-full rounded bg-surface-alt" />
            </Card>
          </div>
        </div>
      </div>
    </Section>
  );
}
