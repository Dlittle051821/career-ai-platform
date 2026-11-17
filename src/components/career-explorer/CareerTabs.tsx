"use client";

import { useEffect, useState } from "react";

export interface CareerTab {
  id: string;
  label: string;
}

/**
 * The profile's section bar: in-page links that stay in view while the page
 * scrolls and mark the section being read. Plain anchors, so they work
 * without scripts; the highlight is the only scripted part.
 */
export function CareerTabs({ tabs }: { tabs: CareerTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const sections = tabs.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const first = tabs.find((t) => visible.has(t.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-25% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav className="ce-tabs" aria-label="Sections of this career profile">
      <div className="ce-wrap">
        <ul>
          {tabs.map((tab) => (
            <li key={tab.id}>
              <a href={`#${tab.id}`} aria-current={active === tab.id ? "true" : undefined} onClick={() => setActive(tab.id)}>
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
