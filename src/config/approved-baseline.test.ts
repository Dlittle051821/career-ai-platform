/**
 * APPROVED BASELINE — lock tests for decisions the owner has already approved.
 *
 * Nextwise is built in several parallel chats. Each one starts from the
 * approved tip recorded in docs/APPROVED-BASELINE.md and must leave every
 * decision below intact. If a change breaks one of these tests, it has undone
 * an approved decision: restore it, or get the owner's explicit approval and
 * update this file and docs/APPROVED-BASELINE.md in the same commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_CONTACT } from "./contact";
import { DISCOVERY_SESSION_CTA, HEADER_DIRECT_LINKS, HEADER_LEADING_LINKS, HEADER_NAV_HREFS, NAV_GROUPS } from "./site";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const before = (src: string, a: string, b: string) => src.indexOf(a) > -1 && src.indexOf(b) > -1 && src.indexOf(a) < src.indexOf(b);

describe("approved: CIUX-01B Home navigation item (64af0a7)", () => {
  it("Home is the first header item and links to /", () => {
    expect(HEADER_LEADING_LINKS[0]).toMatchObject({ label: "Home", href: "/" });
    expect(HEADER_NAV_HREFS[0]).toBe("/");
  });
  it("desktop menus and the phone menu both render Home before the menu groups", () => {
    for (const f of ["src/components/navigation/NavMenus.tsx", "src/components/navigation/MobileNavGroups.tsx"])
      expect(before(read(f), "HEADER_LEADING_LINKS.map", "NAV_GROUPS.map"), f).toBe(true);
  });
  it("the logo links home", () => {
    expect(read("src/components/navigation/Header.tsx")).toMatch(/<Link href="\/"[^>]*aria-label="Nextwise home"/);
  });
});

describe("approved: CIUX-01/01B one global header and navigation", () => {
  it("the homepage renders the shared SiteHeader (no second header implementation)", () => {
    const home = read("src/components/sections/home/v54/NextwiseV54Home.tsx");
    expect(home).toContain('<SiteHeader context="home"');
  });
  it("menu groups are Explore / Free tools / How it works, plus Pricing and the free session", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Explore", "Free tools", "How it works"]);
    expect(HEADER_DIRECT_LINKS.map((l) => l.href)).toEqual(["/pricing"]);
    expect(DISCOVERY_SESSION_CTA).toMatchObject({ label: "Book a free session", href: "/book-counselling" });
  });
  it("official contact details come from one source", () => {
    expect(OFFICIAL_CONTACT.founder.email).toBe("founder@nextwise.com");
    expect(OFFICIAL_CONTACT.coFounder.email).toBe("co-founder@nextwise.com");
  });
});

describe("approved: homepage story", () => {
  it("/ renders the V5.4 full-screen homepage", () => {
    expect(read("src/app/(site)/page.tsx")).toContain("<NextwiseV54Home />");
  });
  it("scene 2 is the approved V5.6.2 Two Pathways (Discovery → /career-discovery, Clarity → /courses)", () => {
    const home = read("src/components/sections/home/v54/NextwiseV54Home.tsx");
    expect(home).toContain("{j === 1 ? <TwoPathways /> : null}");
    expect(home).toContain("<TwoPathwaysMotion rootId={ROOT_ID} />");
    const content = read("src/lib/home/v562/content.ts");
    expect(content).toContain('discovery: "/career-discovery"');
    expect(content).toContain('clarity: "/courses"');
  });
});
