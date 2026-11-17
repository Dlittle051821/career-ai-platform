import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_NAV, FREE_TOOLS_NAV_LINK, HEADER_NAV, NAV_GROUPS } from "./site";
import { FREE_TOOLS_PATH, UPCOMING_TOOLS, UPCOMING_TOOL_STATUS_LABEL } from "./upcoming-tools";
import { PUBLIC_EXACT_PATHS, PUBLIC_PATTERNS } from "@/lib/launch/launch-mode";

const SRC = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("Free Tools — the Coming Soon catalogue", () => {
  it("holds exactly the eight approved tools, in the approved order and phases", () => {
    expect(UPCOMING_TOOLS.map((t) => [t.name, t.phase])).toEqual([
      ["Country-Specific CV Studio", 1],
      ["Study Cost Calculator", 1],
      ["Application Checklist Generator", 2],
      ["Academic Profile Builder", 2],
      ["SOP & Motivation Letter Studio", 2],
      ["Scholarship Explorer", 3],
      ["University Eligibility Pre-Check", 3],
      ["Career Reality Check", 3],
    ]);
  });

  it("every tool is Coming Soon, with a unique id, an icon and a description framed as a plan", () => {
    expect(UPCOMING_TOOL_STATUS_LABEL).toBe("Coming Soon");
    expect(new Set(UPCOMING_TOOLS.map((t) => t.id)).size).toBe(8);
    for (const tool of UPCOMING_TOOLS) {
      expect(tool.status, tool.id).toBe("coming_soon");
      expect(tool.icon.length, tool.id).toBeGreaterThan(1);
      expect(tool.description, tool.id).toMatch(/^Planned: /);
    }
  });

  it("promises no date, progress or availability", () => {
    const text = JSON.stringify(UPCOMING_TOOLS) + strip(read("app/(site)/tools/page.tsx"));
    expect(text).not.toMatch(/\b20\d\d\b|\bQ[1-4]\b|next (week|month)|launching|available now|try it|% (done|complete)|beta/i);
    expect(Object.keys(UPCOMING_TOOLS[0])).not.toContain("href");
  });

  it("the page renders each card once from the config, with its status", () => {
    const page = strip(read("app/(site)/tools/page.tsx"));
    expect(page).toContain("UPCOMING_TOOLS.map(");
    expect(page).toContain("{UPCOMING_TOOL_STATUS_LABEL}");
    expect(page).toContain("Free Tools, Coming Soon");
    expect(page.match(/<article/g)).toHaveLength(1);
  });

  it("no card is clickable: no link, button, handler, empty href or tab stop anywhere on the page", () => {
    const page = strip(read("app/(site)/tools/page.tsx"));
    expect(page).not.toMatch(/<a\b|<Link\b|<button\b|href=|onClick|onKey|role="(button|link)"|tabIndex|javascript:|"use client"|next\/link/);
    const css = read("styles/career-explorer.css");
    const toolRules = css.split("}").filter((r) => /\.ce-tool\b|\.ce-tool-/.test(r)).join("}");
    expect(toolRules).not.toMatch(/cursor:\s*pointer|:hover|:focus|transition|(?<!text-)transform/);
  });

  it("no planned tool has a route or an API of its own", () => {
    expect(readdirSync(path.join(SRC, "app/(site)/tools")).sort()).toEqual(["[...retired]", "page.tsx"]);
    expect(existsSync(path.join(SRC, "app/api/tools"))).toBe(false);
    for (const tool of UPCOMING_TOOLS) expect(existsSync(path.join(SRC, "app/(site)", tool.id))).toBe(false);
  });

  it("old or guessed tool addresses redirect to the catalogue, which cannot redirect to itself", () => {
    const retired = strip(read("app/(site)/tools/[...retired]/page.tsx"));
    expect(retired).toContain("redirect(FREE_TOOLS_PATH)");
    expect(FREE_TOOLS_PATH).toBe("/tools");
    expect(strip(read("app/(site)/tools/page.tsx"))).not.toContain("redirect(");
    expect(PUBLIC_EXACT_PATHS).toContain("/tools");
    for (const old of ["/tools/cgpa-to-gpa", "/tools/pte-to-ielts", "/tools/act-to-sat", "/tools/gre-to-gmat-focus", "/tools/sgpa-to-percentage", "/tools/a/b"]) {
      expect(PUBLIC_PATTERNS.some((p) => p.test(old)), old).toBe(true);
    }
  });
});

describe("Free Tools — navigation", () => {
  it("the header has one Free Tools link to the catalogue and no tools menu", () => {
    const tools = HEADER_NAV.filter((i) => (i.kind === "link" ? i.link.label : i.group.label) === "Free Tools");
    expect(tools).toEqual([{ kind: "link", link: FREE_TOOLS_NAV_LINK }]);
    expect(FREE_TOOLS_NAV_LINK.href).toBe(FREE_TOOLS_PATH);
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Career Options", "Destination"]);
  });

  it("desktop and phone menus draw that link from the same list (no second tools list)", () => {
    for (const rel of ["components/navigation/NavMenus.tsx", "components/navigation/MobileNavGroups.tsx"]) {
      const src = strip(read(rel));
      expect(src, rel).toContain("HEADER_NAV.map(");
      expect(src, rel).not.toMatch(/UPCOMING_TOOLS|Calculator|Conversion/);
    }
  });

  it("the footer's Free tools group is the single catalogue link", () => {
    expect(FOOTER_NAV["Free tools"]).toEqual([{ label: "Free Tools (coming soon)", href: "/tools" }]);
  });

  it("no calculator or conversion tool is listed anywhere in the navigation, the footer or the homepage", () => {
    const pattern = /\b(CGPA|SGPA|PTE to IELTS|ACT to SAT|GRE to GMAT|GMAT Classic|GPA Conversion|Percentage Conversion)\b/;
    expect(JSON.stringify({ HEADER_NAV, FOOTER_NAV })).not.toMatch(pattern);
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx$/.test(name)) out.push(full);
      }
      return out;
    };
    const offenders = [...walk(path.join(SRC, "components/navigation")), ...walk(path.join(SRC, "components/sections/home"))].filter((f) => pattern.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the planned tools are listed in exactly one place", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && /Country-Specific CV Studio|Scholarship Explorer/.test(readFileSync(full, "utf8"))) hits.push(path.relative(SRC, full));
      }
    };
    walk(SRC);
    expect(hits).toEqual(["config/upcoming-tools.ts"]);
  });

  it("existing working features stay reachable from the footer", () => {
    const explore = FOOTER_NAV.Explore.map((l) => l.href);
    for (const href of ["/careers", "/career", "/universities", "/courses", "/career-discovery", "/compare", "/study-options"]) expect(explore, href).toContain(href);
  });
});
