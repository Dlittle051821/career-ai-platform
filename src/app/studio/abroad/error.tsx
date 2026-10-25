"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * NW05.5 — route-level error state for `/studio/abroad`, mirroring
 * `src/app/studio/error.tsx`'s own convention: never surfaces
 * `error.message`/`error.digest` in the rendered UI.
 */
export default function StudioAbroadError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[studio/abroad/page] render error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mx-auto max-w-lg py-12 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--brand-coral)]" />
        <h1 className="mt-4 text-xl font-semibold text-primary">We couldn&rsquo;t load your Abroad workspace right now</h1>
        <p role="alert" className="mt-2 text-sm text-muted">
          Something went wrong on our end — your account and saved data are unaffected. Please try again, or contact
          NextWise directly if this keeps happening.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <LinkButton href="/contact" variant="outline">
            Contact NextWise
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
