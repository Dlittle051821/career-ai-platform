import { describe, expect, it } from "vitest";
import { resolveActiveNavHref } from "./active-nav";
import { HEADER_NAV_HREFS, NAV_GROUPS, navHrefPath } from "@/config/site";

const ALL = HEADER_NAV_HREFS;
const groupOf = (href: string | null) => NAV_GROUPS.find((g) => g.links.some((l) => navHrefPath(l.href) === href))?.id ?? (href ? "direct" : null);

describe("CIUX-01B resolveActiveNavHref — one active place in the header", () => {
  it.each([
    // Career Explorer V5 header: Home | Career Options | Universities | Free Tools | Destination
    ["/courses/compare", "/courses/compare", "tools"],
    ["/courses", null, null],
    ["/careers/ai-engineer", "/careers", "careers"],
    ["/career", "/career", "careers"],
    ["/career/access", "/career", "careers"],
    ["/career-discovery", "/career-discovery", "tools"],
    ["/universities/tu-munich", "/universities", "direct"],
    ["/study-europe", "/study-europe", "destination"],
    ["/how-it-works", null, null],
    ["/pricing", null, null],
    ["/privacy", null, null],
    ["/", "/", "direct"],
  ])("%s → %s (%s)", (path, href, group) => {
    const got = resolveActiveNavHref(path, ALL);
    expect(got).toBe(href);
    expect(groupOf(got)).toBe(group);
  });

  it("Home is active only on the homepage itself, never on internal pages", () => {
    expect(resolveActiveNavHref("/", ALL)).toBe("/");
    for (const p of ["/how-it-works", "/abroad", "/pricing", "/careers/ai-engineer", "/privacy"]) expect(resolveActiveNavHref(p, ALL)).not.toBe("/");
  });

  it("never treats a shared word prefix as a parent (/career is not the parent of /careers or /career-discovery)", () => {
    expect(resolveActiveNavHref("/careers", ["/career", "/careers"])).toBe("/careers");
    expect(resolveActiveNavHref("/career-discovery", ["/career"])).toBeNull();
  });
});
