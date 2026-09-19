import { DECISION_FOCUS_OPTIONS, HELP_NEEDED_OPTIONS, INTEREST_AREA_OPTIONS, LOCATION_PREFERENCE_OPTIONS } from "@/data/guided-discovery";
import { CURRENT_STATUS_OPTIONS } from "@/data/profile-options";

/**
 * UX05B — pure builder for the Guided Discovery mini-flow's closing
 * reflection. Deliberately produces an honest "here's what you told us"
 * orientation summary, never a scored result, a match percentage, or any
 * "AI-generated" framing — the flow's whole point is orientation, not a
 * genuine assessment (see the DemoNotice already on /career-discovery,
 * which this summary is written to sit consistently alongside). Kept as
 * a standalone pure function — not a React component — so it can be unit
 * tested without jsdom/React Testing Library, per this project's existing
 * Vitest convention (see vitest.config.mts's top-of-file comment).
 */

export interface GuidedDiscoverySelections {
  decisionFocus: string[];
  educationStage: string | null;
  interestAreas: string[];
  locationPreference: string | null;
  confidence: number | null;
  helpNeeded: string[];
}

export const EMPTY_DISCOVERY_SELECTIONS: GuidedDiscoverySelections = {
  decisionFocus: [],
  educationStage: null,
  interestAreas: [],
  locationPreference: null,
  confidence: null,
  helpNeeded: [],
};

export interface OrientationSummary {
  headline: string;
  bullets: string[];
}

function labelsFor(options: { key: string; label: string }[], keys: string[]): string[] {
  return keys.map((key) => options.find((o) => o.key === key)?.label).filter((label): label is string => Boolean(label));
}

/**
 * Builds the reflection shown at the end of the flow. Every sentence is
 * derived directly from what the student picked — nothing here is
 * fabricated, scored, or presented as a recommendation. A student who
 * skipped every step (all fields empty/null) still gets an encouraging,
 * honest headline rather than an empty screen.
 */
export function buildOrientationSummary(selections: GuidedDiscoverySelections): OrientationSummary {
  const bullets: string[] = [];

  const focusLabels = labelsFor(DECISION_FOCUS_OPTIONS, selections.decisionFocus);
  if (focusLabels.length > 0) {
    bullets.push(`You're weighing: ${focusLabels.join(", ").toLowerCase()}.`);
  }

  const stageLabel = selections.educationStage ? CURRENT_STATUS_OPTIONS.find((o) => o.key === selections.educationStage)?.label : undefined;
  if (stageLabel) {
    bullets.push(`You told us you're currently a ${stageLabel.toLowerCase()}.`);
  }

  const interestLabels = labelsFor(INTEREST_AREA_OPTIONS, selections.interestAreas);
  if (interestLabels.length > 0) {
    bullets.push(`You're drawn to: ${interestLabels.join(", ").toLowerCase()}.`);
  }

  const locationLabel = selections.locationPreference ? LOCATION_PREFERENCE_OPTIONS.find((o) => o.key === selections.locationPreference)?.label : undefined;
  if (locationLabel) {
    bullets.push(
      selections.locationPreference === "unsure"
        ? "You're still deciding between India and abroad — that's a completely normal place to start."
        : `You're currently leaning towards studying in ${locationLabel}.`,
    );
  }

  if (typeof selections.confidence === "number") {
    bullets.push(
      selections.confidence <= 2
        ? "Right now you're feeling unsure about your direction — that's exactly what this is here to help with."
        : selections.confidence >= 4
          ? "You're already feeling fairly confident about your direction — this can help you sanity-check it."
          : "You're somewhere in the middle on confidence — a bit more clarity should help.",
    );
  }

  const helpLabels = labelsFor(HELP_NEEDED_OPTIONS, selections.helpNeeded);
  if (helpLabels.length > 0) {
    bullets.push(`You said the most useful next step would be: ${helpLabels.join(", ").toLowerCase()}.`);
  }

  const headline =
    bullets.length > 0 ? "Here's what you've told us so far" : "You skipped ahead — that's completely fine";

  if (bullets.length === 0) {
    bullets.push("You don't need to answer any of this to keep exploring — come back to it whenever you're ready.");
  }

  return { headline, bullets };
}
