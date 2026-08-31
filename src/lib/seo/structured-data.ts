import { BRAND_LOGO, BRAND_NAME, BRAND_SHORT_DESCRIPTION, SITE_URL } from "@/config/site";

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
  const absoluteLogo = SITE_URL ? `${SITE_URL}${BRAND_LOGO.icon512}` : BRAND_LOGO.icon512;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    url: SITE_URL || undefined,
    logo: absoluteLogo,
  };
}

export function getWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    url: SITE_URL || undefined,
  };
}

/** JSON.stringify with `<` escaped, per the Next.js JSON-LD guide, so the payload can never break out of the surrounding <script> tag. */
export function toSafeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
