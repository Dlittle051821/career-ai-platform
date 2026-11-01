import type { MetadataRoute } from "next";
import { SEO_ORIGIN } from "@/config/seo";

// Crawl exclusions supplement authentication and private-layout noindex rules.
const DISALLOWED_PATHS = [
  // Authenticated/private student routes (Group C in the audit) — each of
  // these is also independently protected by its own permanent noindex
  // metadata from Step 2; disallowing crawl here is additionally about
  // never spending crawl budget on pages middleware will redirect away
  // from anonymous requests anyway, not the primary defense.
  "/dashboard",
  "/studio",
  "/counsellor",
  "/profile",
  "/saved",
  "/applications",
  "/payments",
  "/agreements",
  "/pricing/checkout",
  "/discovery-session",
  "/welcome",
  "/recommendations",
  "/roadmap",

  // Tokenized/private payment link. Only the generic path prefix is
  // listed — never a token pattern or example token — per this step's own
  // "do not expose token patterns unnecessarily" instruction. This adds
  // nothing beyond what /pay/[token]/page.tsx's own Step 2 noindex already
  // does; it exists purely to avoid wasting crawl budget.
  "/pay",

  // Auth-utility pages — no search intent to serve, already independently
  // noindexed in Step 2.
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",

  // Internal admin system — already independently noindexed via its own
  // root layout (unchanged since the audit); disallowing crawl here is
  // additional defense-in-depth, matching the three-layer pattern the
  // audit already documented for /admin.
  "/admin",

  // API/webhook route handlers — return JSON/redirects, never indexable
  // HTML; nothing here for a crawler to usefully fetch.
  "/api",

  // Server-validated outbound redirect utility for trusted course-search
  // portals (src/app/go/course-search/**/route.ts) — a 302 redirect
  // endpoint with no content of its own; disallowed purely to avoid
  // wasted crawl budget, not because it's sensitive (it's already hardened
  // against open-redirect abuse at the route-handler level, unrelated to
  // this file).
  "/go",
];

/**
 * Deliberately NOT disallowed, even though they are excluded from
 * sitemap.ts and are currently NOINDEX in the audit (Group B): /compare
 * and /courses/compare. Per this step's explicit instruction — "do not
 * block public career, course, university, comparison, pricing, about or
 * other legitimate public discovery pages" — these stay crawlable. Their
 * eventual indexing exclusion belongs on the page itself (a permanent
 * noindex, deferred to a future step alongside the canonical-URL decision
 * these query-driven pages also need — see M17A_SEO_AUDIT.md §I/§J),
 * exactly the robots.txt-is-not-a-noindex-substitute distinction this
 * file's docblock opens with. Blocking crawl here would be
 * counterproductive even as a stopgap: a page a crawler can never fetch is
 * a page whose (future) noindex tag it can never see either.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOWED_PATHS,
    },
    sitemap: `${SEO_ORIGIN}/sitemap.xml`,
  };
}
