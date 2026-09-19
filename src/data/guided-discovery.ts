import type { OptionDef } from "@/data/profile-options";

/**
 * UX05B — option lists for the short, client-only Guided Discovery mini-
 * flow on /career-discovery (src/components/sections/career-discovery/GuidedDiscoveryFlow.tsx).
 *
 * Deliberately NOT a duplicate of the Student Digital Profile's own
 * option lists (src/data/profile-options.ts): the spec is explicit that
 * this must stay a short orientation tool, never a long assessment, and
 * that registration must not collect profile information twice. Where an
 * existing profile option list is the exact right granularity for a
 * dimension (current education stage), the flow reuses it directly
 * (CURRENT_STATUS_OPTIONS, imported by the flow component) instead of
 * duplicating it here. The lists below are new because they are
 * deliberately coarser/broader than their profile-onboarding equivalents
 * (e.g. six broad interest areas here vs. 40+ specific interests in
 * INTEREST_OPTIONS) — nothing collected in this flow is persisted or sent
 * to the server; it only shapes the flow's own closing reflection text.
 */

export const DECISION_FOCUS_OPTIONS: OptionDef[] = [
  { key: "career", label: "Which career to aim for" },
  { key: "course", label: "Which course to study" },
  { key: "india_or_abroad", label: "Whether to study in India or abroad" },
  { key: "colleges", label: "Which colleges are realistic for me" },
  { key: "affordability", label: "Whether I can afford it" },
  { key: "unsure", label: "I don't know where to start" },
];

export const INTEREST_AREA_OPTIONS: OptionDef[] = [
  { key: "science_tech", label: "Science & technology" },
  { key: "business_finance", label: "Business & finance" },
  { key: "creative_design", label: "Creative & design" },
  { key: "people_helping", label: "Working with & helping people" },
  { key: "hands_on_building", label: "Hands-on & building things" },
  { key: "communication_media", label: "Communication & media" },
];

export const LOCATION_PREFERENCE_OPTIONS: OptionDef[] = [
  { key: "india", label: "India" },
  { key: "abroad", label: "Abroad" },
  { key: "unsure", label: "Not sure yet" },
];

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Very unsure",
  2: "A little unsure",
  3: "Somewhere in the middle",
  4: "Fairly confident",
  5: "Confident",
};

export const HELP_NEEDED_OPTIONS: OptionDef[] = [
  { key: "understand_careers", label: "Understanding careers better" },
  { key: "compare_courses", label: "Comparing courses" },
  { key: "compare_india_abroad", label: "Comparing India vs abroad" },
  { key: "understand_costs", label: "Understanding costs" },
  { key: "talk_to_someone", label: "Talking to a real person" },
  { key: "just_exploring", label: "Just exploring for now" },
];
