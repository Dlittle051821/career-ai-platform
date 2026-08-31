"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { confirmPricingPurchaseAction } from "@/app/(site)/pricing/checkout/actions";

/**
 * The one client-JS piece of the plan-checkout confirm step — mirrors
 * PayButton's own "server action does the real work, this just wires a
 * button to it" shape. A successful confirm redirects server-side (see
 * confirmPricingPurchaseAction), so `result` is only ever inspected for its
 * error case here.
 */
export function ConfirmCheckoutButton({ planId, offerId }: { planId: string; offerId: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await confirmPricingPurchaseAction(planId, offerId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <Button
        onClick={handleClick}
        disabled={pending}
        className="w-full justify-center"
        icon={pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
      >
        {pending ? "Starting checkout…" : "Confirm and continue to payment"}
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
