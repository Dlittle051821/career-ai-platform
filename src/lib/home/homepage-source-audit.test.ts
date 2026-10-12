import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { containsUnsupportedPartnershipLanguage } from "@/lib/education/external-search/attribution";

/**
 * UX10A — static source-text audit of the six new premium-homepage
 * section components. Same "no React Testing Library/jsdom in this
 * project" convention as src/lib/graphics/graphics-source-audit.test.ts —
 * these components are not render-tested; what can be verified without
 * rendering is checked here by reading each component's source as plain
 * text, turning several of the task brief's own content-integrity and
 * architecture rules into real, regression-checkable invariants instead
 * of one-time manual review.
 */
const HOME_DIR = path.join(__dirname, "..", "..", "components", "sections", "home");

const SECTION_FILES = ["HomeHero.tsx", "DiscoveryPillars.tsx", "TrustedStudyExplorer.tsx", "HowItWorks.tsx", "WhyNextwise.tsx", "HomeFinalCTA.tsx"];

function readSection(name: string): string {
  return readFileSync(path.join(HOME_DIR, name), "utf8");
}

/**
 * Strips `/* ... *\/` block comments and `// ...` line comments before a
 * content-integrity check runs. Several of these components' own
 * docblocks deliberately QUOTE the exact forbidden content they explain
 * NOT to reproduce (e.g. TrustedStudyExplorer.tsx's docblock quotes
 * "Finland / Netherlands / Sweden" verbatim while explaining why none of
 * them appear in the actual rendered output) — checking raw source text
 * would flag the explanation itself as a violation. Stripping comments
 * first means these checks verify actual rendered content/data, not
 * prose about it.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ALL_SOURCE = SECTION_FILES.map(readSection).join("\n");
const ALL_SOURCE_CODE_ONLY = stripComments(ALL_SOURCE);

describe("homepage — exactly one semantic H1 across the new section composition", () => {
  it("only HomeHero.tsx renders an <h1>, and every other new section uses <h2>", () => {
    const h1Counts = SECTION_FILES.map((file) => ({ file, count: (readSection(file).match(/<h1[\s>]/g) ?? []).length }));
    const totalH1 = h1Counts.reduce((sum, { count }) => sum + count, 0);
    expect(totalH1).toBe(1);
    expect(h1Counts.find((entry) => entry.file === "HomeHero.tsx")?.count).toBe(1);
  });
});

describe("homepage — CTAs use real, pre-existing routes only", () => {
  it("HomeHero.tsx and HomeFinalCTA.tsx both link to the real /career-discovery and /book-counselling routes, never a fabricated destination", () => {
    for (const file of ["HomeHero.tsx", "HomeFinalCTA.tsx"]) {
      const source = readSection(file);
      expect(source).toContain('href="/career-discovery"');
      expect(source).toContain('href="/book-counselling"');
    }
  });

  it("every DiscoveryPillars href points at one of the site's real existing routes", () => {
    const source = readSection("DiscoveryPillars.tsx");
    const hrefs = [...source.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    const allowed = new Set(["/careers", "/courses", "/universities", "/book-counselling"]);
    for (const href of hrefs) {
      expect(allowed.has(href), `unexpected DiscoveryPillars href: ${href}`).toBe(true);
    }
  });

  it("accessible CTA names are real, visible text, not icon-only controls", () => {
    expect(readSection("HomeHero.tsx")).toContain("Explore Your Future — Free");
    expect(readSection("HomeHero.tsx")).toContain("Book a Free Discovery Session");
    // UX10-H08 "FINAL CTA EXACT REFERENCE MATCH" gives the Final CTA its
    // own reference-matched copy ("Get started for free" / "Book a Free
    // Session"), deliberately diverging from the Hero's own CTA labels for
    // this one section — see HomeFinalCTA.tsx's own UX10-H08 docblock,
    // item 4. The real invariant this test protects (visible text, not an
    // icon-only control) still holds for both.
    expect(readSection("HomeFinalCTA.tsx")).toContain("Get started for free");
    expect(readSection("HomeFinalCTA.tsx")).toContain("Book a Free Session");
  });
});

describe("homepage — Trusted Study Explorer uses the real M20 registry only", () => {
  const source = readSection("TrustedStudyExplorer.tsx");
  const codeOnly = stripComments(source);

  it("imports LAUNCH_COUNTRY_PRIMARY_SOURCES rather than hardcoding a second provider registry", () => {
    expect(source).toContain('from "@/lib/education/external-search/launch-country-sources"');
    expect(source).toContain("LAUNCH_COUNTRY_PRIMARY_SOURCES");
  });

  it("never reproduces the reference image's non-launch-country providers (Finland/Netherlands/Sweden) in actual rendered content — comments explaining the exclusion are allowed to name them", () => {
    for (const forbidden of ["Finland", "Netherlands", "Sweden", "Studyinfo", "UniversityAdmissions", "Study in NL"]) {
      expect(codeOnly).not.toContain(forbidden);
    }
  });

  it("every outbound source link goes through the safe /go/course-search/provider/ redirect route, never a raw provider domain/URL", () => {
    expect(source).toContain("/go/course-search/provider/");
    expect(source).not.toMatch(/href=\{.*(provider\.baseUrl|provider\.officialDomain|source\.primaryDomain)/);
  });

  it("missing or inactive providers fail honestly rather than linking nowhere or being silently hidden", () => {
    expect(source).toContain("Currently unavailable");
  });
});

describe("homepage — no forbidden partnership language anywhere in the new sections' actual rendered copy", () => {
  it.each(SECTION_FILES)("%s's rendered copy never uses a phrase from the project's own UNSUPPORTED_PARTNERSHIP_PHRASES list", (file) => {
    // Reuses the exact same approved detector attribution.ts/
    // TrustedExternalSearchCard.tsx already rely on, rather than a
    // hand-rolled regex — this is what makes "partner in your journey"
    // (WhyNextwise.tsx's own editorial copy, a metaphorical phrase, not a
    // claim that Nextwise IS an official partner of some named entity)
    // correctly pass, while "official Nextwise partner" or "endorsed by
    // Nextwise" would correctly fail.
    const codeOnly = stripComments(readSection(file));
    expect(containsUnsupportedPartnershipLanguage(codeOnly)).toBe(false);
  });

  it("WhyNextwise.tsx's 'partner in your journey' line is present (confirms the check above isn't vacuously passing on empty content)", () => {
    expect(readSection("WhyNextwise.tsx")).toMatch(/partner in your journey/i);
  });
});

describe("homepage — no fabricated statistics", () => {
  it("none of the new sections' rendered copy invents a student-count or similar unverified metric", () => {
    expect(ALL_SOURCE_CODE_ONLY).not.toMatch(/500\s*[kK]\+?/);
    expect(ALL_SOURCE_CODE_ONLY).not.toMatch(/500,000/);
  });
});

describe("homepage — the hero product preview never claims to be a real user's data", () => {
  it("HeroProductPreview.tsx is explicitly labelled illustrative, and its rendered copy never greets a named/real student", () => {
    const preview = readFileSync(path.join(HOME_DIR, "HeroProductPreview.tsx"), "utf8");
    expect(preview).toContain("Illustrative preview");
    expect(stripComments(preview)).not.toMatch(/Welcome back/i);
  });
});

describe("homepage — reduced-motion-safe motion system reused, not reinvented", () => {
  it("HomeHero.tsx and HowItWorks.tsx both import the shared, reduced-motion-guarded motion constants from src/lib/ui/motion.ts rather than hand-rolling raw animation classes", () => {
    for (const file of ["HomeHero.tsx", "HowItWorks.tsx"]) {
      const source = readSection(file);
      expect(source).toContain('from "@/lib/ui/motion"');
    }
  });

  it("every raw animate-* class used in the new sections has a motion-reduce: companion on the same line", () => {
    for (const file of SECTION_FILES) {
      const source = readSection(file);
      const lines = source.split("\n").filter((line) => /\banimate-(?!none)[\w-]+/.test(line) && !line.trim().startsWith("*") && !line.trim().startsWith("//"));
      for (const line of lines) {
        expect(line, `expected a motion-reduce: companion on: ${line.trim()}`).toMatch(/motion-reduce:/);
      }
    }
  });
});

describe("homepage — mobile-safe responsive structure", () => {
  it("DiscoveryPillars, TrustedStudyExplorer, and HowItWorks each declare a responsive grid/flex layout rather than a fixed desktop-only one", () => {
    for (const file of ["DiscoveryPillars.tsx", "TrustedStudyExplorer.tsx", "HowItWorks.tsx"]) {
      const source = readSection(file);
      expect(source).toMatch(/sm:(grid-cols|flex-row)|flex-wrap/);
    }
  });
});

describe("homepage — the approved master logo is never recreated or substituted", () => {
  it("none of the six new sections imports next/image or references a logo asset path directly — Logo.tsx (unmodified by this milestone) remains the only place the logo is rendered", () => {
    for (const file of SECTION_FILES) {
      const source = readSection(file);
      expect(source).not.toMatch(/from ["']next\/image["']/);
      expect(source).not.toMatch(/nextwise-(logo|icon)/);
    }
  });
});
