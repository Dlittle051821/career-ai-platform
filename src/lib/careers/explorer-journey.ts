import { Building2, Compass, GraduationCap, Lightbulb, Rocket, type LucideIcon } from "lucide-react";

/**
 * UX10-C01 — the small 5-step "Interests -> Career -> Courses ->
 * Universities -> Outcomes" mini-map shown twice on the reference mockup
 * (once as a loose icon cluster beside the hero photo, once as a flat
 * numbered strip under the filter bar). Both reuse this one real list.
 *
 * Icon choice and routes deliberately REUSE this codebase's own existing
 * icon-to-concept mapping and real public routes from
 * `src/components/sections/home/OrbitJourney.tsx` (Lightbulb=Interests,
 * Compass=Career, GraduationCap=Course, Building2=University,
 * Rocket=aspirational finish) rather than inventing a second mapping —
 * see that file's own docblock for why each route is the one real public
 * (no-login-required) destination for its stage. "Outcomes" reuses
 * OrbitJourney's own "Your Future" destination (/career-discovery) for
 * the same documented reason: /recommendations and /roadmap are both
 * behind `PROTECTED_PATHS` and would bounce a logged-out visitor straight
 * to /login, so neither is a safe link from a public page.
 */
export interface ExplorerJourneyStep {
  id: string;
  order: number;
  label: string;
  blurb: string;
  icon: LucideIcon;
  href: string;
  tone: "intelligence" | "info" | "secondary" | "success" | "accent";
}

export const EXPLORER_JOURNEY_STEPS: ExplorerJourneyStep[] = [
  { id: "interests", order: 1, label: "Interests", blurb: "Tell us what you enjoy", icon: Lightbulb, href: "/career-discovery", tone: "intelligence" },
  { id: "career", order: 2, label: "Career", blurb: "Explore career options", icon: Compass, href: "/careers", tone: "info" },
  { id: "courses", order: 3, label: "Courses", blurb: "Find relevant courses", icon: GraduationCap, href: "/courses", tone: "secondary" },
  { id: "universities", order: 4, label: "Universities", blurb: "Compare globally", icon: Building2, href: "/universities", tone: "success" },
  { id: "outcomes", order: 5, label: "Outcomes", blurb: "See where it can take you", icon: Rocket, href: "/career-discovery", tone: "accent" },
];
