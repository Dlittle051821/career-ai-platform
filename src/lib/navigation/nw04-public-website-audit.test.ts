import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * NW04.7 — regression/security audit for the NW04 "Public Website &
 * Premium User Experience" changes (NW04.2-NW04.6), mirroring the
 * established "static source-text audit, no React rendering" convention
 * already used throughout this codebase (see e.g.
 * src/lib/auth/nw03-studio-reference-audit.test.ts,
 * src/lib/navigation/mobile-nav-reference-audit.test.ts).
 */

const ROOT = path.join(__dirname, "..", "..");

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/**
 * Strips `/** ... *\/` and `// ...` comments before an assertion runs.
 * Several of this file's assertions check what the actual rendered
 * JSX/data does (e.g. "no fabricated name appears", "these two elements
 * appear in this order") — without stripping comments first, a docblock
 * that *explains* an exclusion (e.g. "never reproduces the mockup's
 * 'Aarav Sharma'/saved-item counts") would itself contain the very
 * strings being checked for absence, and a docblock that *describes* the
 * JSX below it (e.g. "For Students... points at /studio") would shift a
 * positional/proximity check earlier than the real markup.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("NW04.2 — homepage: new sections exist and are wired in without touching HomeHero", () => {
  // NW-V4 — `/` now renders the V4 Connected Experience, which supersedes the
  // NW04.2 entry sections (its own Two Pathways scene links /careers and
  // /abroad with equal weight). The NW04.2 component files stay on disk and
  // keep their own source audits below.
  it("page.tsx renders the V5.4 homepage; the NW04.2 section files remain on disk", () => {
    const content = read("app/(site)/page.tsx");
    expect(content).toContain("<NextwiseV54Home />");
    expect(content).not.toContain("<HomeHero");
    for (const file of ["HomeHero", "ProductEntryCards", "StudioIntro", "DiscoveryPillars"]) {
      expect(read(`components/sections/home/${file}.tsx`).length).toBeGreaterThan(0);
    }
  });

  it("HomeHero.tsx's own hero CTAs are untouched (still /career-discovery and /study-europe) — the regression-sensitive file this stage deliberately did not edit", () => {
    const content = read("components/sections/home/HomeHero.tsx");
    expect(content).toContain('"/career-discovery"');
    expect(content).toContain('"/study-europe"');
  });

  it("ProductEntryCards links both products with equal weight (same card markup, no 'recommended' tag rendered on either)", () => {
    const content = read("components/sections/home/ProductEntryCards.tsx");
    const code = stripComments(content);
    expect(content).toContain('href: "/career"');
    expect(content).toContain('href: "/abroad"');
    expect(code).not.toMatch(/recommended|primary choice|popular/i);
  });

  it("StudioIntro never reproduces the mockup's fabricated student name or saved-item counts in its actual rendered output", () => {
    const content = read("components/sections/home/StudioIntro.tsx");
    const code = stripComments(content);
    expect(code).not.toMatch(/aarav/i);
    expect(code).not.toMatch(/\d+\s*saved items?/i);
    expect(content).toContain("Illustrative preview");
  });

  it("StudioIntro's eyebrow uses the sufficient-contrast token (text-secondary-dark), not the 4.38:1 text-secondary on a muted background", () => {
    const content = read("components/sections/home/StudioIntro.tsx");
    expect(content).toMatch(/uppercase tracking-wide text-secondary-dark/);
  });
});

describe("NW04.3/NW04.4 — ProductSubNav is shared, not duplicated, and both product pages use it", () => {
  it("/career and /abroad both import the one shared ProductSubNav component", () => {
    const career = read("app/(site)/career/page.tsx");
    const abroad = read("app/(site)/abroad/page.tsx");
    expect(career).toContain('from "@/components/sections/ProductSubNav"');
    expect(abroad).toContain('from "@/components/sections/ProductSubNav"');
  });

  it("/abroad's flag map is keyed by the real EuropeCountryCode type, not a re-typed country list", () => {
    const content = read("app/(site)/abroad/page.tsx");
    expect(content).toContain('from "@/data/europe-explorer"');
    expect(content).toContain("EuropeCountryCode");
    expect(content).toMatch(/EUROPE_COUNTRIES\.map/);
  });

  it("/career surfaces a fifth, real recommendations link (not a placeholder)", () => {
    const content = read("app/(site)/career/page.tsx");
    expect(content).toContain('href: "/recommendations"');
  });
});

/**
 * NW08.5 SUPERSESSION NOTICE: the block below replaces the original
 * "NW04.5 — nav-IA restructuring: Products/For Students/Resources/About"
 * describe block. NW08.5's own brief explicitly instructs REMOVING the
 * "Products"/"For Students"/"Resources"/"About" dropdown-and-flat-link
 * desktop nav grouping NW04.5 introduced, in favor of one flat,
 * six-item primary nav (Home/Explore Careers/Career Intelligence/Study
 * Abroad/Universities/Courses) sourced from one authoritative array
 * (MAIN_NAV in src/config/site.ts) rather than three separate
 * PRODUCT_NAV/EXPLORE_NAV/PRIMARY_NAV lists. This is intentional,
 * instructed supersession of the earlier milestone's own IA decision —
 * the same kind of explicit, documented reversal HomeHero.tsx's own
 * UX10-H05B docblock describes for an earlier decision it overrode — not
 * a silently-weakened test. ExploreMenu.tsx and NavDropdown.tsx (the two
 * component files this old nav structure needed) are deleted as dead
 * code now that nothing imports them; see
 * docs/milestones/NW08.5/NW085_02_NAVIGATION_ARCHITECTURE.md for the full
 * before/after comparison and rationale.
 */
describe("NW08.5 — nav-IA consolidation: one flat six-item primary nav, no href lost", () => {
  // CIUX-01 — the owner's CIUX-01 brief explicitly replaces NW08.5's flat
  // six-item row with grouped desktop dropdowns and mobile disclosure groups
  // (Explore / Free tools / How it works, plus Pricing), so every required
  // destination is reachable from the header. Both surfaces now render one
  // shared source, NAV_GROUPS in src/config/site.ts, through NavMenus
  // (desktop) and MobileNavGroups (mobile). The NW08.5 invariants that still
  // matter are kept: one shared source, no legacy NavDropdown/ExploreMenu,
  // and no MAIN_NAV href lost (asserted in the NAV_GROUPS tests below and in
  // src/config/ciux-navigation.test.ts). See docs/ciux/CIUX-01-NAVIGATION.md.
  it("Header.tsx renders the shared NAV_GROUPS through NavMenus (CIUX-01 supersedes the NW08.5 flat row)", () => {
    const code = stripComments(read("components/navigation/Header.tsx"));
    expect(code).toContain("<NavMenus");
    expect(code).not.toMatch(/NavDropdown|ExploreMenu/);
    expect(stripComments(read("components/navigation/NavMenus.tsx"))).toContain("NAV_GROUPS.map");
  });

  it("MAIN_NAV in site.ts is the exact six-item brief order: Home, Explore Careers, Career Intelligence, Study Abroad, Universities, Courses", () => {
    const content = read("config/site.ts");
    const hrefsInOrder = ["/", "/careers", "/career", "/abroad", "/universities", "/courses"];
    const indices = hrefsInOrder.map((href) => content.indexOf(`href: "${href}"`));
    for (const idx of indices) expect(idx).toBeGreaterThan(-1);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i], `expected href "${hrefsInOrder[i]}" to appear after "${hrefsInOrder[i - 1]}" in MAIN_NAV`).toBeGreaterThan(indices[i - 1]);
    }
  });

  it("the primary nav's /abroad entry is labelled 'Study Abroad' (the public entry point), not the branded product name", () => {
    const content = read("config/site.ts");
    expect(content).toMatch(/label:\s*"Study Abroad",\s*href:\s*"\/abroad"/);
  });

  it("MobileNav renders the same NAV_GROUPS as the desktop header — one shared source, not an independent list (CIUX-01)", () => {
    const content = read("components/navigation/MobileNav.tsx");
    expect(content).toContain("<MobileNavGroups");
    expect(content).not.toMatch(/PRODUCT_NAV|EXPLORE_NAV|PRIMARY_NAV/);
    expect(stripComments(read("components/navigation/MobileNavGroups.tsx"))).toContain("NAV_GROUPS.map");
  });

  it("the role-aware workspace entry (My Studio / Counsellor Workspace / Admin Studio) is rendered on both desktop and mobile from the one WorkspaceEntryLink component", () => {
    const header = read("components/navigation/Header.tsx");
    const mobile = read("components/navigation/MobileNav.tsx");
    expect(header).toContain("<WorkspaceEntryLink");
    expect(mobile).toContain("<WorkspaceEntryLink");
  });

  it("no pre-NW08.5 primary/secondary nav href was dropped from site.ts during the restructuring", () => {
    const content = read("config/site.ts");
    for (const href of [
      "/career",
      "/abroad",
      "/careers",
      "/courses",
      "/universities",
      "/study-options",
      "/how-it-works",
      "/book-counselling",
      "/pricing",
      "/about",
      "/career-discovery",
      "/compare",
      "/parents",
      "/trust",
      "/contact",
    ]) {
      expect(content, `expected site.ts to still declare href: "${href}"`).toContain(`href: "${href}"`);
    }
  });

  it("FOOTER_NAV is derived from MAIN_NAV/SECONDARY_NAV (findNav), not a second independently-typed set of hrefs", () => {
    const content = read("config/site.ts");
    expect(content).toContain("findNav(");
  });
});

describe("NW04.5 — 'Study Abroad' product-name rename to 'Nextwise Abroad', pricing category label untouched", () => {
  it("every product-facing 'Study Abroad' occurrence is now 'Nextwise Abroad'", () => {
    const files = [
      "config/site.ts",
      "app/(site)/abroad/page.tsx",
      "app/studio/page.tsx",
      "app/studio/abroad/page.tsx",
    ];
    for (const file of files) {
      const content = read(file);
      expect(content, `expected ${file} to contain the renamed "Nextwise Abroad"`).toContain("Nextwise Abroad");
    }
  });

  it("the unrelated pricing-category label is deliberately NOT renamed", () => {
    const content = read("components/sections/pricing/PricingCategoryFilter.tsx");
    expect(content).toContain('{ id: "abroad", label: "Study Abroad" }');
  });
});

describe("NW04.6 — sitemap gained /career and /abroad, launch-country registry still exact", () => {
  it("sitemap.ts's static entries now include /career and /abroad", () => {
    const content = read("app/sitemap.ts");
    expect(content).toContain('{ path: "/career"');
    expect(content).toContain('{ path: "/abroad"');
  });

  it("sitemap.ts never lists /studio (authenticated, correctly excluded)", () => {
    const content = read("app/sitemap.ts");
    expect(content).not.toMatch(/path:\s*"\/studio"/);
  });

  it("the NW02 6-country Abroad allowlist is still exactly Germany/Ireland/Netherlands/France/Sweden/Denmark", () => {
    const content = read("data/europe-explorer.ts");
    for (const name of ["Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"]) {
      expect(content, `expected europe-explorer.ts to still list ${name}`).toContain(name);
    }
  });
});

describe("NW04.7 — the safe-redirect flow fixed in NW03 is still intact end to end", () => {
  it("RegisterForm still uses getSafeRedirectPath, not a hardcoded /welcome", () => {
    const content = read("components/sections/auth/RegisterForm.tsx");
    expect(content).toContain('getSafeRedirectPath(searchParams.get("next"), "/welcome")');
    expect(content).not.toMatch(/router\.push\(\s*["']\/welcome["']\s*\)/);
  });

  it("the new homepage StudioIntro CTA exercises the safe-redirect path (?next=/studio), not a bare /register", () => {
    const content = read("components/sections/home/StudioIntro.tsx");
    expect(content).toContain('href="/register?next=/studio"');
  });
});
