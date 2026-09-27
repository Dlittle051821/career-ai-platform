import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";

/**
 * UX07 — route-level loading state for /universities (Next.js App Router
 * `loading.tsx`, shown automatically while the async page above streams).
 * Mirrors src/app/(site)/pricing/loading.tsx's own skeleton convention:
 * `role="status"` + `aria-live="polite"` announce loading to assistive
 * tech without spamming it once content arrives; `aria-hidden` keeps the
 * placeholder shapes themselves out of the accessibility tree.
 */
export default function UniversitiesLoading() {
  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div aria-hidden="true" className="mb-6 max-w-2xl animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-border" />
        <div className="h-9 w-2/3 rounded bg-border" />
        <div className="h-4 w-full rounded bg-border" />
      </div>

      <Card aria-hidden="true" className="mb-8 animate-pulse space-y-4">
        <div className="h-10 w-full rounded bg-surface-alt" />
        <div className="h-24 w-full rounded bg-surface-alt" />
      </Card>

      <p role="status" aria-live="polite" className="sr-only">
        Loading universities…
      </p>
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse space-y-3">
            <div className="h-10 w-10 rounded bg-surface-alt" />
            <div className="h-5 w-3/4 rounded bg-surface-alt" />
            <div className="h-3 w-1/2 rounded bg-surface-alt" />
            <div className="h-3 w-2/3 rounded bg-surface-alt" />
          </Card>
        ))}
      </div>
    </Section>
  );
}
