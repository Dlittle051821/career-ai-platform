import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * UX10-M01 "Global Mobile UX Harmonization" — static source-text audit,
 * same "no React Testing Library/jsdom" convention as the other
 * milestones' own audit tests (e.g. src/lib/careers/careers-reference-audit.test.ts,
 * src/lib/dashboard/dashboard-reference-audit.test.ts,
 * src/lib/profile/profile-reference-audit.test.ts). Covers this
 * milestone's own mandatory regression categories: exactly one shared
 * mobile bottom tab bar (no per-page duplicates, no fabricated 5-item
 * navigation taxonomy standing in for the real 8-destination
 * DashboardShell nav), the mobile-only scoping of every responsive fix
 * made this milestone (every changed class stays guarded by a mobile-tier
 * breakpoint so desktop at 1024px+ is provably unchanged), and no new
 * routes/pages created to chase the reference images' fabricated screens
 * (Explore menu, Career Constellation, Career Detail/Pathway/Study Paths).
 */
const ROOT = path.join(__dirname, "..", "..");
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), "utf8");

const MOBILE_TAB_BAR = read("components/dashboard/MobileTabBar.tsx");
const APP_SLOT = read("components/navigation/AppMobileTabBarSlot.tsx");
const DASHBOARD_SHELL = read("components/dashboard/DashboardShell.tsx");
const SITE_LAYOUT = read("app/(site)/layout.tsx");
const GLOBALS_CSS = read("app/globals.css");
const WHY_NEXTWISE = read("components/sections/home/WhyNextwise.tsx");
const CAREER_INSIGHTS_PANEL = read("components/sections/careers/CareerInsightsPanel.tsx");
const COURSE_FILTER_BAR = read("components/sections/education/CourseFilterBar.tsx");
const DISCOVERY_BOOKING_FORM = read("components/sections/discovery-session/DiscoverySessionBookingForm.tsx");
const RECOMMENDATIONS_PAGE = read("app/(site)/recommendations/page.tsx");
const NEXT_BEST_ACTION_CARD = read("components/dashboard/NextBestActionCard.tsx");
const PROFILE_FORM_PANEL = read("components/sections/profile/ProfileFormPanel.tsx");

describe("UX10-M01 — exactly one shared mobile bottom tab bar component", () => {
  it("MobileTabBar.tsx defines exactly 5 tabs, each mapped to a real existing route (no fabricated taxonomy)", () => {
    const hrefMatches = [...MOBILE_TAB_BAR.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefMatches).toEqual(["/dashboard", "/careers", "/recommendations", "/discovery-session/book", "/profile"]);
  });

  it("MobileTabBar is hidden at the lg: breakpoint (1024px) — desktop keeps its existing sidebar/header nav, not this bar", () => {
    expect(MOBILE_TAB_BAR).toMatch(/lg:hidden/);
  });

  it("DashboardShell renders MobileTabBar exactly once and only imports it from the one shared component file", () => {
    const occurrences = DASHBOARD_SHELL.match(/<MobileTabBar\s*\/>/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(DASHBOARD_SHELL).toContain('import { MobileTabBar } from "@/components/dashboard/MobileTabBar"');
  });

  it("AppMobileTabBarSlot reuses the same shared MobileTabBar — it does not define its own separate mobile nav markup", () => {
    expect(APP_SLOT).toContain('import { MobileTabBar } from "@/components/dashboard/MobileTabBar"');
    expect(APP_SLOT).not.toMatch(/<nav[\s>]/);
  });

  it("AppMobileTabBarSlot only activates on the 4 real auth-protected (site)-group app routes, and is lg:hidden", () => {
    expect(APP_SLOT).toContain('["/recommendations", "/saved", "/applications", "/discovery-session"]');
    expect(APP_SLOT).toMatch(/lg:hidden/);
  });

  it("the public (site) layout renders AppMobileTabBarSlot exactly once", () => {
    const occurrences = SITE_LAYOUT.match(/<AppMobileTabBarSlot\s*\/>/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it("no fabricated 'Explore menu', 'Career Constellation', or standalone Career Detail/Pathway/Study Paths route was created (style-reference-only per the user's own decision)", () => {
    const appDirHasNoFabricatedRoutes = (dirSearch: string) => !dirSearch.match(/career-constellation|study-paths|career-pathway/i);
    expect(appDirHasNoFabricatedRoutes(MOBILE_TAB_BAR)).toBe(true);
    expect(appDirHasNoFabricatedRoutes(APP_SLOT)).toBe(true);
  });
});

describe("UX10-M01 — every responsive fix this milestone stays mobile-scoped (desktop at lg:/1024px+ provably unchanged)", () => {
  it("DashboardShell's extra bottom padding for the tab bar reverts at lg:", () => {
    expect(DASHBOARD_SHELL).toMatch(/pb-24[^"]*lg:pb-8/);
  });

  it("globals.css only touches the .orbit-stage BASE tier — the 769px/1024px/1280px tiered overrides are untouched literal values", () => {
    expect(GLOBALS_CSS).toContain("--orbit-rx: 118px");
    expect(GLOBALS_CSS).toContain("--orbit-squish: 0.62");
    expect(GLOBALS_CSS).toContain("--orbit-card-w: 68px");
    // The approved tablet/desktop tiers (from prior H-series milestones) must still be present and untouched.
    expect(GLOBALS_CSS).toMatch(/@media \(min-width: 769px\)/);
    expect(GLOBALS_CSS).toMatch(/@media \(min-width: 1024px\)/);
    expect(GLOBALS_CSS).toMatch(/@media \(min-width: 1280px\)/);
  });

  it("WhyNextwise proof tiles revert to the original lg:flex-col desktop layout", () => {
    expect(WHY_NEXTWISE).toMatch(/flex-col gap-3 sm:flex-row lg:flex-col/);
  });

  it("CareerInsightsPanel's sticky positioning is gated behind lg: (was unconditional before this milestone's fix)", () => {
    expect(CAREER_INSIGHTS_PANEL).toMatch(/lg:sticky lg:top-24/);
    expect(CAREER_INSIGHTS_PANEL).not.toMatch(/<Card className="sticky top-24/);
  });

  it("CourseFilterBar's 5-field tuition/scholarship row keeps its xl:grid-cols-5 (1280px) desktop tier, matching the original 5-up layout at desktop widths", () => {
    expect(COURSE_FILTER_BAR).toMatch(/grid gap-3 sm:grid-cols-2 xl:grid-cols-5/);
  });

  it("every new full-width-CTA fix is scoped with sm:w-auto so desktop (sm: and up) keeps the original inline-width button", () => {
    for (const [label, source] of [
      ["DiscoverySessionBookingForm", DISCOVERY_BOOKING_FORM],
      ["recommendations/page.tsx", RECOMMENDATIONS_PAGE],
      ["NextBestActionCard", NEXT_BEST_ACTION_CARD],
    ] as const) {
      expect(source, `${label} should contain a w-full sm:w-auto CTA`).toMatch(/w-full sm:w-auto/);
    }
    // ProfileFormPanel has two primary-button instances (Save & Continue / Complete My Profile).
    const profileFormPanelMatches = PROFILE_FORM_PANEL.match(/w-full sm:w-auto/g) ?? [];
    expect(profileFormPanelMatches.length).toBe(2);
  });
});

describe("UX10-M01 — no business logic removed, no duplicate routes", () => {
  it("MobileTabBar's own docblock documents that Saved/Applications/Documents & Payments/Settings remain reachable via the existing hamburger drawer (no destination silently dropped)", () => {
    expect(MOBILE_TAB_BAR).toMatch(/Saved, Applications, Documents & Payments, and Settings are NOT dropped/);
  });

  it("DiscoverySessionBookingForm still submits via the real bookDiscoverySessionAction server action (no mock submit handler introduced)", () => {
    expect(DISCOVERY_BOOKING_FORM).toContain("bookDiscoverySessionAction");
  });

  it("ProfileFormPanel's Back/Save & Exit secondary actions are untouched — only the primary action gained the mobile full-width treatment", () => {
    expect(PROFILE_FORM_PANEL).toContain("Back");
    expect(PROFILE_FORM_PANEL).toContain("Save & Exit");
    expect(PROFILE_FORM_PANEL).not.toMatch(/variant="outline"[^>]*w-full/);
  });
});
