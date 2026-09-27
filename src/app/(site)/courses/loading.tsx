import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";

/** UX07 — route-level loading state for /courses. See src/app/(site)/pricing/loading.tsx for the skeleton convention this mirrors. */
export default function CoursesLoading() {
  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div aria-hidden="true" className="mb-6 max-w-2xl animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-border" />
        <div className="h-9 w-2/3 rounded bg-border" />
        <div className="h-4 w-full rounded bg-border" />
      </div>

      <Card aria-hidden="true" className="mb-8 animate-pulse space-y-4">
        <div className="h-10 w-full rounded bg-surface-alt" />
        <div className="h-32 w-full rounded bg-surface-alt" />
      </Card>

      <p role="status" aria-live="polite" className="sr-only">
        Loading courses…
      </p>
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse space-y-3">
            <div className="h-5 w-3/4 rounded bg-surface-alt" />
            <div className="h-3 w-1/2 rounded bg-surface-alt" />
            <div className="h-3 w-2/3 rounded bg-surface-alt" />
            <div className="h-8 w-full rounded bg-surface-alt" />
          </Card>
        ))}
      </div>
    </Section>
  );
}
