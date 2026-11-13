import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CIUX-01B — source guards for "one authoritative header" and "one page-hero
 * system". The browser evidence (geometry, screenshots, interactions) is in
 * docs/ciux/CIUX-01B-TESTING.md; these keep the architecture from drifting.
 */
const SRC = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

describe("CIUX-01B one global header", () => {
  it("the homepage renders the same SiteHeader component as every other page", () => {
    const home = strip(read("components/sections/home/v54/NextwiseV54Home.tsx"));
    expect(home).toContain('<SiteHeader context="home"');
    expect(home).not.toMatch(/<header\b/);
    expect(home).not.toMatch(/<NavMenus\b/);
  });

  it("the (site) layout renders the header once, through the layout boundary (not per page)", () => {
    const layout = strip(read("app/(site)/layout.tsx"));
    expect(layout.match(/<Header \/>/g)?.length).toBe(1);
    expect(layout).toContain("HEADER_GEOMETRY_SCRIPT");
    expect(layout).toContain('import "@/styles/site-header.css"');
    const pages = walk(path.join(SRC, "app/(site)")).filter((f) => !f.endsWith("layout.tsx"));
    const offenders = pages.filter((f) => /<(Header|SiteHeader)\b/.test(strip(readFileSync(f, "utf8"))));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("no other public component renders its own <header> bar", () => {
    const publicDirs = ["components/navigation", "components/sections", "components/layout"];
    const files = publicDirs.flatMap((d) => walk(path.join(SRC, d)));
    const offenders = files
      .filter((f) => !f.endsWith(path.join("navigation", "Header.tsx")))
      .filter((f) => /<header\b/.test(strip(readFileSync(f, "utf8"))));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the homepage stylesheet no longer styles the header (one stylesheet: src/styles/site-header.css)", () => {
    const v54 = read("components/sections/home/v54/v54.css");
    expect(v54).not.toMatch(/\.v54-pill|\.v54-nav\b|\.v54-login|\.v54-signup|\.v54-menu-btn|\.v54-menu\{/);
    const header = read("styles/site-header.css");
    for (const sel of [".nwh-pill::before", ".nwh-nav", ".nwh-panel", ".nwh-login", ".nwh-signup", ".nwh-menu-btn", "prefers-reduced-motion"]) {
      expect(header, sel).toContain(sel);
    }
  });

  it("navigation destinations are defined once (NAV_GROUPS) and used by both desktop and phone menus", () => {
    expect(strip(read("components/navigation/NavMenus.tsx"))).toContain("NAV_GROUPS.map");
    expect(strip(read("components/navigation/MobileNavGroups.tsx"))).toContain("NAV_GROUPS.map");
    expect(strip(read("components/navigation/MobileNav.tsx"))).toContain("<MobileNavGroups");
    expect(strip(read("components/navigation/Header.tsx"))).toMatch(/<NavMenus \/>[\s\S]*<MobileNav /);
  });
});

describe("CIUX-01B one page-hero system", () => {
  const HERO_PAGES: Record<string, string> = {
    "how-it-works": "components/sections/how-it-works/HowItWorksHero.tsx",
    careers: "components/sections/careers/CareersHero.tsx",
    pricing: "components/sections/pricing/PricingHero.tsx",
    "study-europe": "components/sections/europe-explorer/EuropeExplorerHero.tsx",
    "book-counselling": "components/sections/book-counselling/DiscoveryEntryHero.tsx",
    "discovery-session": "components/sections/discovery-session/DiscoverySessionHero.tsx",
  };

  it("every page-specific hero is built on the shared PageHero", () => {
    for (const [page, rel] of Object.entries(HERO_PAGES)) {
      const code = strip(read(rel));
      expect(code, page).toContain("<PageHero");
      expect(code, page).not.toMatch(/<h1\b/);
    }
  });

  it("no in-scope public page uses the previous generation's hero backdrop, cut-out or annotation images", () => {
    const files = [
      ...Object.values(HERO_PAGES),
      "components/sections/PageHero.tsx",
      "app/(site)/courses/page.tsx",
      "app/(site)/universities/page.tsx",
      "app/(site)/compare/page.tsx",
      "app/(site)/courses/compare/page.tsx",
    ];
    for (const rel of files) {
      expect(read(rel), rel).not.toMatch(/hero-campus-backdrop|nextwise-student-cutout|careers-hero-stage|annotation-/);
    }
  });

  it("the explorer and compare pages open with the shared hero", () => {
    for (const rel of ["app/(site)/courses/page.tsx", "app/(site)/universities/page.tsx", "app/(site)/compare/page.tsx", "app/(site)/courses/compare/page.tsx"]) {
      const code = strip(read(rel));
      expect(code, rel).toMatch(/<PageHero\s+size="compact"/);
      expect(code, rel).not.toMatch(/<h1\b/);
    }
  });

  it("How It Works carries the CIUX-01B first screen and links only to routes that exist", () => {
    const code = read("components/sections/how-it-works/HowItWorksHero.tsx");
    expect(code).toContain('title="Your next step,"');
    expect(code).toContain('titleAccent="made clearer."');
    for (const href of code.match(/href: "(\/[^"#]*)"/g) ?? []) {
      const route = href.slice(7, -1);
      expect(["/careers", "/career-discovery", "/courses"]).toContain(route);
    }
  });

  it("the hero uses the homepage's display face and respects reduced motion", () => {
    const css = read("styles/page-hero.css");
    expect(css).toContain("var(--font-v54-grotesk)");
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*\[data-rise\] \{ animation: none; \}/);
    expect(read("lib/fonts.ts")).toContain("v54Grotesk.variable");
  });
});
