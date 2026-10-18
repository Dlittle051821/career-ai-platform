import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * UX10-REC01 "RECOMMENDATIONS EXPERIENCE REDESIGN" — static source-text
 * audit, same "no React Testing Library/jsdom" convention as
 * src/lib/dashboard/dashboard-reference-audit.test.ts and
 * src/lib/profile/profile-reference-audit.test.ts. Lives under
 * src/lib/recommendations/ so it is picked up by the existing
 * "src/lib/recommendations/**\/*.test.ts" vitest include glob — no config
 * change needed for this milestone (unlike UX10-DS02's safe-redirect.ts,
 * which needed a new glob entry).
 *
 * Covers brief section 43's mandatory regression categories: no
 * hardcoded mockup data (names/careers/percentages/verification claims),
 * real engine/readiness/next-best-action/saved-items reuse, India+Europe
 * country allowlist, honesty copy, real routes, exactly one page
 * resolving to /recommendations, and DashboardShell/MobileTabBar
 * integration left intact.
 */

const ROOT = path.resolve(__dirname, "../../..");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const REC01_SOURCE_FILES = [
  "src/app/recommendations/layout.tsx",
  "src/app/recommendations/page.tsx",
  "src/components/sections/recommendations/RecommendationsHero.tsx",
  "src/components/sections/recommendations/ReadinessOverviewChips.tsx",
  "src/components/sections/recommendations/RecommendationsTabs.tsx",
  "src/components/sections/recommendations/ProfileAtAGlanceCard.tsx",
  "src/components/sections/recommendations/RecommendationInsightsCard.tsx",
  "src/components/sections/recommendations/RecommendationCard.tsx",
  "src/components/sections/recommendations/MatchBandBadge.tsx",
  "src/components/sections/recommendations/ReadinessBadge.tsx",
];

// Every one of these strings is an EXAMPLE value from the reference
// mockup that the brief explicitly forbids hardcoding (section 16 /
// governing instruction: "treat every person name, recommendation
// example, image, score, saved item, profile field, and verification
// label in the mockup as illustrative only").
const FORBIDDEN_LITERALS = [
  "Aarav",
  "92%",
  "86%",
  "82%",
  "95% Match",
  "89% Match",
  "Data Science & AI",
  "Reviewed by our counselling framework",
];

describe("UX10-REC01 reference audit — no fabricated mockup data", () => {
  for (const relativePath of REC01_SOURCE_FILES) {
    it(`${relativePath} contains no hardcoded mockup example data`, () => {
      expect(existsSync(path.join(ROOT, relativePath)), `expected ${relativePath} to exist`).toBe(true);
      const content = stripComments(read(relativePath));
      for (const literal of FORBIDDEN_LITERALS) {
        expect(content, `${relativePath} must not contain "${literal}"`).not.toContain(literal);
      }
    });
  }

  it("no career card ever renders a raw numeric match percentage — MatchBandBadge (qualitative only) is used instead", () => {
    const cardSource = stripComments(read("src/components/sections/recommendations/RecommendationCard.tsx"));
    expect(cardSource).not.toMatch(/\d{1,3}%\s*(match|Match)/);
    expect(cardSource).toContain("MatchBandBadge");

    const tabsSource = stripComments(read("src/components/sections/recommendations/RecommendationsTabs.tsx"));
    expect(tabsSource).not.toMatch(/\d{1,3}%\s*(match|Match)/);
  });

  it("Recommendation Insights never claims 'Counsellor Verified'/'Reviewed by our counselling framework' unconditionally", () => {
    const source = stripComments(read("src/components/sections/recommendations/RecommendationInsightsCard.tsx"));
    expect(source).not.toContain("Reviewed by our counselling framework");
    // The only verified-related copy must be gated on the real readiness level.
    expect(source).toContain('careerReadiness?.level === "COUNSELLOR_VERIFIED"');
  });

  it("Recommendation Insights never renders a counsellor's name", () => {
    const source = stripComments(read("src/components/sections/recommendations/RecommendationInsightsCard.tsx"));
    expect(source).not.toContain("verifiedByCounsellorName");
  });
});

describe("UX10-REC01 reference audit — real data sources, never fabricated", () => {
  it("the real recommendations page fetches real data sources", () => {
    const content = stripComments(read("src/app/recommendations/page.tsx"));
    expect(content).toContain("getStudentProfileSnapshot");
    expect(content).toContain("getMyRecommendationReadiness");
    expect(content).toContain("getCareersForMatching");
    expect(content).toContain("getRecommendations");
    expect(content).toContain("hasMinimumProfileDataForRecommendations");
    expect(content).toContain("getNextBestAction");
    expect(content).toContain("listSavedItems");
    expect(content).toContain("calculateCompletion");
  });

  it("reuses the real getNextBestAction() rather than constructing a competing decision", () => {
    const content = stripComments(read("src/app/recommendations/page.tsx"));
    expect(content).toContain('from "@/lib/dashboard/next-best-action"');
    expect(content).toMatch(/getNextBestAction\(\{/);
  });

  it("saved items are scoped to the real entity types only (university/course), never a fabricated saved career", () => {
    const pageSource = stripComments(read("src/app/recommendations/page.tsx"));
    expect(pageSource).toContain('entityType === "university"');
    expect(pageSource).toContain('entityType === "course"');
    expect(pageSource).not.toMatch(/entityType === "career"/);
  });

  it("Compare deep-links into the real /compare page rather than building a second comparator", () => {
    const tabsSource = stripComments(read("src/components/sections/recommendations/RecommendationsTabs.tsx"));
    expect(tabsSource).toContain("compareHref");
    expect(tabsSource).not.toContain("buildComparisonMatrix");

    const pageSource = stripComments(read("src/app/recommendations/page.tsx"));
    expect(pageSource).toMatch(/\/compare\?a=/);
  });

  it("Courses and Countries tabs never claim a personalised ranking exists", () => {
    const content = stripComments(read("src/components/sections/recommendations/RecommendationsTabs.tsx"));
    expect(content.toLowerCase()).toMatch(/no personalised.*(course|ranking)/);
    expect(content.toLowerCase()).toMatch(/no personalised country ranking/);
  });
});

describe("UX10-REC01 reference audit — India + Europe destination allowlist", () => {
  it("only the approved European destinations appear, never USA/UK/Canada/Australia", () => {
    const content = read("src/components/sections/recommendations/RecommendationsTabs.tsx");
    const forbidden = ["USA", "United States", "United Kingdom", "\\bUK\\b", "Canada", "Australia"];
    for (const term of forbidden) {
      expect(content).not.toMatch(new RegExp(term));
    }
    for (const approved of ["Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"]) {
      expect(content).toContain(approved);
    }
  });
});

describe("UX10-REC01 reference audit — exactly one route resolves to /recommendations", () => {
  it("the old (site)-group page no longer exists", () => {
    expect(existsSync(path.join(ROOT, "src/app/(site)/recommendations/page.tsx"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/app/(site)/recommendations"))).toBe(false);
  });

  it("the new top-level route exists with its own layout", () => {
    expect(existsSync(path.join(ROOT, "src/app/recommendations/page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src/app/recommendations/layout.tsx"))).toBe(true);
  });

  it("the new layout reuses the real DashboardShell, not a second sidebar design", () => {
    const content = stripComments(read("src/app/recommendations/layout.tsx"));
    expect(content).toContain('from "@/components/dashboard/DashboardShell"');
    expect(content).not.toMatch(/function\s+\w*Sidebar/);
  });
});

describe("UX10-REC01 reference audit — nav integration left intact, not duplicated", () => {
  it("DashboardShell's own NAV_ITEMS already links Recommendations — this milestone does not add a second nav entry", () => {
    const content = stripComments(read("src/components/dashboard/DashboardShell.tsx"));
    const matches = content.match(/href:\s*"\/recommendations"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("MobileTabBar's own 'My Plan' tab already points at /recommendations — not modified by this milestone", () => {
    const content = stripComments(read("src/components/dashboard/MobileTabBar.tsx"));
    expect(content).toContain('href: "/recommendations"');
  });

  it("this milestone does not build a second mobile bottom-nav component", () => {
    const dir = path.join(ROOT, "src/components/sections/recommendations");
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".tsx")) continue;
      expect(file.toLowerCase()).not.toContain("tabbar");
      expect(file.toLowerCase()).not.toContain("mobilenav");
    }
  });
});

describe("UX10-REC01 reference audit — honesty/guidance copy preserved", () => {
  it("the real, pre-existing rules-based disclaimer is still present", () => {
    const content = read("src/app/recommendations/page.tsx").replace(/\s+/g, " ");
    expect(content).toContain("not a scientifically validated psychometric assessment");
    expect(content).toContain("not generated by an AI model");
  });

  it("does not claim a counsellor-reviewed framework anywhere in the new UI's actual rendered output (docblocks may legitimately quote the forbidden phrase while explaining why it's never used)", () => {
    for (const relativePath of REC01_SOURCE_FILES) {
      const content = stripComments(read(relativePath));
      expect(content).not.toContain("Reviewed by our counselling framework");
    }
  });
});
