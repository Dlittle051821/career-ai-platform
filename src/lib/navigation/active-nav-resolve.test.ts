import { describe, expect, it } from "vitest";
import { resolveActiveNavHref } from "./active-nav";
import { HEADER_DIRECT_LINKS, NAV_GROUPS } from "@/config/site";

const ALL = [...NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href)), ...HEADER_DIRECT_LINKS.map((l) => l.href)];
const groupOf = (href: string | null) => NAV_GROUPS.find((g) => g.links.some((l) => l.href === href))?.id ?? (href ? "direct" : null);

describe("CIUX-01B resolveActiveNavHref — one active place in the header", () => {
  it.each([
    ["/courses/compare", "/courses/compare", "tools"],
    ["/courses", "/courses", "explore"],
    ["/courses/tu-munich/msc-informatics", "/courses", "explore"],
    ["/careers/ai-engineer", "/careers", "explore"],
    ["/career", "/career", "explore"],
    ["/career-discovery", "/career-discovery", "tools"],
    ["/how-it-works", "/how-it-works", "nextwise"],
    ["/pricing", "/pricing", "direct"],
    ["/pricing/checkout/explore", "/pricing", "direct"],
    ["/privacy", null, null],
    ["/", null, null],
  ])("%s → %s (%s)", (path, href, group) => {
    const got = resolveActiveNavHref(path, ALL);
    expect(got).toBe(href);
    expect(groupOf(got)).toBe(group);
  });

  it("never treats a shared word prefix as a parent (/career is not the parent of /careers or /career-discovery)", () => {
    expect(resolveActiveNavHref("/careers", ["/career", "/careers"])).toBe("/careers");
    expect(resolveActiveNavHref("/career-discovery", ["/career"])).toBeNull();
  });
});
