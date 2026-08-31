"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * Route-level error state for /pricing (Next.js App Router `error.tsx` —
 * must be a Client Component). Never shows a raw error message or stack to
 * the visitor — same "never surface a raw DB/server error" discipline as
 * every admin friendlyAdminError() path in this codebase.
 */
export default function PricingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[pricing/page] render error:", error);
  }, [error]);

  return (
    <Section tone="surface">
      <Card className="mx-auto max-w-lg py-12 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--brand-coral)]" />
        <h1 className="mt-4 text-xl font-semibold text-primary">We couldn&rsquo;t load pricing right now</h1>
        <p role="alert" className="mt-2 text-sm text-muted">
          Something went wrong on our end. Please try again, or contact NextWise directly if this keeps happening.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <LinkButton href="/contact" variant="outline">
            Contact NextWise
          </LinkButton>
        </div>
      </Card>
    </Section>
  );
}
