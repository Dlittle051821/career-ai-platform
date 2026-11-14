import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CareerPreview } from "@/components/sections/home/v563/CareerPreview";
import { ALL_CAREERS } from "@/data/careers";
import { BRAND_LOGO } from "@/config/site";
import { MASTER_LOGO, MASTER_LOGO_VERSION, ORIGINAL_N_ICON } from "@/lib/brand/master-logo";
import { NPOS } from "@/lib/home/v4/engine";
import { CAREER_EXPLORER_HREF, CAREER_SHOWCASE, buildCareerPreview } from "./career-preview";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const sha = (rel: string) => createHash("sha256").update(readFileSync(path.join(ROOT, rel))).digest("hex");
const png = (rel: string) => {
  const b = readFileSync(path.join(ROOT, rel));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe("V5.6.3 Career Intelligence preview — content", () => {
  const items = buildCareerPreview();
  it("features Robotics & Autonomous Systems Engineer first, then Climate & Energy and Space Systems", () => {
    expect(items.map((i) => i.title)).toEqual(["Robotics & Autonomous Systems Engineer", "Climate & Energy Systems Engineer", "Space Systems Engineer"]);
    expect(items[0]!.tags).toEqual(["Robotics", "Automation", "Artificial Intelligence", "Engineering"]);
  });
  it("takes every fact from an approved, verified career record", () => {
    for (const [i, s] of CAREER_SHOWCASE.entries()) {
      const rec = ALL_CAREERS.find((c) => c.slug === s.slug)!;
      expect(rec.dataQualityStatus).toBe("approved");
      expect(items[i]!.involves).toBe(rec.summary);
      expect(items[i]!.profileHref).toBe(`/careers/${rec.slug}`);
      expect(items[i]!.profileTitle).toBe(rec.title);
      expect(items[i]!.skills.length).toBeGreaterThan(0);
      expect(items[i]!.related.length).toBeGreaterThan(0);
    }
  });
  it("shows no invented figures: no percentages, salaries, growth, rankings or match scores", () => {
    const text = JSON.stringify(items) + JSON.stringify(CAREER_SHOWCASE);
    expect(text).not.toMatch(/\d+\s?%|₹|\$|€|salary|lakh|growth rate|rank|match score|guarantee/i);
  });
  it("links to the working Career Explorer and real profile routes", () => {
    expect(CAREER_EXPLORER_HREF).toBe("/careers");
    expect(existsSync(path.join(ROOT, "src/app/(site)/careers/page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src/app/(site)/careers/[slug]/page.tsx"))).toBe(true);
  });
});

describe("V5.6.3 Career Intelligence preview — markup and accessibility", () => {
  const html = renderToStaticMarkup(createElement(CareerPreview, { items: buildCareerPreview() }));
  it("is a labelled tablist of three careers with one selected tab and one roving tab stop", () => {
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/gi)).toHaveLength(1);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(3);
  });
  it("hides inactive panels from keyboard and assistive tech", () => {
    expect(html.match(/<div[^>]*role="tabpanel"[^>]*inert=""/g)).toHaveLength(2);
  });
  it("labels the preview as illustrative and keeps decorative art hidden", () => {
    expect(html).toContain("Illustrative career profile");
    expect(html).toMatch(/class="ci-bg" aria-hidden="true"/);
    for (const m of html.matchAll(/<svg class="ci-art[^"]*"[^>]*>/g)) expect(m[0]).toContain('aria-hidden="true"');
  });
  it("offers Explore Career Paths to /careers", () => {
    expect(html).toMatch(/<a[^>]*href="\/careers"[^>]*class="ci-cta"|<a[^>]*class="ci-cta"[^>]*href="\/careers"/);
  });
});

describe("V5.6.3 — the animated N and the locked scenes are untouched", () => {
  it("the engine's resting positions for the N are unchanged (the fix is scene layout only)", () => {
    expect(NPOS.d.rest[2]).toEqual({ x: 63, y: 150, s: 0.13 });
    expect(NPOS.m.rest[2]).toEqual({ x: 6, y: 84, s: 0.09 });
  });
  it("the animated N keeps its original artwork file", () => {
    expect(BRAND_LOGO.icon).toBe("/brand/nextwise-icon.png");
    expect(ORIGINAL_N_ICON).toBe("/brand/nextwise-icon.png");
    // byte-identical to the approved V5.6.2 file (3f8c59d)
    expect(sha("public/brand/nextwise-icon.png")).toBe("13c873109107d931a18d662a0c5b339ec528aa69b3a4f64a2a02747776b57f31");
  });
  it("scene 3 aligns the eyebrow with the N's centre of mass and clears its tail (stage units)", () => {
    const css = read("src/components/sections/home/v563/career-intelligence.css");
    expect(css).toContain(".nw4.nw54 .d .c-eb { left: 136px; top: 177px; }");
    expect(css).toContain(".nw4.nw54 .d .c-h2 { top: 220px; }");
    expect(css).toContain(".nw4.nw54 .m .c-eb { left: 58px; top: 100px; }");
    expect(css).toContain(".nw4.nw54 .m .c-h2 { top: 132px; }");
  });
});

describe("V5.6.3 — Master Logo v2.0 (owner-approved pink-tinted artwork)", () => {
  it("every variant exists with the v1 canvas size, so every logo box keeps its geometry", () => {
    expect(MASTER_LOGO_VERSION).toBe("2.0");
    for (const art of Object.values(MASTER_LOGO)) {
      expect(art.src.startsWith("/brand/master-v2/")).toBe(true);
      expect(png(`public${art.src}`)).toEqual({ w: art.width, h: art.height });
      const v1 = `public${art.src.replace("master-v2", "master-v1")}`;
      expect(png(v1)).toEqual({ w: art.width, h: art.height });
    }
  });
  it("the owner's source artwork is kept with the build script that derives the web files", () => {
    for (const f of ["Nextwise_Approved_With_Tagline_Raster_4800px.png", "Nextwise_N_logo.png", "With_Tagline-1.png"])
      expect(existsSync(path.join(ROOT, "docs/brand/master-v2-source", f))).toBe(true);
    expect(existsSync(path.join(ROOT, "docs/brand/build-master-v2.py"))).toBe(true);
  });
  it("the signed-in account control shows the official N symbol, still as a labelled menu button", () => {
    const src = read("src/components/navigation/AccountMenu.tsx");
    expect(src).toContain("MASTER_LOGO.symbol.src");
    expect(src).toContain("aria-label={`Account menu for ${firstName}, ${roleLabel}`}");
    expect(src).toContain("aria-expanded={open}");
    expect(src).not.toMatch(/firstName \|\| "\?"\)\.slice\(0, 1\)/);
  });
});
