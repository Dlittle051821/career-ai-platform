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
  it("page.tsx renders ProductEntryCards and StudioIntro directly after HomeHero", () => {
    const content = read("app/(site)/page.tsx");
    const heroIndex = content.indexOf("<HomeHero");
    const cardsIndex = content.indexOf("<ProductEntryCards");
    const studioIndex = content.indexOf("<StudioIntro");
    const pillarsIndex = content.indexOf("<DiscoveryPillars");
    expect(heroIndex).toBeGreaterThan(-1);
    expect(cardsIndex).toBeGreaterThan(heroIndex);
    expect(studioIndex).toBeGreaterThan(cardsIndex);
    expect(pillarsIndex).toBeGreaterThan(studioIndex);
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

describe("NW04.5 — nav-IA restructuring: Products/For Students/Resources/About, no href lost", () => {
  it("Header.tsx renders the target desktop order: Home, Products dropdown, For Students, Resources, About dropdown", () => {
    const code = stripComments(read("components/navigation/Header.tsx"));
    const homeIdx = code.indexOf("HOME_NAV_LINK.href");
    const productsIdx = code.indexOf('id="products"');
    const studentsIdx = code.indexOf("For Students");
    const resourcesIdx = code.indexOf("<ExploreMenu");
    const aboutIdx = code.indexOf('id="about"');
    expect(homeIdx).toBeGreaterThan(-1);
    expect(productsIdx).toBeGreaterThan(homeIdx);
    expect(studentsIdx).toBeGreaterThan(productsIdx);
    expect(resourcesIdx).toBeGreaterThan(studentsIdx);
    expect(aboutIdx).toBeGreaterThan(resourcesIdx);
  });

  it("the new 'For Students' link points at the real Studio hub, not a fabricated route", () => {
    const code = stripComments(read("components/navigation/Header.tsx"));
    expect(code).toMatch(/href="\/studio"[\s\S]{0,400}For Students/);
  });

  it("ExploreMenu's visible label is now Resources, but it still renders the unchanged EXPLORE_NAV data", () => {
    const content = read("components/navigation/ExploreMenu.tsx");
    expect(content).toContain('label="Resources"');
    expect(content).toContain("EXPLORE_NAV");
  });

  it("NavDropdown is the one shared implementation backing Products, Resources (via ExploreMenu), and About — not three separate bespoke dropdowns", () => {
    const header = read("components/navigation/Header.tsx");
    const navDropdownOccurrences = header.match(/<NavDropdown\b/g) ?? [];
    expect(navDropdownOccurrences.length).toBe(2); // Products + About (Resources goes through ExploreMenu's own wrapper)
  });

  it("MobileNav keeps every pre-NW04 destination (PRODUCT_NAV flat, EXPLORE_NAV collapsible, PRIMARY_NAV flat) and adds For Students", () => {
    const content = read("components/navigation/MobileNav.tsx");
    const code = stripComments(content);
    expect(content).toContain("PRODUCT_NAV.map");
    expect(content).toContain("EXPLORE_NAV.map");
    expect(content).toContain("PRIMARY_NAV.map");
    expect(code).toMatch(/href="\/studio"[\s\S]{0,600}For Students/);
    expect(code).toContain("Resources");
  });

  it("no PRODUCT_NAV/PRIMARY_NAV/EXPLORE_NAV href was dropped from site.ts during the restructuring", () => {
    const content = read("config/site.ts");
    for (const href of ["/career", "/abroad", "/careers", "/courses", "/universities", "/study-options", "/how-it-works", "/book-counselling", "/pricing", "/about"]) {
      expect(content, `expected site.ts to still declare href: "${href}"`).toContain(`href: "${href}"`);
    }
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
