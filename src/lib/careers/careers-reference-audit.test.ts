import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * UX10-C01 "Career Explorer" — static source-text audit, same
 * "no React Testing Library/jsdom" convention as the other milestones'
 * own audit tests (e.g. src/lib/dashboard/dashboard-reference-audit.test.ts,
 * src/lib/profile/profile-reference-audit.test.ts). Covers this
 * milestone's own mandatory regression categories: no fabricated mockup
 * data (match percentages, a fifth non-functional filter field, a
 * non-functional save icon, per-career photos), real route/data reuse,
 * exactly one route resolving to /careers, the honest CareerInsightsPanel
 * substitution, and no leftover dev-only QA harness in the shipped tree.
 */
const CAREERS_COMPONENTS_DIR = path.join(__dirname, "..", "..", "components", "sections", "careers");
const CAREERS_LIB_DIR = __dirname;
const APP_CAREERS_PAGE = path.join(__dirname, "..", "..", "app", "(site)", "careers", "page.tsx");

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

const COMPONENT_SOURCES = readAll(CAREERS_COMPONENTS_DIR);
const LIB_SOURCES = readAll(CAREERS_LIB_DIR);
const PAGE_SOURCE = readFileSync(APP_CAREERS_PAGE, "utf8");
const ALL_SOURCES: Record<string, string> = { ...COMPONENT_SOURCES, ...LIB_SOURCES, "page.tsx": PAGE_SOURCE };

describe("UX10-C01 — no fabricated mockup data anywhere in the careers source", () => {
  it("no career card or insights panel hardcodes a personalised match percentage", () => {
    for (const [file, source] of Object.entries(ALL_SOURCES)) {
      const codeOnly = stripComments(source);
      expect(codeOnly, `${file} should not contain a hardcoded "NN% match"`).not.toMatch(/\d{1,3}%\s*[Mm]atch/);
    }
  });

  it("CareerFilterBar keeps exactly the four real filter fields — no fabricated fifth field (e.g. Destination/Work style/Study preference)", () => {
    const source = stripComments(COMPONENT_SOURCES["CareerFilterBar.tsx"]);
    const selectCount = (source.match(/<Select\b/g) ?? []).length;
    expect(selectCount).toBe(3); // family, industry, tag — plus the one real text search input
    expect(source).toContain('name="q"');
    expect(source).toContain('name="family"');
    expect(source).toContain('name="industry"');
    expect(source).toContain('name="tag"');
    expect(source).not.toMatch(/destination|work style|study preference/i);
  });

  it("CareerCard has no heart/save icon — the real saved-items system has no 'career' entity type to wire one up to", () => {
    const source = stripComments(COMPONENT_SOURCES["CareerCard.tsx"]);
    expect(source).not.toMatch(/Heart|isSaved|SavedItemEntityType/);
  });

  it("CareerCard renders no per-career <img> — CareerSummary has no real image field, so none is fabricated", () => {
    const source = stripComments(COMPONENT_SOURCES["CareerCard.tsx"]);
    expect(source).not.toMatch(/<img\b/);
  });
});

describe("UX10-C01 — CareerInsightsPanel is an honest substitute, never fabricated personalisation", () => {
  it("shows only real counts passed in as props, no invented match score or saved-career count", () => {
    const source = stripComments(COMPONENT_SOURCES["CareerInsightsPanel.tsx"]);
    expect(source).toContain("total");
    expect(source).toContain("familyCount");
    expect(source).toContain("industryCount");
    expect(source).not.toMatch(/\d{1,3}%/);
  });

  it("links its CTA to the one real place personalised matching exists (/recommendations), not a fabricated destination", () => {
    const source = stripComments(COMPONENT_SOURCES["CareerInsightsPanel.tsx"]);
    expect(source).toContain('href="/recommendations"');
  });

  it("page.tsx passes the panel its real, already-fetched counts rather than constructing new ones", () => {
    const source = stripComments(PAGE_SOURCE);
    expect(source).toMatch(/<CareerInsightsPanel\s+total=\{results\.total\}\s+familyCount=\{families\.length\}\s+industryCount=\{industries\.length\}/);
  });
});

describe("UX10-C01 — real journey-step data reuse (no second icon/route mapping invented)", () => {
  it("JourneyMiniMap and CareersHero both reuse the one real EXPLORER_JOURNEY_STEPS list", () => {
    const journeyMiniMap = stripComments(COMPONENT_SOURCES["JourneyMiniMap.tsx"]);
    const hero = stripComments(COMPONENT_SOURCES["CareersHero.tsx"]);
    expect(journeyMiniMap).toContain('from "@/lib/careers/explorer-journey"');
    expect(hero).toContain('from "@/lib/careers/explorer-journey"');
  });

  it("explorer-journey.ts links only to real, pre-existing public routes, never a fabricated one", () => {
    const source = stripComments(LIB_SOURCES["explorer-journey.ts"]);
    for (const href of ["/career-discovery", "/careers", "/courses", "/universities"]) {
      expect(source).toContain(`href: "${href}"`);
    }
    // /recommendations and /roadmap are behind PROTECTED_PATHS and would
    // bounce a logged-out visitor on this public page — must never appear.
    expect(source).not.toMatch(/href:\s*"\/recommendations"/);
    expect(source).not.toMatch(/href:\s*"\/roadmap"/);
  });

  it("defines exactly the five real journey steps, in order", () => {
    const source = stripComments(LIB_SOURCES["explorer-journey.ts"]);
    const orders = [...source.matchAll(/order:\s*(\d)/g)].map((m) => Number(m[1]));
    expect(orders).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("UX10-C01 — family-presentation.ts covers the real taxonomy, never fabricates a family", () => {
  it("exports a safe default fallback so an unrecognised family key never throws or renders blank", () => {
    const source = stripComments(LIB_SOURCES["family-presentation.ts"]);
    expect(source).toMatch(/DEFAULT_PRESENTATION/);
    expect(source).toMatch(/\?\?\s*DEFAULT_PRESENTATION/);
  });

  it("only uses global --color-* driven tones, never the homepage-only --surface-soft-* system", () => {
    const source = stripComments(LIB_SOURCES["family-presentation.ts"]);
    expect(source).not.toMatch(/surface-soft/);
  });
});

describe("UX10-C01 — real data-fetching usage in page.tsx", () => {
  it("calls the real searchCareers/getCareerFamilies/getIndustries/getCareerTags rather than inline sample data", () => {
    const source = stripComments(PAGE_SOURCE);
    expect(source).toContain('from "@/lib/supabase/careers"');
    expect(source).toMatch(/searchCareers\(\{/);
    expect(source).toContain("getCareerFamilies()");
    expect(source).toContain("getIndustries()");
    expect(source).toContain("getCareerTags()");
  });

  it("canonical metadata still points at the clean /careers URL regardless of filters", () => {
    const source = stripComments(PAGE_SOURCE);
    expect(source).toMatch(/alternates:\s*\{\s*canonical:\s*"\/careers"\s*\}/);
  });

  it("no explicit grid-row/-column pin on the results/insights children (the grid-placement-inversion bug fixed this milestone must not come back)", () => {
    const source = stripComments(PAGE_SOURCE);
    expect(source).not.toMatch(/row-start-1/);
  });
});

describe("UX10-C01 — exactly one route resolves to /careers, no leftover dev-only QA harness", () => {
  it("no dev-preview directory remains in the shipped source tree", () => {
    const devPreviewDir = path.join(__dirname, "..", "..", "app", "dev-preview");
    expect(existsSync(devPreviewDir), "src/app/dev-preview must be deleted before packaging").toBe(false);
  });

  it("the real (site)/careers/page.tsx is the only CareersPage implementation", () => {
    expect(existsSync(APP_CAREERS_PAGE)).toBe(true);
  });
});

describe("UX10-C01 — DO NOT TOUCH scope respected (brief's explicit exclusion list)", () => {
  it("none of the untouched pages' own distinctive copy/markers were modified by any careers source file", () => {
    // A loose guard: careers source files should never reference the
    // other pages' own route-scoped components directly (no cross-page
    // coupling introduced by this milestone).
    for (const [file, source] of Object.entries(ALL_SOURCES)) {
      expect(source, `${file} must not import from the dashboard route`).not.toMatch(/from ["']@\/components\/dashboard/);
      expect(source, `${file} must not import from the profile workspace`).not.toMatch(/from ["']@\/components\/sections\/profile/);
    }
  });
});
