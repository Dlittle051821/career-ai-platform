"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { reorderPricingPlansAction } from "@/app/admin/pricing/actions";

/**
 * Up/down reorder controls for one row of the pricing-plans list. Only
 * rendered when the list is filtered to a single category (see
 * page.tsx) — reorderPricingPlansAction rewrites display_order (10, 20,
 * 30…) for exactly the ids it's given, so passing just this category's
 * ids leaves every other category's ordering untouched, which is correct
 * since /pricing sorts each category section independently.
 */
export function PricingReorderButtons({ orderedIdsInCategory, planId }: { orderedIdsInCategory: string[]; planId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const index = orderedIdsInCategory.indexOf(planId);
  const canMoveUp = index > 0;
  const canMoveDown = index >= 0 && index < orderedIdsInCategory.length - 1;

  function move(direction: -1 | 1) {
    const next = [...orderedIdsInCategory];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setError(null);
    startTransition(async () => {
      const result = await reorderPricingPlansAction(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!canMoveUp || pending}
          aria-label="Move up"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] border border-border-strong text-text-soft hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!canMoveDown || pending}
          aria-label="Move down"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] border border-border-strong text-text-soft hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </div>
  );
}
