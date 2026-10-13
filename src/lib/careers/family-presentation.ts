import {
  Atom,
  Briefcase,
  Brain,
  Building2,
  Car,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Hotel,
  Landmark,
  Leaf,
  Megaphone,
  Microscope,
  Palette,
  Plane,
  Rocket,
  Scale,
  Ship,
  Trophy,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * UX10-C01 — a purely presentational icon + color-tone lookup for the
 * career family taxonomy already defined in `src/data/careers/taxonomy.ts`
 * (`CAREER_FAMILIES`, 26 real families — the same `familyKey` values
 * `CareerSummary.familyKey` carries on every real search result). This
 * exists only to give each `CareerCard` a colored icon chip in place of
 * the reference mockup's own photographic card images — `CareerSummary`
 * (the real list/search shape) has no image field at all, and no
 * per-career photo exists anywhere in this product's data model, so
 * presenting one would be fabricated (the same "no fabricated per-item
 * image" rule UX10-D01 followed for its Course/University "coming soon"
 * cards). A real-data-driven icon + tone, keyed off the real family a
 * career already belongs to, is the honest substitute — never a
 * decoration invented from nothing.
 *
 * Tones are drawn only from this app's existing GLOBAL color tokens
 * (--color-primary/-secondary/-accent/-intelligence/-success/-info in
 * globals.css), never the `--surface-soft-*` family, which that file's
 * own comment documents as a homepage-section-only system not meant to
 * become new global brand colors.
 */

// NOTE: `--color-primary-light` (globals.css) is a brighter blue used for
// Button.tsx's own hover state, NOT a pale tint — using it as a chip
// background would need white text, not the dark-on-pale treatment every
// other tone here uses. "info" is this app's actual pale-blue pair
// (`--color-info`/`--color-info-light`, the same pair Badge.tsx's own
// `tone="info"` already uses) and stands in for "blue" below.
export type FamilyTone = "info" | "secondary" | "accent" | "intelligence" | "success";

export const FAMILY_TONE_CLASSES: Record<FamilyTone, { bg: string; fg: string }> = {
  info: { bg: "bg-info-light", fg: "text-info" },
  secondary: { bg: "bg-secondary-light", fg: "text-secondary-dark" },
  accent: { bg: "bg-accent-light", fg: "text-accent-dark" },
  intelligence: { bg: "bg-intelligence-light", fg: "text-intelligence-strong" },
  success: { bg: "bg-success-light", fg: "text-success" },
};

interface FamilyPresentation {
  icon: LucideIcon;
  tone: FamilyTone;
}

const FAMILY_PRESENTATION: Record<string, FamilyPresentation> = {
  engineering: { icon: Wrench, tone: "info" },
  automotive_mobility: { icon: Car, tone: "info" },
  marine_maritime: { icon: Ship, tone: "intelligence" },
  aviation_aerospace: { icon: Plane, tone: "info" },
  technology_computing: { icon: Rocket, tone: "info" },
  data_ai: { icon: Brain, tone: "intelligence" },
  business_management: { icon: Briefcase, tone: "secondary" },
  finance_economics: { icon: Landmark, tone: "accent" },
  healthcare_medicine: { icon: HeartPulse, tone: "success" },
  life_sciences: { icon: Microscope, tone: "success" },
  physical_sciences: { icon: Atom, tone: "intelligence" },
  environment_sustainability: { icon: Leaf, tone: "success" },
  energy: { icon: Zap, tone: "accent" },
  architecture_built_environment: { icon: Building2, tone: "secondary" },
  design_creative: { icon: Palette, tone: "accent" },
  media_communication: { icon: Megaphone, tone: "info" },
  law_legal: { icon: Scale, tone: "info" },
  government_public_policy: { icon: Landmark, tone: "info" },
  education: { icon: GraduationCap, tone: "secondary" },
  psychology_human_services: { icon: Brain, tone: "success" },
  sales_marketing: { icon: Megaphone, tone: "accent" },
  operations_supply_chain: { icon: Truck, tone: "info" },
  hospitality_tourism: { icon: Hotel, tone: "accent" },
  sports: { icon: Trophy, tone: "success" },
  research_academia: { icon: FlaskConical, tone: "intelligence" },
  entrepreneurship: { icon: Rocket, tone: "accent" },
};

const DEFAULT_PRESENTATION: FamilyPresentation = { icon: Briefcase, tone: "info" };

/** Always returns something real and sensible, even for a family key added after this lookup was written — never throws, never blank. */
export function getFamilyPresentation(familyKey: string): FamilyPresentation {
  return FAMILY_PRESENTATION[familyKey] ?? DEFAULT_PRESENTATION;
}
