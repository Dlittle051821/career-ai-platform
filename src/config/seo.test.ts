import { describe, expect, it, vi } from "vitest";
import { publicPageMetadata, SEO_ORIGIN } from "./seo";
import { getOrganizationJsonLd, getWebsiteJsonLd } from "../lib/seo/structured-data";
import robots from "../app/robots";

vi.mock("@/lib/supabase/careers", () => ({ getCareerOptionsForComparison: async () => [{ slug: "software-engineer" }] }));
vi.mock("@/lib/supabase/education/universities", () => ({ getPublishedUniversitySlugsForSitemap: async () => [] }));
vi.mock("@/lib/supabase/education/courses", () => ({ getPublishedCourseSlugPairsForSitemap: async () => [] }));

describe("public search identity", () => {
  it("does not inherit a preview or non-www application origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.example/");
    vi.resetModules();
    try {
      const seo = await import("./seo");
      const ld = await import("../lib/seo/structured-data");
      expect(seo.SEO_ORIGIN).toBe("https://www.nextwise.world");
      expect(ld.getOrganizationJsonLd().url).toBe(seo.SEO_ORIGIN);
      expect(ld.getWebsiteJsonLd().url).toBe(seo.SEO_ORIGIN);
    } finally { vi.unstubAllEnvs(); vi.resetModules(); }
  });
  it("gives a public page matching search and share identities", () => {
    const metadata = publicPageMetadata("/career", "Career Guidance", "Explore career options.");
    expect(metadata.title).toEqual({ absolute: "Career Guidance | NextWise" });
    expect(metadata.alternates?.canonical).toBe("/career");
    expect(metadata.openGraph).toMatchObject({ title: "Career Guidance | NextWise", description: metadata.description, url: `${SEO_ORIGIN}/career` });
    expect(metadata.twitter).toMatchObject({ title: "Career Guidance | NextWise", description: metadata.description });
    expect(getOrganizationJsonLd().url).toBe(getWebsiteJsonLd().url);
  });
  it("includes the Europe guide and keeps public sitemap URLs crawlable", async () => {
    const sitemap = (await import("../app/sitemap")).default;
    const entries = await sitemap();
    expect(entries.filter(entry => entry.url === `${SEO_ORIGIN}/study-europe`)).toHaveLength(1);
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
    const rules = robots().rules;
    if (Array.isArray(rules)) throw new Error("Expected shared crawler rules");
    const excluded = rules?.disallow as string[];
    expect(excluded).toContain("/studio");
    expect(excluded).toContain("/counsellor");
    for (const entry of entries) {
      const url = new URL(entry.url);
      expect(url.origin).toBe(SEO_ORIGIN);
      expect(excluded.some(prefix => url.pathname.startsWith(prefix))).toBe(false);
    }
  });
});
