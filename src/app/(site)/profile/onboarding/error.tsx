"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * CC-22B — route-level error state (same pattern as src/app/studio/error.tsx):
 * logs the real error for diagnosis and never shows error.message or digest.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[onboarding] render error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Card className="mx-auto max-w-lg py-12 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--brand-coral)]" />
        <h1 className="mt-4 text-xl font-semibold text-primary">We couldn&rsquo;t load your profile builder right now</h1>
        <p role="alert" className="mt-2 text-sm text-muted">
          Something went wrong on our end — your account and saved answers are unaffected. Please try again in a moment.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <LinkButton href="/" variant="outline">
            Go to homepage
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
