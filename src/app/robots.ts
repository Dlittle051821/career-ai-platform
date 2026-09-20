import type { MetadataRoute } from "next";

/**
 * M17A Step 4 — production robots.txt, served at /robots.txt via Next.js's
 * App Router robots convention (this file's default export). See
 * M17A_SEO_AUDIT.md and M17A_STEP4_REPORT.md for the full reasoning behind
 * every rule below.
 *
 * CRITICAL DISTINCTION this file must not blur (per this step's own
 * instruction): robots.txt controls CRAWLING (whether a bot may fetch a
 * URL at all); it is not a substitute for the permanent, page-level
 * `robots: { index: false, follow: false }` metadata added in Step 2
 * (which controls INDEXING). Every path disallowed below is disallowed
 * because it is genuinely private/internal and there is nothing there for
 * a crawler to usefully fetch — not as a way to hide something that should
 * instead carry its own noindex tag. robots.txt is publicly world-readable
 * and is never treated as a security mechanism.
 *
 * SITEMAP_BASE_URL mirrors src/app/sitemap.ts exactly — a hardcoded
 * literal, not derived from the environment-dependent SITE_URL, so this
 * file always points at the real production domain regardless of how
 * NEXT_PUBLIC_APP_URL happens to be configured wherever this builds. Kept
 * as a single duplicated constant (rather than importing it from
 * sitemap.ts) so this file has no import-time dependency on that one —
 * two tiny literal strings that must simply be kept in sync by inspection,
 * simpler than adding a shared module for a single string used twice.
 */
const SITEMAP_BASE_URL = "https://nextwise.world";

/**
 * Every one of these is deliberately written WITHOUT a trailing slash,
 * even though this step's own instruction listed illustrative examples
 * with one (e.g. "/dashboard/"). A trailing-slash-only prefix only matches
 * a URL that has something after the slash — it would fail to disallow
 * the bare private page itself (e.g. "/dashboard/" does not match
 * "/dashboard"). Every path below is a route that exists both as a bare
 * page and, in most cases, with children (e.g. /profile and
 * /profile/onboarding; /applications and /applications/[id]) — omitting
 * the trailing slash correctly disallows both the bare path and everything
 * nested under it, via ordinary robots.txt string-prefix matching. Cross-
 * checked against M17A_SEO_AUDIT.md's route table: none of these prefixes
 * is a string-prefix of any public route (see M17A_STEP4_REPORT.md for the
 * full collision check).
 */
const DISALLOWED_PATHS = [
  // Authenticated/private student routes (Group C in the audit) — each of
  // these is also independently protected by its own permanent noindex
  // metadata from Step 2; disallowing crawl here is additionally about
  // never spending crawl budget on pages middleware will redirect away
  // from anonymous requests anyway, not the primary defense.
  "/dashboard",
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
    sitemap: `${SITEMAP_BASE_URL}/sitemap.xml`,
  };
}
