import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";

/** UX08 — route-level loading state for /applications. See src/app/(site)/pricing/loading.tsx for the skeleton convention this mirrors. */
export default function ApplicationsLoading() {
  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div aria-hidden="true" className="mb-8 max-w-2xl animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-border" />
        <div className="h-9 w-72 rounded bg-border" />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your applications…
      </p>
      <div aria-hidden="true" className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="!p-4 animate-pulse sm:!p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="w-2/3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-surface-alt" />
                <div className="h-3 w-1/3 rounded bg-surface-alt" />
              </div>
              <div className="h-6 w-24 rounded-full bg-surface-alt" />
            </div>
            <div className="mt-3 h-10 w-full rounded bg-surface-alt" />
          </Card>
        ))}
      </div>
    </Section>
  );
}
