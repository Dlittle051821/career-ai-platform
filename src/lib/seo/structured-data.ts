import { BRAND_LOGO, BRAND_NAME, BRAND_SHORT_DESCRIPTION, SITE_URL } from "@/config/site";

/**
 * M17B FINAL — production-origin fallback for this file's own absolute
 * URLs, matching the same `https://www.nextwise.world` (WITH www) value
 * used as the fallback in `src/app/robots.ts`, `src/app/sitemap.ts`, and
 * `src/app/(site)/layout.tsx`'s `PRODUCTION_ORIGIN`. Before this fix, this
 * file was the one place in the SEO layer with no hardcoded fallback at
 * all: `url`/`logo` below silently degraded to `undefined`/a relative path
 * whenever `NEXT_PUBLIC_APP_URL` was unset, unlike every other file in this
 * layer. `SITE_URL` (env-derived) is still preferred when it is genuinely
 * set to something — this constant is only the last resort, never
 * overriding a real configured value.
 */
const PRODUCTION_ORIGIN = "https://www.nextwise.world";

/**
 * Organization + WebSite JSON-LD for the public site, rendered as a
 * `<script type="application/ld+json">` in src/app/(site)/layout.tsx per
 * Next.js's documented pattern (node_modules/next/dist/docs/01-app/
 * 02-guides/json-ld.md). Deliberately minimal: only facts already stated
 * elsewhere in the app (brand name, description, logo) — no invented
 * founding date, address, social profiles, or ratings.
 *
 * The site currently ships with `robots: { index: false, follow: false }`
 * (see the layout's metadata export) while the product is still pre-launch,
 * so this has no practical effect on search results yet — it's here so
 * structured data is correct and ready the moment indexing is turned on,
 * without anyone having to remember to add it later.
 */
export function getOrganizationJsonLd() {
  const origin = SITE_URL || PRODUCTION_ORIGIN;
  const absoluteLogo = `${origin}${BRAND_LOGO.icon512}`;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    url: origin,
    logo: absoluteLogo,
  };
}

export function getWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    url: SITE_URL || PRODUCTION_ORIGIN,
  };
}

/**
 * M17B FINAL — BreadcrumbList JSON-LD for the three dynamic detail routes
 * (careers/[slug], courses/[universitySlug]/[courseSlug],
 * universities/[slug]), which already render a real, matching visual
 * breadcrumb trail via the `Breadcrumbs` component. `items` must mirror
 * that same visual trail exactly — this is never invented hierarchy, only
 * a machine-readable version of what the page already shows. `path` is a
 * site-relative path (e.g. `/careers/ev-systems-engineer`); this function
 * resolves it against the same `SITE_URL || PRODUCTION_ORIGIN` fallback
 * used above so both JSON-LD blocks agree on one origin.
 */
export function getBreadcrumbListJsonLd(items: { name: string; path?: string }[]) {
  const origin = SITE_URL || PRODUCTION_ORIGIN;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: `${origin}${item.path}` } : {}),
    })),
  };
}

/** JSON.stringify with `<` escaped, per the Next.js JSON-LD guide, so the payload can never break out of the surrounding <script> tag. */
export function toSafeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
