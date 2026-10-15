import { Fragment } from "react";
import { ArrowRight, Compass, ListChecks, MessageCircle, ScanSearch, UserCheck } from "lucide-react";

/**
 * UX10-EU01 — the reference's compact "From research to your next step"
 * flow (section 6). Deliberately lighter-weight than UX10-HW01's full
 * `JourneyStepFlow` (no descriptions, no connecting-line graphic, no
 * progressive disclosure) — per the brief's own instruction, this section
 * explains Nextwise's role specifically within Europe exploration, not a
 * second full journey walkthrough.
 */
const STEPS = [
  { icon: Compass, label: "Understand your profile" },
  { icon: ScanSearch, label: "Compare countries & options" },
  { icon: UserCheck, label: "Get personalised guidance" },
  { icon: ListChecks, label: "Use official sources to explore programmes" },
  { icon: MessageCircle, label: "Talk to an expert when ready" },
];

export function EuropeHowNextwiseHelps() {
  return (
    <ol className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-2">
      {STEPS.map(({ icon: Icon, label }, index) => (
        <Fragment key={label}>
          <li className="flex-1">
            <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-border/80 bg-surface px-4 py-5 text-center shadow-[0_6px_18px_-10px_rgba(15,23,42,0.18)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-text">{label}</p>
            </div>
          </li>
          {index < STEPS.length - 1 ? (
            <li aria-hidden="true" className="hidden shrink-0 items-center justify-center lg:flex">
              <ArrowRight className="h-4 w-4 text-muted" />
            </li>
          ) : null}
        </Fragment>
      ))}
    </ol>
  );
}
