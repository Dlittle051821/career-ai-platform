import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";

/**
 * Route-level loading state for /pricing (Next.js App Router `loading.tsx`
 * — automatically shown while the async server component above streams).
 * `role="status"` + `aria-live="polite"` announce the loading state to
 * assistive tech without spamming it once content arrives; `aria-hidden` on
 * the skeleton shapes themselves keeps their empty placeholder text out of
 * the accessibility tree.
 */
export default function PricingLoading() {
  return (
    <>
      <Section tone="muted" className="pt-10 sm:pt-14 pb-12 sm:pb-16">
        <Container>
          <div aria-hidden="true" className="max-w-3xl animate-pulse space-y-4">
            <div className="h-4 w-20 rounded bg-border" />
            <div className="h-10 w-3/4 rounded bg-border" />
            <div className="h-4 w-full rounded bg-border" />
            <div className="h-4 w-2/3 rounded bg-border" />
          </div>
        </Container>
      </Section>
      <Section tone="surface">
        <p role="status" aria-live="polite" className="sr-only">
          Loading pricing…
        </p>
        <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-pulse space-y-4">
              <div className="h-5 w-2/3 rounded bg-surface-alt" />
              <div className="h-8 w-1/2 rounded bg-surface-alt" />
              <div className="h-16 rounded bg-surface-alt" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-surface-alt" />
                <div className="h-3 w-5/6 rounded bg-surface-alt" />
                <div className="h-3 w-2/3 rounded bg-surface-alt" />
              </div>
              <div className="h-10 rounded bg-surface-alt" />
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
