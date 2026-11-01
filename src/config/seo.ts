import type { Metadata } from "next";
import { BRAND_LOGO, BRAND_NAME } from "./site";

// Public search identity is independent of app/auth/payment redirect origins.
// Preview access and indexing controls belong to the deployment environment.
export const SEO_ORIGIN = "https://www.nextwise.world";

export function publicPageMetadata(path: string, title: string, description: string): Metadata {
  const brandedTitle = `${title} | ${BRAND_NAME}`;
  return {
    title: { absolute: brandedTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: brandedTitle,
      description,
      url: new URL(path, SEO_ORIGIN).href,
      siteName: BRAND_NAME,
      type: "website",
      locale: "en_IN",
      images: [{
        url: new URL(BRAND_LOGO.socialShare, SEO_ORIGIN).href,
        width: BRAND_LOGO.socialShareWidth,
        height: BRAND_LOGO.socialShareHeight,
        alt: BRAND_NAME,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: brandedTitle,
      description,
      images: [new URL(BRAND_LOGO.socialShare, SEO_ORIGIN).href],
    },
  };
}
