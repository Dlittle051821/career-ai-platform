"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PricingFilterItem {
  /** A stable key for this card (the plan slug) — used only for the React key and the `hidden` toggle, never shown. */
  key: string;
  /** Which filter chips this card should be visible under. "all" is implicit and not listed here. */
  groups: string[];
  node: ReactNode;
}

const FILTERS = [
  { id: "all", label: "All Plans" },
  { id: "india", label: "Study in India" },
  { id: "abroad", label: "Study Abroad" },
  { id: "high-support", label: "High Support" },
] as const;

/**
 * UX10-PR01 — the reference mockup's "All Plans / Study in India / Study
 * Abroad / High Support" filter row. Same technique PricingTabs already
 * established elsewhere on this page (every card is rendered once, server-
 * side, with its real data; this client component only toggles which ones
 * are `hidden` — no second data fetch, no duplicate card-rendering logic).
 *
 * The three groups are derived from fields the real catalog already has,
 * not a new ad-hoc taxonomy:
 *   - "Study in India"  -> plan.category === "school_counselling" (Nextwise
 *     Explore/Verified/Essential — the real category value already
 *     publicly labelled "India Guidance", see src/types/pricing.ts)
 *   - "Study Abroad"     -> plan.category is "bachelor_abroad" or
 *     "master_abroad" (all four Bachelor/Master Abroad Plus/Premium plans)
 *   - "High Support"     -> plan.isRecommended (the two Premium plans) —
 *     reusing the real recommended flag rather than inventing a new one.
 * A card can appear in more than one group's mental model (e.g. a Premium
 * plan is also "Study Abroad"), but since every card's `groups` array is
 * built from the real plan it represents, nothing here is fabricated.
 *
 * Keyboard support mirrors `PricingTabs.tsx`'s own WAI-ARIA tabs pattern
 * exactly (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): roving
 * tabindex plus Left/Right/Home/End arrow-key navigation between chips,
 * not just mouse `onClick`.
 */
export function PricingCategoryFilter({ items }: { items: PricingFilterItem[] }) {
  const [active, setActive] = useState<(typeof FILTERS)[number]["id"]>("all");
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusChip(id: (typeof FILTERS)[number]["id"]) {
    setActive(id);
    chipRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = index === 0 ? FILTERS.length - 1 : index - 1;
    if (event.key === "ArrowRight") nextIndex = index === FILTERS.length - 1 ? 0 : index + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = FILTERS.length - 1;
    focusChip(FILTERS[nextIndex].id);
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter pricing plans" className="flex flex-wrap gap-3 overflow-x-auto pb-1">
        {FILTERS.map((filter, index) => {
          const selected = filter.id === active;
          return (
            <button
              key={filter.id}
              ref={(el) => {
                chipRefs.current[filter.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(filter.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors sm:text-[15px]",
                selected
                  ? "border-primary bg-primary text-on-primary shadow-soft"
                  : "border-border-strong bg-surface text-text-soft hover:bg-surface-alt"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-9 grid gap-7 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const visible = active === "all" || item.groups.includes(active);
          return (
            <div key={item.key} hidden={!visible} className={cn(!visible && "sr-only")}>
              {item.node}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PRICING_FILTER_IDS = FILTERS.map((f) => f.id);
