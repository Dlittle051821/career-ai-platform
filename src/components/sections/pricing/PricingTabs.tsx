"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PricingTab {
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * WAI-ARIA "tabs" pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
 * a single tablist with roving tabindex, Left/Right (and Home/End) arrow-key
 * navigation between tabs, and one visible tabpanel at a time. Spec: "three
 * clear sections or tabs" for School Guidance / Bachelor Abroad / Master
 * Abroad, with full keyboard accessibility. Client-only interaction on top
 * of server-rendered panel content — the panels themselves (plan cards,
 * comparison tables) are passed in already rendered, so this component only
 * ever toggles which one is visible.
 */
export function PricingTabs({ tabs, defaultTabId }: { tabs: PricingTab[]; defaultTabId?: string }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(id: string) {
    setActiveId(id);
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = index === 0 ? tabs.length - 1 : index - 1;
    if (event.key === "ArrowRight") nextIndex = index === tabs.length - 1 ? 0 : index + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    focusTab(tabs[nextIndex].id);
  }

  return (
    <div>
      <div role="tablist" aria-label="Pricing categories" className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab, index) => {
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
                "-mb-px rounded-t-[var(--radius-control)] border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:px-5",
                selected ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="pt-8"
        >
          {tab.id === activeId ? tab.panel : null}
        </div>
      ))}
    </div>
  );
}
