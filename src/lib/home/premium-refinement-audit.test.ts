import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * UX10-H02 "Homepage Premium Visual Refinement" — static source-text
 * audit for the five non-hero sections this milestone touched
 * (DiscoveryPillars, TrustedStudyExplorer, HowItWorks, WhyNextwise,
 * HomeFinalCTA). Same "no React Testing Library/jsdom" convention as
 * every other audit test in this directory. The hero itself is covered
 * by hero-composition-audit.test.ts; this file is the rest of the brief's
 * own "visual refinement, not a content/architecture rewrite" promise —
 * categories, routes, trust model, and copy stay exactly as they were,
 * only the surrounding visual treatment moved.
 */
const HOME_DIR = path.join(__dirname, "..", "..", "components", "sections", "home");

function readSection(name: string): string {
  return readFileSync(path.join(HOME_DIR, name), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const DISCOVERY_SOURCE = readSection("DiscoveryPillars.tsx");
const TRUSTED_SOURCE = readSection("TrustedStudyExplorer.tsx");
const HOW_IT_WORKS_SOURCE = readSection("HowItWorks.tsx");
const WHY_NEXTWISE_SOURCE = readSection("WhyNextwise.tsx");
const FINAL_CTA_SOURCE = readSection("HomeFinalCTA.tsx");

describe("premium refinement — Discovery Pillars keep their four real categories/routes, only the surface treatment changed", () => {
  it("UX10-EU02 — now exactly three pillars (Build Your Career / Study in India / Study in Europe), per that milestone's own explicit brief and reference", () => {
    // Originally asserted the four UX10A pillars ["Career Explorer",
    // "Course Explorer", "University Explorer", "Trusted Guidance"].
    // UX10-EU02's own brief and attached reference are explicit and
    // repeated that this section becomes exactly three cards — see
    // DiscoveryPillars.tsx's own UX10-EU02 docblock entry for the full
    // reasoning, including why Course/University Explorer and Trusted
    // Guidance are no longer dedicated homepage pillars (all three remain
    // reachable via the main nav).
    const codeOnly = stripComments(DISCOVERY_SOURCE);
    const titles = [...codeOnly.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(titles).toEqual(["Build Your Career", "Study in India", "Study in Europe"]);
  });

  it("every card's main surface is a two-stop pastel gradient fill, matching the UX10-H04 final reference (not H02's neutral-white-plus-corner-glow treatment)", () => {
    const codeOnly = stripComments(DISCOVERY_SOURCE);
    // UX10-H04 moves from H03's flat single-color pastel fill to the exact
    // two-stop gradient hex pairs this milestone's own brief specifies
    // per card (still pastel, still card-scoped, never touching the
    // shared --surface-soft-* tokens). UX10-H06 layers a soft white
    // top-right radial "lift" highlight ahead of that same linear-gradient
    // (within the same backgroundImage value) for the reference's softer,
    // more dimensional background — see this component's own docblock,
    // item 2 — so the two-stop pair is still present, just no longer the
    // very first thing after `backgroundImage:`.
    expect(codeOnly).toMatch(/linear-gradient\(155deg, \$\{style\.gradientFrom\} 0%, \$\{style\.gradientTo\} 100%\)/);
    expect(codeOnly).toContain("#EAF3FF");
    expect(codeOnly).toContain("#DDEBFF");
  });

  it("UX10-H05B/EU02 — the surviving card illustration is the brief's own real supplied image asset, not an inline SVG stand-in; the two new EU02 cards intentionally carry none", () => {
    const codeOnly = stripComments(DISCOVERY_SOURCE);
    // DiscoveryIllustrations.tsx was H04's own stand-in, built when no
    // such asset existed in the repo. H05B's brief supplies the real
    // compass/books/globe/guidance-character PNGs directly and explicitly
    // forbids substituting them with simpler CSS/SVG icons — see this
    // component's own docblock. UX10-EU02 replaces the Course/University/
    // Guidance cards (and their course-books.png/university-globe.png/
    // guidance-character.png illustrations) with Study in India/Europe
    // cards that deliberately carry no illustration at all, rather than a
    // mismatched stock image — see DiscoveryPillars.tsx's own UX10-EU02
    // docblock entry. Only the surviving Career card's illustration still
    // applies.
    expect(codeOnly).not.toMatch(/from ["']@\/components\/graphics\/DiscoveryIllustrations["']/);
    expect(codeOnly).not.toMatch(/from ["']next\/image["']/);
    expect(codeOnly).toContain("/cards/career-compass.png");
    for (const retiredAsset of ["/cards/course-books.png", "/cards/university-globe.png", "/cards/guidance-character.png"]) {
      expect(codeOnly).not.toContain(retiredAsset);
    }
    expect(codeOnly).toMatch(/<img\s/);
  });

  it("mobile-safe responsive grid is preserved", () => {
    expect(DISCOVERY_SOURCE).toMatch(/sm:grid-cols-2/);
  });
});

describe("premium refinement — Trusted Study Explorer (UX10-EU02: now the EU01 Europe registry, plain verified links)", () => {
  // UX10-EU02 repoints this section from the M20 global registry to
  // UX10-EU01's Europe-only registry and from the DB-backed provider
  // redirect to plain, directly-verified external links — see
  // TrustedStudyExplorer.tsx's own UX10-EU02 docblock entry for the full
  // reasoning. The panel's visual language (one connected strip, tinted
  // tiles, sr-only trust label) is preserved; the assertions below are
  // updated to match the new data source and link architecture.
  it("still imports EUROPE_COUNTRIES, never a second hardcoded registry", () => {
    expect(TRUSTED_SOURCE).toContain("EUROPE_COUNTRIES");
  });

  it("every outbound link is a plain, directly-verified external link (never the M20 provider redirect)", () => {
    // Checked against comment-stripped source: this component's own
    // docblock legitimately names the old M20 provider-redirect route in
    // prose while explaining why it's superseded (see homepage-source-audit.test.ts's
    // stripComments docblock for the same convention).
    expect(stripComments(TRUSTED_SOURCE)).not.toContain("/go/course-search/provider/");
    expect(TRUSTED_SOURCE).toContain('target="_blank"');
    expect(TRUSTED_SOURCE).toContain('rel="noopener noreferrer"');
  });

  it("still carries the trusted-source signal (sr-only, matching the H06 reference's chip-free tile design); no DB-dependent 'unavailable' state remains, since every country now always has a verified direct link", () => {
    // UX10-H06 — the H06 reference shows no visible badge chip on any
    // tile. The trust label itself is not deleted: it moves to an
    // sr-only span (still announced to assistive technology). UX10-EU02 —
    // the old "Currently unavailable" fallback existed only because a
    // Supabase provider row could be missing/inactive; since this section
    // no longer depends on that table at all (see this component's own
    // UX10-EU02 docblock entry), that fallback state can no longer occur
    // and is correctly absent now, not silently dropped.
    expect(TRUSTED_SOURCE).toContain("TRUSTED_NATIONAL_SOURCE_LABEL");
    expect(TRUSTED_SOURCE).toMatch(/sr-only/);
    // Checked against comment-stripped source: this component's own
    // docblock legitimately quotes the old "Currently unavailable" fallback
    // phrase in prose while explaining why it can no longer occur.
    expect(stripComments(TRUSTED_SOURCE)).not.toContain("Currently unavailable");
  });

  it("UX10-H06 — the intro block's 'Explore all countries' link is removed, matching the H06 reference's simplified intro (not shown there)", () => {
    // Checked against comment-stripped source — same false-positive
    // pattern as the checks above (this file's docblock names the old
    // link in prose while explaining its removal).
    expect(stripComments(TRUSTED_SOURCE)).not.toMatch(/Explore all countries/);
  });

  it("UX10-EU02 — never renders a non-approved launch country (UK/USA/Canada/Australia), including the old 'Government of Canada'/'EduCanada' tile this section no longer shows", () => {
    // UX10-H06's own Canada-naming regression guard no longer applies:
    // Canada is not one of UX10-EU01's six approved Europe launch
    // countries, so neither "Government of Canada" (the real M20 value)
    // nor "EduCanada" (the reference's unbacked label) should appear here
    // at all. Checked against comment-stripped source since this file's
    // own docblock may still name these in prose while explaining the
    // change.
    const codeOnly = stripComments(TRUSTED_SOURCE);
    expect(codeOnly).not.toMatch(/EduCanada/);
    expect(codeOnly).not.toMatch(/Government of Canada/);
  });

  it("tiles use a lighter tinted surface (color-mix against the page surface) rather than a flat bg-surface + border-border block", () => {
    expect(TRUSTED_SOURCE).toMatch(/color-mix\(in srgb, \$\{tone\.bg\}/);
  });

  it("UX10-H05B — the six country tiles and the intro block now sit inside one connected panel (divide-x/divide-y hairlines), not separate gap-ed cards", () => {
    // The reference shows [INTRO][DE][UK][US][CA][AU][IE] as one bordered
    // strip. Each tile no longer owns its own border/radius/shadow — see
    // this component's own docblock.
    expect(TRUSTED_SOURCE).toMatch(/divide-x/);
    expect(TRUSTED_SOURCE).toMatch(/divide-y/);
    expect(TRUSTED_SOURCE).not.toMatch(/rounded-\[1rem\]\s+border\s+p-3\.5/);
  });
});

describe("premium refinement — How It Works keeps its five steps and connecting-line logic, now inside one designed panel", () => {
  it("still exactly five steps, same titles, in the same order", () => {
    const codeOnly = stripComments(HOW_IT_WORKS_SOURCE);
    const titles = [...codeOnly.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(titles).toEqual(["Explore", "Discover your direction", "Compare study paths", "Get guidance", "Take action"]);
  });

  it("the steps row sits directly on the section's muted background, beside a left-hand title column, matching the UX10-H03 reference's one compact row (not H02's separate white panel)", () => {
    const codeOnly = stripComments(HOW_IT_WORKS_SOURCE);
    // UX10-H03 intentionally removes H02's own white-panel wrapper — the
    // reference shows one compact row with no separate panel box. See
    // this component's own docblock for the full reasoning. UX10-H07
    // widens the title column slightly (16% -> 20%) to fit its reinstated
    // supporting line — see this component's own UX10-H07 docblock note.
    expect(codeOnly).not.toMatch(/rounded-\[1\.75rem\][^"]*bg-surface/);
    expect(codeOnly).toMatch(/lg:w-\[20%\]/);
    expect(codeOnly).toMatch(/lg:flex-row/);
  });

  it("the animated connecting segment still uses the shared, reduced-motion-guarded FLOW_DASH_CLASSES constant rather than a hand-rolled animate-* class", () => {
    const codeOnly = stripComments(HOW_IT_WORKS_SOURCE);
    expect(codeOnly).toMatch(/from ["']@\/lib\/ui\/motion["']/);
    expect(codeOnly).toContain("FLOW_DASH_CLASSES");
    // No raw `animate-...` class hand-rolled directly in this file (the
    // only one that matters, flow-dash, is applied via the imported
    // constant above, which already carries its own motion-reduce guard).
    expect(codeOnly).not.toMatch(/\banimate-(?!none)[\w-]+/);
  });
});

describe("premium refinement — Why Nextwise (UX10-EU02: now 'Why Study in Europe?', reusing EU01's value-prop cards)", () => {
  it("'partner in your journey' line is still present", () => {
    expect(WHY_NEXTWISE_SOURCE).toMatch(/partner in your journey/i);
  });

  it("no fabricated student-count stat was introduced in actual rendered copy (the docblock's own prose explaining why '500K+' is NOT used is allowed to name it)", () => {
    const codeOnly = stripComments(WHY_NEXTWISE_SOURCE);
    expect(codeOnly).not.toMatch(/500\s*[kK]\+?/);
    expect(codeOnly).not.toMatch(/500,000/);
  });

  it("UX10-EU02 — reuses UX10-EU01's own honesty-audited WhyEuropeSection component rather than re-authoring new value-prop copy inline", () => {
    // The old three-column layout (checklist + NetworkGraphic-backed photo
    // card + stat tiles) is superseded — see WhyNextwise.tsx's own
    // UX10-EU02 docblock entry. NetworkGraphic itself is untouched and
    // still used elsewhere in this codebase; it simply isn't part of this
    // section's new, simpler composition.
    expect(WHY_NEXTWISE_SOURCE).toContain('from "@/components/sections/europe-explorer/WhyEuropeSection"');
    expect(WHY_NEXTWISE_SOURCE).toContain("Why Study in Europe?");
  });
});

describe("premium refinement — Final CTA (UX10-EU02: Europe-first copy and primary route); only the background/layering changed", () => {
  // UX10-H08 "FINAL CTA EXACT REFERENCE MATCH" updated the two CTA labels
  // to that milestone's own reference copy ("Get started for free" / "Book
  // a Free Session"). UX10-EU02 updates them again, per its own explicit
  // brief: primary CTA moves to "Explore Europe" -> /study-europe;
  // secondary becomes "Talk to an Expert", keeping the real
  // /book-counselling route — see HomeFinalCTA.tsx's own UX10-EU02
  // docblock entry.
  it("real routes, with the UX10-EU02 brief's own CTA copy", () => {
    expect(FINAL_CTA_SOURCE).toContain("Explore Europe");
    expect(FINAL_CTA_SOURCE).toContain("Talk to an Expert");
    expect(FINAL_CTA_SOURCE).toContain('href="/study-europe"');
    expect(FINAL_CTA_SOURCE).toContain('href="/book-counselling"');
  });

  it("the dark surface is still built from --brand-ink (no new color introduced), just a gradient of it", () => {
    expect(FINAL_CTA_SOURCE).toContain("var(--brand-ink)");
  });
});

describe("premium refinement — no SECTION_FILES change introduced next/image or a fabricated large stat anywhere in these five sections", () => {
  const SOURCES = [DISCOVERY_SOURCE, TRUSTED_SOURCE, HOW_IT_WORKS_SOURCE, WHY_NEXTWISE_SOURCE, FINAL_CTA_SOURCE];

  it("none of the five sections import next/image", () => {
    for (const source of SOURCES) {
      expect(source).not.toMatch(/from ["']next\/image["']/);
    }
  });

  it("none of the five sections reference the master logo asset directly", () => {
    for (const source of SOURCES) {
      expect(source).not.toMatch(/nextwise-(logo|icon)/);
    }
  });
});

describe("UX10-H04 — final reference match: announcement bar, hero backdrop, How It Works tone, Final CTA vista", () => {
  const PAGE_SOURCE = readFileSync(path.join(HOME_DIR, "..", "..", "..", "app", "(site)", "page.tsx"), "utf8");
  const HERO_SOURCE = readSection("HomeHero.tsx");
  const GRAPHICS_DIR = path.join(HOME_DIR, "..", "..", "graphics");
  const DISCOVERY_ILLUSTRATIONS_SOURCE = readFileSync(path.join(GRAPHICS_DIR, "DiscoveryIllustrations.tsx"), "utf8");
  const FINAL_CTA_VISTA_SOURCE = readFileSync(path.join(GRAPHICS_DIR, "FinalCtaVista.tsx"), "utf8");

  it("the homepage no longer renders AnnouncementStrip (the final reference's header has no navy bar) — the component file itself is left on disk, same convention as the other superseded section files", () => {
    expect(PAGE_SOURCE).not.toMatch(/<AnnouncementStrip\s*\/>/);
    expect(PAGE_SOURCE).not.toMatch(/import\s*\{\s*AnnouncementStrip\s*\}/);
  });

  it("HomeHero.tsx no longer renders GeometricBackdrop (its blurred circles were the source of the 'rectangle/circle watermark overlapping the photo' artifact)", () => {
    // Checked against comment-stripped source: this file's own docblock
    // legitimately explains the removal by naming the JSX tag in prose —
    // the same false-positive trap this test suite's other files already
    // guard against (see homepage-source-audit.test.ts's stripComments
    // docblock). The real invariant is that no CODE line renders the tag.
    expect(stripComments(HERO_SOURCE)).not.toMatch(/<GeometricBackdrop/);
  });

  it("UX10-H05B — CampusSkylineBackdrop (the illustrated SVG stand-in) is superseded by the brief's own real supplied campus/sky photo asset", () => {
    // H03/H04 used an original inline-SVG sky/skyline illustration
    // because no licensed photo existed in the repo. H05B's brief
    // supplies the real photo directly, so the SVG component is no
    // longer imported here (the component file itself stays on disk,
    // unreferenced — same convention as every other superseded file).
    expect(stripComments(HERO_SOURCE)).not.toMatch(/CampusSkylineBackdrop/);
    expect(HERO_SOURCE).toContain("/hero/campus-sky-backdrop.png");
    expect(HERO_SOURCE).toContain("hero-campus-backdrop");
  });

  it("GeometricBackdrop.tsx itself is untouched and still used by its other, non-homepage callers", () => {
    const geometricBackdropSource = readFileSync(path.join(GRAPHICS_DIR, "GeometricBackdrop.tsx"), "utf8");
    expect(geometricBackdropSource).toContain("export function GeometricBackdrop");
  });

  it("How It Works uses the 'surface' section tone, not 'muted' (bg-surface-alt's warm #f3efe7 read as a contrasting beige band the final reference does not show)", () => {
    expect(HOW_IT_WORKS_SOURCE).toMatch(/tone="surface"/);
    expect(HOW_IT_WORKS_SOURCE).not.toMatch(/tone="muted"/);
  });

  it("UX10-H04 — FinalCtaVista.tsx itself is still a self-contained local illustration, never a stock photo/next/image (kept on disk, unreferenced — see the next describe block for its UX10-H08 supersession)", () => {
    expect(FINAL_CTA_VISTA_SOURCE).not.toMatch(/from ["']next\/image["']/);
    expect(FINAL_CTA_VISTA_SOURCE).not.toMatch(/https?:\/\//);
  });

  it("the four Discovery Pillars illustrations are original inline SVG, never next/image or an external URL", () => {
    expect(DISCOVERY_ILLUSTRATIONS_SOURCE).not.toMatch(/from ["']next\/image["']/);
    expect(DISCOVERY_ILLUSTRATIONS_SOURCE).not.toMatch(/https?:\/\//);
    for (const name of ["CompassIllustration", "BooksIllustration", "GlobeCapIllustration", "AdviserIllustration"]) {
      expect(DISCOVERY_ILLUSTRATIONS_SOURCE).toContain(`export function ${name}`);
    }
  });

  it("UX10-H06/EU02 — Trusted Study Explorer renders real local SVG flags, not the emoji helper the H06 reference calls unreliable", () => {
    // The H06 brief explicitly asks for real/local SVG flag assets rather
    // than Unicode flag emoji, which render inconsistently (or fall back
    // to raw two-letter codes) across operating systems and browsers.
    // UX10-EU02 repoints this from CountryFlags.tsx's six global flags to
    // EuropeExplorerFlags.tsx's six Europe-launch flags (which itself
    // reuses CountryFlags.tsx's FlagDE/FlagIE rather than redefining them)
    // — see TrustedStudyExplorer.tsx's own UX10-EU02 docblock entry.
    // Checked against comment-stripped source: this file's own docblock
    // legitimately names the old helper in prose while explaining the
    // replacement — the same false-positive trap this test suite's other
    // files already guard against (see homepage-source-audit.test.ts's
    // stripComments docblock). The real invariant is that no CODE line
    // calls it.
    expect(stripComments(TRUSTED_SOURCE)).not.toMatch(/countryCodeToFlagEmoji/);
    expect(TRUSTED_SOURCE).toContain("EUROPE_EXPLORER_FLAGS");
    expect(TRUSTED_SOURCE).toContain("@/components/graphics/EuropeExplorerFlags");
    const countryFlagsSource = readFileSync(path.join(GRAPHICS_DIR, "CountryFlags.tsx"), "utf8");
    for (const name of ["FlagDE", "FlagGB", "FlagUS", "FlagCA", "FlagAU", "FlagIE"]) {
      expect(countryFlagsSource).toContain(`export function ${name}`);
    }
    expect(countryFlagsSource).not.toMatch(/https?:\/\//);
    const europeFlagsSource = readFileSync(path.join(GRAPHICS_DIR, "EuropeExplorerFlags.tsx"), "utf8");
    for (const name of ["FlagNL", "FlagFR", "FlagSE", "FlagDK"]) {
      expect(europeFlagsSource).toContain(`export function ${name}`);
    }
    expect(europeFlagsSource).not.toMatch(/https?:\/\//);
  });
});

describe("UX10-H08 'FINAL CTA EXACT REFERENCE MATCH' — FinalCtaVista superseded by the reference's own real photo, handwritten annotation deliberately reintroduced for this one section", () => {
  // This milestone's own brief explicitly rejects the prior inline-SVG
  // illustration ("do not use CSS placeholder geometry... use the
  // provided/approved sunset landscape asset") and treats its attached
  // reference image as that approved asset, with explicit permission to
  // crop it as a decorative, non-interactive image where a from-scratch
  // reproduction can't be matched cleanly — the same policy UX10-H05B
  // already established for the hero's own two annotation crops (see
  // hero-composition-audit.test.ts's "deliberate, documented reversal"
  // describe block). FinalCtaVista.tsx itself is left on disk, unused —
  // same convention as every other superseded illustration component in
  // this project (CampusSkylineBackdrop.tsx, DiscoveryIllustrations.tsx).
  it("Final CTA no longer imports or renders FinalCtaVista, and renders the real photo crop at every breakpoint instead of lg:-only", () => {
    const codeOnly = stripComments(FINAL_CTA_SOURCE);
    expect(codeOnly).not.toMatch(/FinalCtaVista/);
    expect(FINAL_CTA_SOURCE).toContain("/cta/final-cta-vista.png");
    // Visible at every breakpoint now (H04-H07 hid the visual area below
    // `lg:` entirely) — see this file's own UX10-H08 docblock, item 6.
    // (Note: the section legitimately uses `hidden lg:block` elsewhere,
    // on the horizontal fade overlay that only applies to the side-by-
    // side `lg:` layout — that is not the image itself, which has no
    // `hidden` class at any breakpoint.)
    expect(codeOnly).toMatch(/<img\s[^>]*src="\/cta\/final-cta-vista\.png"/);
  });

  it("the photo is rendered as a plain local <img>, never next/image or an external URL, and is purely decorative", () => {
    expect(FINAL_CTA_SOURCE).not.toMatch(/from ["']next\/image["']/);
    expect(FINAL_CTA_SOURCE).not.toMatch(/https?:\/\//);
    expect(FINAL_CTA_SOURCE).toMatch(/<img\s/);
    expect(FINAL_CTA_SOURCE).toMatch(/alt=""/);
    expect(FINAL_CTA_SOURCE).toMatch(/aria-hidden="true"/);
  });

  it("UX10-H08 deliberately reintroduces the reference's handwritten annotation for this one section — baked into the photo crop, never rendered as a live text node", () => {
    // The old FinalCtaVista.tsx docblock's "no handwritten annotation"
    // rule for this section is superseded here, on this milestone's own
    // explicit instruction — see this file's own UX10-H08 docblock, item
    // 2. No literal annotation copy is ever rendered as a text string.
    // Checked against comment-stripped source: this file's own docblock
    // legitimately quotes the annotation copy in prose while explaining
    // why it's now baked into the photo crop instead — the same false-
    // positive trap this test suite's other files already guard against
    // (see homepage-source-audit.test.ts's stripComments docblock).
    const codeOnly = stripComments(FINAL_CTA_SOURCE);
    expect(codeOnly).not.toMatch(/>\s*A brighter/i);
    expect(codeOnly).not.toMatch(/tomorrow starts today/i);
  });

  it("no fabricated claim: the unverified 'thousands of students' / 'global community' reference copy stays replaced with truthful alternatives; UX10-EU02 updates the body copy again to its own Europe-first line", () => {
    // Checked against comment-stripped source — this file's own docblock
    // legitimately quotes both unverified reference phrases in prose while
    // explaining why they were replaced. Same stripComments convention as
    // every other false-positive-prone check in this test suite.
    const codeOnly = stripComments(FINAL_CTA_SOURCE);
    expect(codeOnly).not.toMatch(/thousands of students/i);
    expect(codeOnly).not.toMatch(/global community/i);
    // UX10-EU02 — body copy updates from "Explore careers, courses,
    // universities and global opportunities with Nextwise." to this
    // milestone's own supporting line (see HomeFinalCTA.tsx's own
    // UX10-EU02 docblock entry); no new unverified claim is introduced.
    expect(FINAL_CTA_SOURCE).toContain(
      "Get personalised guidance, compare your options, and take the first step with confidence."
    );
    // Trust items unchanged — still reused verbatim from the Hero's own
    // already-approved trust row, not invented for this pass.
    expect(FINAL_CTA_SOURCE).toContain("Student-first approach");
    expect(FINAL_CTA_SOURCE).toContain("No credit card required");
    expect(FINAL_CTA_SOURCE).toContain("Free expert guidance");
  });
});
