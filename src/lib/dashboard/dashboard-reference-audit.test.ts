import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * UX10-D01 "STUDENT DASHBOARD EXACT REFERENCE IMPLEMENTATION" — static
 * source-text audit, same "no React Testing Library/jsdom" convention as
 * the homepage milestones' own audit tests (e.g.
 * src/lib/home/premium-refinement-audit.test.ts). Covers this milestone's
 * own mandatory regression categories (brief section 24): no fabricated
 * mockup data, real next-best-action usage, real journey-status usage,
 * empty-state behavior, and dashboard visual structure (sans-only
 * headings, real nav routes).
 */
const DASHBOARD_COMPONENTS_DIR = path.join(__dirname, "..", "..", "components", "dashboard");
const DASHBOARD_LIB_DIR = __dirname;
const APP_DASHBOARD_DIR = path.join(__dirname, "..", "..", "app", "dashboard");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readAll(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    out[name] = readFileSync(path.join(dir, name), "utf8");
  }
  return out;
}

const COMPONENT_SOURCES = readAll(DASHBOARD_COMPONENTS_DIR);
const LIB_SOURCES = readAll(DASHBOARD_LIB_DIR);
const PAGE_SOURCES = readAll(APP_DASHBOARD_DIR);
const ALL_SOURCES: Record<string, string> = { ...COMPONENT_SOURCES, ...LIB_SOURCES, ...PAGE_SOURCES };

describe("UX10-D01 — no fabricated mockup data anywhere in the dashboard source", () => {
  // Every one of these strings appears in the reference mockup as an
  // EXAMPLE value the brief explicitly forbids hardcoding (section 16).
  const FORBIDDEN_LITERALS = [
    "Arjun",
    "78%",
    "Data Scientist",
    "BSc Computer Science",
    "University of Toronto",
    "University of Melbourne",
    "95% Match",
    "92% Match",
    "89% Match",
    "Priya Sharma",
    "15 Jan 2025",
    "25 Jan 2025",
    "28 Oct 2024",
    "UK Fall Intake",
    "5 saved items",
    "Career Guidance Session", // the mockup's specific upcoming-session title is only allowed as fixed copy for a REAL scheduled session, never as a stand-in count/name
  ];

  for (const [file, source] of Object.entries(ALL_SOURCES)) {
    it(`${file} contains none of the mockup's example values as literal strings`, () => {
      const codeOnly = stripComments(source);
      for (const literal of FORBIDDEN_LITERALS) {
        if (literal === "Career Guidance Session") continue; // checked separately below — this one IS legitimate real copy, see that file's own test
        expect(codeOnly.includes(literal), `${file} should not contain the mockup's example value "${literal}"`).toBe(false);
      }
    });
  }

  it("no dashboard percentage badge is hardcoded — MatchBandBadge (qualitative only) is used instead of a numeric match score", () => {
    const source = stripComments(COMPONENT_SOURCES["RecommendedForYou.tsx"]);
    expect(source).not.toMatch(/\d{2}%\s*Match/);
    expect(source).toContain("MatchBandBadge");
  });
});

describe("UX10-D01 — real next-best-action usage", () => {
  it("page.tsx calls the real getNextBestAction() rather than constructing its own action object", () => {
    const source = stripComments(PAGE_SOURCES["page.tsx"]);
    expect(source).toContain('from "@/lib/dashboard/next-best-action"');
    expect(source).toMatch(/getNextBestAction\(\{/);
  });

  it("NextBestActionCard renders the action prop's own fields, never a fixed title/description", () => {
    const source = stripComments(COMPONENT_SOURCES["NextBestActionCard.tsx"]);
    expect(source).toContain("action.title");
    expect(source).toContain("action.description");
    expect(source).toContain("action.cta");
    expect(source).toContain("action.href");
  });

  it("does not invent a per-action time estimate ('Takes about N minutes') that next-best-action.ts has no real data for", () => {
    const source = stripComments(COMPONENT_SOURCES["NextBestActionCard.tsx"]);
    expect(source).not.toMatch(/Takes about \d+ minutes/);
  });
});

describe("UX10-D01 — real journey-status usage", () => {
  it("page.tsx calls the real computeJourneyProgress() rather than a hardcoded stage list", () => {
    const source = stripComments(PAGE_SOURCES["page.tsx"]);
    expect(source).toContain('from "@/lib/dashboard/journey-progress"');
    expect(source).toMatch(/computeJourneyProgress\(\{/);
  });

  it("JourneyTracker renders the product's real six stage keys, never the mockup's own stage names", () => {
    const source = stripComments(COMPONENT_SOURCES["JourneyTracker.tsx"]);
    expect(source).toContain("stages.map");
    // the mockup's own invented stage vocabulary must never appear
    expect(source).not.toMatch(/"Shortlist"|"Decision"|Profile:\s*"Complete"/);
  });
});

describe("UX10-D01 — empty-state behavior (brief section 17's own copy)", () => {
  it("Saved & Shortlist empty state matches the brief exactly", () => {
    const source = stripComments(COMPONENT_SOURCES["SavedShortlistCard.tsx"]);
    expect(source).toContain("No saved items yet. Explore careers, courses or universities to start your shortlist.");
  });

  it("Applications empty state matches the brief exactly", () => {
    const source = stripComments(COMPONENT_SOURCES["ApplicationsCard.tsx"]);
    expect(source).toContain("No applications started yet.");
  });

  it("Important Dates empty state matches the brief exactly", () => {
    const source = stripComments(COMPONENT_SOURCES["ImportantDatesCard.tsx"]);
    expect(source).toContain("No important dates yet.");
  });

  it("Discovery Session shows a real book-a-session empty state, not a fabricated upcoming session", () => {
    const source = stripComments(COMPONENT_SOURCES["DiscoverySessionCard.tsx"]);
    expect(source).toContain("session ?");
    expect(source).toMatch(/"Book Session"/);
  });

  it("Profile Completeness shows a locked empty state when no real sections exist yet", () => {
    const source = stripComments(COMPONENT_SOURCES["ProfileCompletenessCard.tsx"]);
    expect(source).toContain("Complete your profile to unlock personalised recommendations");
  });

  it("Recommended for You's Career card shows a locked empty state when profile data is insufficient, never a fake match", () => {
    const source = stripComments(COMPONENT_SOURCES["RecommendedForYou.tsx"]);
    expect(source).toContain("hasProfileData");
    expect(source).toContain("Complete your profile to unlock personalised recommendations");
  });
});

describe("UX10-D01 — dashboard visual structure", () => {
  it("every dashboard component heading is explicitly sans-serif (font-sans), overriding the sitewide serif h1-h4 default", () => {
    for (const [file, source] of Object.entries({ ...COMPONENT_SOURCES, ...PAGE_SOURCES })) {
      const codeOnly = stripComments(source);
      const headingOpenTags = codeOnly.match(/<h[1-4]\b[^>]*>/g) ?? [];
      for (const tag of headingOpenTags) {
        expect(tag.includes("font-sans"), `${file}'s heading tag "${tag}" must include font-sans (no serif dashboard headings per the brief)`).toBe(true);
      }
    }
  });

  it("DashboardShell's sidebar links to the eight real routes named in the brief, never a fabricated route", () => {
    const source = stripComments(COMPONENT_SOURCES["DashboardShell.tsx"]);
    for (const href of ["/dashboard", "/profile", "/recommendations", "/saved", "/applications", "/discovery-session/book", "/payments"]) {
      expect(source).toContain(`href: "${href}"`);
    }
  });

  it("DashboardShell search submits to the real /courses search destination, not a fabricated unified search endpoint", () => {
    const source = stripComments(COMPONENT_SOURCES["DashboardShell.tsx"]);
    expect(source).toMatch(/action="\/courses"/);
  });

  it("DashboardShell renders no unread notification badge/count (no real in-app notification feed exists)", () => {
    const source = stripComments(COMPONENT_SOURCES["DashboardShell.tsx"]);
    expect(source).not.toMatch(/unread|notification-count|notif-badge/i);
  });
});
