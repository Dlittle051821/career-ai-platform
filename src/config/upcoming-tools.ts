/**
 * Free Tools — the one catalogue of planned tools.
 *
 * Exactly the eight approved tools, in the approved order. All are planned:
 * none exists yet, none has a route, an API or a date, and the catalogue page
 * renders each as plain information (no link, no button, no handler). The
 * header, the phone menu and the footer link only to the catalogue itself
 * (FREE_TOOLS_PATH); nothing else in the codebase lists tools.
 *
 * When a tool ships, give it a real route and change its `status` here — the
 * type is the place to add "available"; until then the page has no code path
 * that could make a card navigable.
 */
export const FREE_TOOLS_PATH = "/tools";

export type UpcomingToolIcon = "cv" | "calculator" | "checklist" | "profile" | "letter" | "scholarship" | "eligibility" | "reality";

export interface UpcomingTool {
  /** Stable identifier; never shown and never used as a URL. */
  id: string;
  name: string;
  /** What the tool is planned to do — written as a plan, not as a service on offer. */
  description: string;
  phase: 1 | 2 | 3;
  status: "coming_soon";
  icon: UpcomingToolIcon;
}

export const UPCOMING_TOOL_STATUS_LABEL = "Coming Soon";

export const UPCOMING_TOOLS: readonly UpcomingTool[] = Object.freeze([
  { id: "country-cv-studio", name: "Country-Specific CV Studio", description: "Planned: create CVs tailored to country-specific academic and professional expectations.", phase: 1, status: "coming_soon", icon: "cv" },
  { id: "study-cost-calculator", name: "Study Cost Calculator", description: "Planned: plan tuition, living expenses, and other study-abroad costs.", phase: 1, status: "coming_soon", icon: "calculator" },
  { id: "application-checklist-generator", name: "Application Checklist Generator", description: "Planned: organize documents and milestones for university applications.", phase: 2, status: "coming_soon", icon: "checklist" },
  { id: "academic-profile-builder", name: "Academic Profile Builder", description: "Planned: build a structured overview of academic qualifications and achievements.", phase: 2, status: "coming_soon", icon: "profile" },
  { id: "sop-motivation-letter-studio", name: "SOP & Motivation Letter Studio", description: "Planned: prepare and refine structured application statements.", phase: 2, status: "coming_soon", icon: "letter" },
  { id: "scholarship-explorer", name: "Scholarship Explorer", description: "Planned: discover scholarship opportunities and their requirements.", phase: 3, status: "coming_soon", icon: "scholarship" },
  { id: "university-eligibility-pre-check", name: "University Eligibility Pre-Check", description: "Planned: understand programme requirements before applying.", phase: 3, status: "coming_soon", icon: "eligibility" },
  { id: "career-reality-check", name: "Career Reality Check", description: "Planned: explore the practical realities behind different career paths.", phase: 3, status: "coming_soon", icon: "reality" },
]);
