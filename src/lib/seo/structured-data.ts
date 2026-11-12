import { OFFICIAL_CONTACT } from "@/config/contact";
import { SEO_ORIGIN } from "@/config/seo";
import { BRAND_LOGO, BRAND_NAME, BRAND_SHORT_DESCRIPTION } from "@/config/site";

// Only existing brand facts are included; no invented ratings or address.
export function getOrganizationJsonLd() {
  const origin = SEO_ORIGIN;
  const absoluteLogo = `${origin}${BRAND_LOGO.icon512}`;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    url: origin,
    logo: absoluteLogo,
    // CIUX-01: the official public contact details (src/config/contact.ts).
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: OFFICIAL_CONTACT.phone.e164,
        email: OFFICIAL_CONTACT.founder.email,
        areaServed: "IN",
        availableLanguage: ["English"],
      },
    ],
  };
}

export function getWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    url: SEO_ORIGIN,
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
 * resolves it against the same `SEO_ORIGIN` fallback
 * used above so both JSON-LD blocks agree on one origin.
 */
export function getBreadcrumbListJsonLd(items: { name: string; path?: string }[]) {
  const origin = SEO_ORIGIN;
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
