import type { MetadataRoute } from "next";
import { getCareerOptionsForComparison } from "@/lib/supabase/careers";
import { getPublishedUniversitySlugsForSitemap } from "@/lib/supabase/education/universities";
import { getPublishedCourseSlugPairsForSitemap } from "@/lib/supabase/education/courses";

/**
 * M17A Step 3 — production sitemap, served at /sitemap.xml via Next.js's
 * App Router sitemap convention (this file's default export). See
 * M17A_SEO_AUDIT.md and M17A_STEP3_REPORT.md for the full route inventory
 * and the reasoning behind every inclusion/exclusion below.
 *
 * SITEMAP_BASE_URL is deliberately a hardcoded literal, NOT derived from
 * src/config/site.ts's SITE_URL (which reads NEXT_PUBLIC_APP_URL and can be
 * unset, empty, or a localhost/preview value depending on environment) —
 * this file's one job is to always emit the real production domain,
 * independent of how that environment variable happens to be configured
 * wherever this builds. Do not change this to SITE_URL without first
 * verifying NEXT_PUBLIC_APP_URL is reliably https://nextwise.world in every
 * environment this can build in.
 *
 * Included:
 *  - Every Group A (PUBLIC + INDEXABLE) static page from the audit.
 *  - The three content hubs' clean base URLs only (/careers, /courses,
 *    /universities) — never a filtered/paginated/query-string variant.
 *  - Every career/university/course detail page backed by a real,
 *    published+active database row at build/request time.
 *
 * Excluded (see the audit for the full reasoning per route):
 *  - Everything authenticated/private: /dashboard, /profile(/onboarding),
 *    /saved, /applications(/[id]), /payments(/[invoiceId]),
 *    /agreements/[id], /pricing/checkout(/[slug]), /welcome,
 *    /discovery-session/book, /recommendations, /roadmap.
 *  - /pay/[token] (tokenized, private) and every auth-utility page
 *    (/login, /register, /forgot-password, /reset-password).
 *  - /admin and everything under it.
 *  - /compare and /courses/compare — public but query-driven/combinatorial,
 *    classified NOINDEX in the audit (Group B); not appropriate for a
 *    sitemap regardless of the temporary blanket noindex.
 *  - Auth callbacks, webhook routes, and every other API/route-handler
 *    endpoint — these return JSON/redirects/files, never indexable HTML.
 *
 * IMPORTANT — this file does NOT change indexability by itself. The
 * temporary site-wide `robots: { index: false, follow: false }` on
 * src/app/(site)/layout.tsx is untouched (per this step's explicit
 * instruction) and still applies to every page below. Submitting this
 * sitemap to Search Console before that blanket noindex is lifted will
 * correctly show every URL as "Excluded by noindex tag" — expected, not a
 * sign this file is broken. See M17A_SEO_AUDIT.md §J for the intended
 * sequencing.
 */

const SITEMAP_BASE_URL = "https://nextwise.world";

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
    url: `${SITEMAP_BASE_URL}${path}`,
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
    url: `${SITEMAP_BASE_URL}/careers/${slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const universityUrls: MetadataRoute.Sitemap = universityEntries.map(({ slug, lastVerifiedAt }) => ({
    url: `${SITEMAP_BASE_URL}/universities/${slug}`,
    ...(lastVerifiedAt ? { lastModified: new Date(lastVerifiedAt) } : {}),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const courseUrls: MetadataRoute.Sitemap = courseEntries.map(({ universitySlug, courseSlug, lastVerifiedAt }) => ({
    url: `${SITEMAP_BASE_URL}/courses/${universitySlug}/${courseSlug}`,
    ...(lastVerifiedAt ? { lastModified: new Date(lastVerifiedAt) } : {}),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticUrls, ...careerUrls, ...universityUrls, ...courseUrls];
}
