import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";

/** UX08 — route-level loading state for /applications/[id]. See src/app/(site)/pricing/loading.tsx for the skeleton convention this mirrors. */
export default function ApplicationDetailLoading() {
  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <p role="status" aria-live="polite" className="sr-only">
        Loading application…
      </p>
      <div aria-hidden="true" className="animate-pulse space-y-6">
        <div className="h-4 w-40 rounded bg-border" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-border" />
            <div className="h-8 w-80 max-w-full rounded bg-border" />
          </div>
          <div className="h-6 w-28 rounded-full bg-border" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-3">
                <div className="h-5 w-32 rounded bg-surface-alt" />
                <div className="h-16 w-full rounded bg-surface-alt" />
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card className="space-y-3">
              <div className="h-5 w-24 rounded bg-surface-alt" />
              <div className="h-10 w-full rounded bg-surface-alt" />
            </Card>
          </div>
        </div>
      </div>
    </Section>
  );
}
