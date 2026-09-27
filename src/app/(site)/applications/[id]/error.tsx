"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";

/** UX08 — route-level error state for /applications/[id]. Mirrors src/app/(site)/pricing/error.tsx. */
export default function ApplicationDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[applications/[id]/page] render error:", error);
  }, [error]);

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <Card className="mx-auto max-w-lg py-12 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--brand-coral)]" />
        <h1 className="mt-4 text-xl font-semibold text-primary">We couldn&rsquo;t load this application right now</h1>
        <p role="alert" className="mt-2 text-sm text-muted">
          Something went wrong on our end. Please try again, or contact NextWise directly if this keeps happening.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <LinkButton href="/applications" variant="outline">
            Back to my applications
          </LinkButton>
        </div>
      </Card>
    </Section>
  );
}
