import type { ReactNode } from "react";
import { v54Grotesk } from "@/components/sections/home/v54/fonts";
import "@/styles/career-intelligence-v2.css";

/**
 * Career Intelligence V2 — the page wrapper. Scopes the approved styles
 * (.ci2) and loads the site's existing display face. `navy` marks a page
 * whose first section is the dark-blue hero, so the header bar is drawn solid
 * over it (see the stylesheet).
 */
export function CiShell({ navy = false, children }: { navy?: boolean; children: ReactNode }) {
  return (
    <div className={`ci2 ${v54Grotesk.variable}`} data-ci-navy={navy ? "" : undefined}>
      {children}
    </div>
  );
}

/** The eight sections, as the entry card and the completion screen list them. */
export const JOURNEY_STEPS = [
  { n: 1, label: "Free Assessment", tag: "Free", tone: "free" },
  { n: 2, label: "Recommendation Preview", tag: "Free", tone: "free" },
  { n: 3, label: "Unlock Full Insights", tag: "Paid", tone: "paid" },
] as const;

export function Journey() {
  return (
    <ol className="journey" aria-label="Your journey">
      {JOURNEY_STEPS.map((step, i) => (
        <li key={step.n} style={{ display: "contents" }}>
          {i > 0 ? <span className="sep" aria-hidden="true" /> : null}
          <span className={`j ${step.tone}`}>
            <span className="n">{step.n}</span>
            {step.label} <span className="tag">{step.tag}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
