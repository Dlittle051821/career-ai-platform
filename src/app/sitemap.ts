import type { MetadataRoute } from "next";
import { SEO_ORIGIN } from "@/config/seo";
import { getCareerOptionsForComparison } from "@/lib/supabase/careers";
import { getPublishedUniversitySlugsForSitemap } from "@/lib/supabase/education/universities";
import { getPublishedCourseSlugPairsForSitemap } from "@/lib/supabase/education/courses";

// Published public URLs only; private and combinatorial routes stay excluded.
type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

interface StaticEntry {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

// Priorities/frequencies are hints, not ranking mechanisms — kept sensible
// and restrained per the task's own instruction, not maximized.
const STATIC_ENTRIES: StaticEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },

  // NW04.6 — the two top-level product front doors (NW03.2/NW04.2-04),
  // each with its own `alternates.canonical` and no `robots` override (see
  // docs/milestones/NW04/NW04_01_UX_AUDIT.md §6) — genuinely indexable,
  // genuinely public, and missing from this file until now. Same priority
  // tier as the other primary discovery/service entry points below.
  { path: "/career", changeFrequency: "weekly", priority: 0.8 },
  { path: "/abroad", changeFrequency: "weekly", priority: 0.8 },

  // Primary discovery/service entry points.
  { path: "/career-discovery", changeFrequency: "weekly", priority: 0.8 },
  { path: "/careers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/courses", changeFrequency: "weekly", priority: 0.8 },
  { path: "/universities", changeFrequency: "weekly", priority: 0.8 },

  // Secondary service/informational pages.
  { path: "/pricing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.7 },
  { path: "/book-counselling", changeFrequency: "monthly", priority: 0.7 },
  { path: "/study-options", changeFrequency: "monthly", priority: 0.7 },
  { path: "/study-europe", changeFrequency: "monthly", priority: 0.7 },

  // Lower-priority informational/trust pages.
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/parents", changeFrequency: "monthly", priority: 0.5 },
  { path: "/trust", changeFrequency: "monthly", priority: 0.5 },

  // Legal boilerplate — rarely changes, lowest priority.
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // No `lastModified` is set on the static entries above: none of these
  // pages has a real, tracked "last changed" timestamp available at this
  // layer, and guessing "today" for all of them would misrepresent how
  // often they actually change (the task's own instruction: don't pretend
  // every page changed today when that isn't actually known). Next.js's
  // sitemap type treats `lastModified` as optional; omitting it is the
  // honest choice here, not an oversight.
  const staticUrls: MetadataRoute.Sitemap = STATIC_ENTRIES.map(({ path, changeFrequency, priority }) => ({
    url: `${SEO_ORIGIN}${path}`,
    changeFrequency,
    priority,
  }));

  // Reuses getCareerOptionsForComparison() as-is — already the exact
  // "every career, slug + title" query the public /compare picker calls,
  // and the careers table has no draft/publication-status concept at all
  // (see src/lib/supabase/careers.ts), so every row it returns is already
  // legitimately public. No new career-specific query was written for this.
  const [careerOptions, universityEntries, courseEntries] = await Promise.all([
    getCareerOptionsForComparison(),
    getPublishedUniversitySlugsForSitemap(),
    getPublishedCourseSlugPairsForSitemap(),
  ]);

  const careerUrls: MetadataRoute.Sitemap = careerOptions.map(({ slug }) => ({
    url: `${SEO_ORIGIN}/careers/${slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const universityUrls: MetadataRoute.Sitemap = universityEntries.map(({ slug, lastVerifiedAt }) => ({
    url: `${SEO_ORIGIN}/universities/${slug}`,
    ...(lastVerifiedAt ? { lastModified: new Date(lastVerifiedAt) } : {}),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const courseUrls: MetadataRoute.Sitemap = courseEntries.map(({ universitySlug, courseSlug, lastVerifiedAt }) => ({
    url: `${SEO_ORIGIN}/courses/${universitySlug}/${courseSlug}`,
    ...(lastVerifiedAt ? { lastModified: new Date(lastVerifiedAt) } : {}),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticUrls, ...careerUrls, ...universityUrls, ...courseUrls];
}
