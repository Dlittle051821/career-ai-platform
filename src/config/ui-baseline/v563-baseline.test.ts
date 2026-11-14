/**
 * NEXTWISE UI/UX BASELINE V5.6.3 — enforceable lock (tag nextwise-ui-v563-approved, commit 893d816).
 *
 * The founder selected the V5.6.3 deployment as the one canonical UI/UX baseline
 * (docs/UI-UX-CANONICAL-BASELINE.md). Every branch must pass this file. If it fails,
 * the branch has reverted or altered approved shared UI: restore it. Changing the
 * baseline itself needs the owner's approval (docs/UI-UX-DEVELOPMENT-PROTOCOL.md §6).
 *
 * Runs with the normal suite (npm test) and on its own: npm run verify:baseline.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./v563-manifest.json";
// @ts-expect-error plain ESM helper shared with the CLI
import { compare } from "../../../scripts/baseline/ui-baseline.mjs";
import { OFFICIAL_CONTACT } from "../contact";
import { DISCOVERY_SESSION_CTA, HEADER_DIRECT_LINKS, HEADER_LEADING_LINKS, HEADER_NAV_HREFS, NAV_GROUPS } from "../site";
import { MASTER_LOGO } from "@/lib/brand/master-logo";
import { CAREER_SHOWCASE } from "@/lib/home/v563/career-preview";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const order = (src: string, ...parts: string[]) =>
  parts.every((p) => src.includes(p)) && parts.every((p, i) => i === 0 || src.indexOf(parts[i - 1]!) < src.indexOf(p));

describe("V5.6.3 baseline identity", () => {
  it("is the founder-selected canonical commit and deployment", () => {
    expect(manifest.baseline).toBe("NEXTWISE UI/UX BASELINE V5.6.3");
    expect(manifest.tag).toBe("nextwise-ui-v563-approved");
    expect(manifest.canonicalCommit).toBe("893d816543f92b6538ee5037991a858d1231bcb5");
    expect(manifest.referenceDeployment).toBe("https://nextwise-world-58p81wrss-nextwise.vercel.app/");
    expect(manifest.history.length).toBeGreaterThan(0);
    for (const h of manifest.history) expect(h.approvedBy && h.reason && h.date).toBeTruthy();
  });
});

describe("locked files, animation assets and design tokens (byte-level)", () => {
  it("every locked file and brand token matches the approved baseline", () => {
    const problems: string[] = compare(manifest);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("locks the logo, the original N, Two Pathways, Career Intelligence, the header and the page hero", () => {
    const files = Object.keys(manifest.files);
    for (const f of [
      "public/brand/master-v2/nextwise-master-horizontal-light.png",
      "public/brand/master-v2/nextwise-master-symbol.png",
      "public/brand/nextwise-icon.png",
      "src/lib/home/v4/engine.ts",
      "src/lib/home/v54/engine.ts",
      "src/components/sections/home/v562/TwoPathways.tsx",
      "src/components/sections/home/v563/CareerPreview.tsx",
      "src/components/navigation/Header.tsx",
      "src/styles/site-header.css",
      "src/components/sections/PageHero.tsx",
    ])
      expect(files, f).toContain(f);
    expect(Object.keys(manifest.tokens).length).toBeGreaterThan(50);
  });
});

describe("navigation (order and destinations)", () => {
  it("desktop header: Home, Explore, Free tools, How it works, Pricing", () => {
    expect(HEADER_LEADING_LINKS.map((l) => [l.label, l.href])).toEqual([["Home", "/"]]);
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Explore", "Free tools", "How it works"]);
    expect(HEADER_DIRECT_LINKS.map((l) => [l.label, l.href])).toEqual([["Pricing", "/pricing"]]);
    expect(HEADER_NAV_HREFS[0]).toBe("/");
    expect(DISCOVERY_SESSION_CTA).toMatchObject({ label: "Book a free session", href: "/book-counselling" });
  });

  it("menu groups keep their approved items in order", () => {
    expect(NAV_GROUPS.map((g) => g.links.map((l) => l.href))).toEqual([
      ["/careers", "/career", "/universities", "/courses", "/abroad", "/study-europe"],
      ["/career-discovery", "/compare", "/courses/compare", "/study-options"],
      ["/how-it-works", "/parents", "/about", "/trust", "/contact"],
    ]);
  });

  it("desktop and phone menus render Home first, then the groups, then Pricing", () => {
    for (const f of ["src/components/navigation/NavMenus.tsx", "src/components/navigation/MobileNavGroups.tsx"])
      expect(order(read(f), "HEADER_LEADING_LINKS.map", "NAV_GROUPS.map"), f).toBe(true);
  });

  it("one global header: the homepage and every public page use SiteHeader; the logo links home", () => {
    expect(read("src/components/sections/home/v54/NextwiseV54Home.tsx")).toContain('<SiteHeader context="home"');
    expect(read("src/app/(site)/layout.tsx")).toMatch(/<Header\b/);
    expect(read("src/components/navigation/Header.tsx")).toMatch(/<Link href="\/"[^>]*aria-label="Nextwise home"/);
  });
});

describe("branding", () => {
  it("every logo surface uses the pink-arrow Master Logo v2", () => {
    for (const v of Object.values(MASTER_LOGO)) {
      expect(v.src).toMatch(/^\/brand\/master-v2\//);
      expect(existsSync(path.join(ROOT, "public", v.src))).toBe(true);
    }
  });

  it("the account control shows the official N symbol, not a typed initial", () => {
    expect(read("src/components/navigation/AccountMenu.tsx")).toContain("MASTER_LOGO.symbol");
  });
});

describe("homepage story (approved scenes and order)", () => {
  const home = read("src/components/sections/home/v54/NextwiseV54Home.tsx");

  it("/ renders the V5.4 story followed by Quick Explore, and nothing else", () => {
    const page = read("src/app/(site)/page.tsx");
    const imports = [...page.matchAll(/from "(@\/components\/[^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["@/components/sections/home/v54/NextwiseV54Home", "@/components/sections/home/QuickExplore"]);
    expect(order(page, "<NextwiseV54Home />", "<QuickExplore />")).toBe(true);
  });

  it("scene 2 is Two Pathways and scene 3 is the Career Intelligence preview", () => {
    expect(home).toContain("{j === 1 ? <TwoPathways /> : null}");
    expect(home).toContain("<TwoPathwaysMotion rootId={ROOT_ID} />");
    expect(home).toMatch(/<CareerPreview\b/);
  });

  it("Career Intelligence shows Robotics first, then Climate & Energy and Space Systems", () => {
    expect(CAREER_SHOWCASE.map((c) => c.title)).toEqual([
      "Robotics & Autonomous Systems Engineer",
      "Climate & Energy Systems Engineer",
      "Space Systems Engineer",
    ]);
  });

  it("the opening animation and the original N engine are present and wired", () => {
    const motion = read("src/components/sections/home/v54/V54Motion.tsx");
    expect(motion).toContain("startV4Engine(root");
    expect(motion).toContain("startChapters(root");
    expect(existsSync(path.join(ROOT, "public/brand/nextwise-icon.png"))).toBe(true);
  });
});

describe("no legacy homepage or header reintroduced", () => {
  const LEGACY = [
    "V4ConnectedHome",
    "SignatureHero",
    "sections/home/HomeHero",
    "sections/home/Hero\"",
    "HeroProductPreview",
    "OrbitJourney",
  ];

  it("no app route other than the development-only /homepage-preview imports a legacy homepage", () => {
    const routes = [
      "src/app/(site)/page.tsx",
      "src/app/(site)/layout.tsx",
      "src/components/sections/home/v54/NextwiseV54Home.tsx",
      "src/components/navigation/Header.tsx",
    ];
    // code only: comments may name the legacy components they replaced
    const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const f of routes) for (const l of LEGACY) expect(code(f).includes(l), `${f} uses ${l}`).toBe(false);
  });

  it("/homepage-preview stays development-only", () => {
    expect(read("src/app/(site)/homepage-preview/page.tsx")).toMatch(/notFound\(\)/);
  });
});

describe("critical routes and official contacts", () => {
  it.each([
    "", "how-it-works", "career", "careers", "careers/[slug]", "career-discovery", "compare", "universities",
    "courses", "courses/compare", "abroad", "study-europe", "study-options", "pricing", "about", "contact",
    "parents", "trust", "privacy", "terms", "refund-policy", "book-counselling",
  ])("/%s exists", (r) => {
    expect(existsSync(path.join(ROOT, "src/app/(site)", r, "page.tsx"))).toBe(true);
  });

  it("contacts are the official ones", () => {
    expect(OFFICIAL_CONTACT.founder.email).toBe("founder@nextwise.com");
    expect(OFFICIAL_CONTACT.coFounder.email).toBe("co-founder@nextwise.com");
    expect(OFFICIAL_CONTACT.phone).toMatchObject({ display: "+91 7205 7204 37", tel: "tel:+917205720437" });
    expect(OFFICIAL_CONTACT.website).toMatchObject({ url: "https://www.nextwise.world" });
  });
});
