"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { PricingComparisonTable } from "@/components/sections/pricing/PricingComparisonTable";
import { cn } from "@/lib/utils";
import type { PricingPlan, PricingPlanVersion } from "@/types/pricing";

/**
 * UX10-PR01B "Pricing Visual Correction Pass" — groups the same 8 real,
 * already-structured comparison metrics `PricingComparisonTable` has always
 * shown into the 6 named tabs the brief's reference asks for (Key Features
 * / Assessment & Guidance / Applications / University Support / Visa &
 * Travel / Ongoing Support). This is a presentation-only regrouping, not
 * new data: every row label and value still comes straight from
 * `buildComparisonRow`/`formatComparisonCell` exactly as before, and a
 * metric with no real value for a plan still renders an honest em dash,
 * never a fabricated number (see PricingComparisonTable's own docblock).
 *
 * "Visa & Travel" and "Ongoing Support" have no single dedicated structured
 * field of their own in this schema — "Support duration" (the real,
 * existing field closest to each) is reused in both tabs rather than
 * inventing a new column, exactly the kind of schema-preserving
 * presentation decision this project already uses elsewhere (see
 * recommended-badge.ts / plan-eyebrow.ts's own docblocks for the same
 * "don't touch the schema for a presentation-only question" discipline).
 *
 * Keyboard support mirrors `PricingTabs.tsx`'s own WAI-ARIA tabs pattern:
 * roving tabindex, Left/Right/Home/End arrow-key navigation.
 */
const COMPARISON_TABS = [
  { id: "key-features", label: "Key Features", metrics: ["Counselling sessions", "Dedicated or senior counsellor"] },
  { id: "assessment", label: "Assessment & Guidance", metrics: ["Dedicated or senior counsellor", "SOP review rounds"] },
  { id: "applications", label: "Applications", metrics: ["Application-support limit", "University shortlisting limit"] },
  { id: "university-support", label: "University Support", metrics: ["University shortlisting limit", "Scholarship support"] },
  { id: "visa-travel", label: "Visa & Travel", metrics: ["Support duration"] },
  { id: "ongoing-support", label: "Ongoing Support", metrics: ["Support duration", "Mock interviews"] },
] as const;

export function PricingComparisonTabs({
  categoryLabel,
  items,
}: {
  categoryLabel: string;
  items: { plan: PricingPlan; version: PricingPlanVersion }[];
}) {
  const baseId = useId();
  const [activeId, setActiveId] = useState<(typeof COMPARISON_TABS)[number]["id"]>(COMPARISON_TABS[0].id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(id: (typeof COMPARISON_TABS)[number]["id"]) {
    setActiveId(id);
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = index === 0 ? COMPARISON_TABS.length - 1 : index - 1;
    if (event.key === "ArrowRight") nextIndex = index === COMPARISON_TABS.length - 1 ? 0 : index + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = COMPARISON_TABS.length - 1;
    focusTab(COMPARISON_TABS[nextIndex].id);
  }

  const activeTab = COMPARISON_TABS.find((t) => t.id === activeId) ?? COMPARISON_TABS[0];

  return (
    <div>
      <div role="tablist" aria-label="Compare plans by category" className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {COMPARISON_TABS.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                selected ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-text-soft hover:bg-surface-alt"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id={`${baseId}-panel-${activeTab.id}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${activeTab.id}`} tabIndex={0} className="mt-6">
        <PricingComparisonTable categoryLabel={categoryLabel} items={items} metricLabels={activeTab.metrics} />
      </div>
    </div>
  );
}
