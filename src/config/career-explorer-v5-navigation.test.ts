import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { resolveActiveNavHref } from "@/lib/navigation/active-nav";
import { CAREER_OPTIONS_GROUP, DESTINATION_GROUP, FREE_TOOLS_GROUP, HEADER_NAV, HEADER_NAV_HREFS, NAV_GROUPS, SAVED_NAV_LINK, navHrefPath } from "./site";

const APP = path.resolve(import.meta.dirname, "../app");
const read = (rel: string) => readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");
const routeExists = (href: string) => {
  const p = navHrefPath(href);
  if (p === "/") return existsSync(path.join(APP, "(site)/page.tsx"));
  return ["(site)", ""].some((group) => existsSync(path.join(APP, group, p, "page.tsx")));
};

describe("Career Explorer V5 — global navigation (approved, locked)", () => {
  it("is exactly Home | Career Options | Universities | Free Tools | Destination", () => {
    expect(HEADER_NAV.map((i) => (i.kind === "link" ? i.link.label : i.group.label))).toEqual(["Home", "Career Options", "Universities", "Free Tools", "Destination"]);
    expect(HEADER_NAV.map((i) => i.kind)).toEqual(["link", "group", "link", "group", "group"]);
  });

  it('labels the destination menu "Destination", not "Choose Your Destination"', () => {
    expect(DESTINATION_GROUP.label).toBe("Destination");
    expect(JSON.stringify(HEADER_NAV)).not.toMatch(/Choose Your Destination/i);
  });

  it("Career Options keeps the free explorer and the Verified assessment apart", () => {
    const [explorer, intelligence] = CAREER_OPTIONS_GROUP.links;
    expect(CAREER_OPTIONS_GROUP.links).toHaveLength(2);
    expect(explorer).toMatchObject({ label: "Career Explorer", href: "/careers", badge: { label: "Free", tone: "free" } });
    expect(intelligence).toMatchObject({ label: "Career Intelligence", href: "/career", badge: { label: "Nextwise Verified", tone: "verified" } });
  });

  it("Destination lists the six supported countries, in the supported-country order, as sections of /study-europe", () => {
    expect(DESTINATION_GROUP.links.map((l) => l.href)).toEqual(EUROPE_COUNTRIES.map((c) => `/study-europe#${c.slug}`));
    expect(DESTINATION_GROUP.links.map((l) => l.flag)).toEqual(EUROPE_COUNTRIES.map((c) => c.code.toLowerCase()));
  });

  it("Free Tools keeps the four existing tools and adds none", () => {
    expect(FREE_TOOLS_GROUP.links.map((l) => l.href)).toEqual(["/career-discovery", "/compare", "/courses/compare", "/study-options"]);
  });

  it("every header destination is a route that exists", () => {
    const hrefs = [...HEADER_NAV.flatMap((i) => (i.kind === "link" ? [i.link.href] : i.group.links.map((l) => l.href))), SAVED_NAV_LINK.href];
    for (const href of hrefs) expect(routeExists(href), href).toBe(true);
  });

  it("resolves one active place per route, with #section links matched by their page", () => {
    expect(resolveActiveNavHref("/careers/marine-engineer", HEADER_NAV_HREFS)).toBe("/careers");
    expect(resolveActiveNavHref("/career/access", HEADER_NAV_HREFS)).toBe("/career");
    expect(resolveActiveNavHref("/study-europe", HEADER_NAV_HREFS)).toBe("/study-europe");
    expect(resolveActiveNavHref("/universities/some-university", HEADER_NAV_HREFS)).toBe("/universities");
    expect(resolveActiveNavHref("/courses/compare", HEADER_NAV_HREFS)).toBe("/courses/compare");
    expect(new Set(HEADER_NAV_HREFS).size).toBe(HEADER_NAV_HREFS.length);
  });

  it("desktop and phone menus render the same single list", () => {
    for (const rel of ["components/navigation/NavMenus.tsx", "components/navigation/MobileNavGroups.tsx"]) {
      expect(read(rel), rel).toContain("HEADER_NAV.map(");
    }
    expect(NAV_GROUPS).toEqual([CAREER_OPTIONS_GROUP, FREE_TOOLS_GROUP, DESTINATION_GROUP]);
  });

  it("menus stay keyboard- and touch-operable disclosures", () => {
    const menus = read("components/navigation/NavMenus.tsx");
    for (const needle of ["aria-expanded", "aria-controls", '"Escape"', "ArrowDown", 'pointerType !== "mouse"', "aria-current"]) expect(menus).toContain(needle);
  });

  it("log in, sign up and the account menu are still in the header", () => {
    const header = read("components/navigation/Header.tsx");
    for (const needle of ["AUTH_LINKS.login.href", "AUTH_LINKS.signup.href", "<AccountMenu />", "<MobileNav"]) expect(header).toContain(needle);
  });
});
