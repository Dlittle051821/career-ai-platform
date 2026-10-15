import { Compass, BadgeCheck, Landmark, Plane, GraduationCap, type LucideIcon } from "lucide-react";

/**
 * UX10-PR01 — one icon per plan, matching the reference mockup's own
 * suggested mapping (compass / verification document / India institution /
 * airplane-or-graduation / graduation cap). Keyed by slug, same
 * presentation-only-lookup pattern as recommended-badge.ts — purely
 * decorative, never drives any real logic.
 */
export const PLAN_ICON_BY_SLUG: Record<string, LucideIcon> = {
  "nextwise-explore": Compass,
  "nextwise-verified": BadgeCheck,
  "nextwise-essential": Landmark,
  "bachelor-abroad-plus": Plane,
  "master-abroad-plus": GraduationCap,
  "bachelor-abroad-premium": Plane,
  "master-abroad-premium": GraduationCap,
};

export const DEFAULT_PLAN_ICON: LucideIcon = Compass;

/**
 * Prefer `PLAN_ICON_BY_SLUG[slug] ?? DEFAULT_PLAN_ICON` directly at the call
 * site when the result is assigned to a capitalized (JSX-tag) variable —
 * same plain object-index shape every other icon lookup in this codebase
 * uses (see e.g. ProfileSectionNav.tsx's `item.icon`). A function-call
 * expression feeding a capitalized variable trips the project's
 * `react-hooks/static-components` lint rule ("Cannot create components
 * during render"), even though this lookup is a pure, stable map read with
 * no actual component creation. This helper remains for non-JSX call sites
 * (e.g. tests) where that lint rule doesn't apply.
 */
export function planIcon(slug: string): LucideIcon {
  return PLAN_ICON_BY_SLUG[slug] ?? DEFAULT_PLAN_ICON;
}
