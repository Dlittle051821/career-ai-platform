import type { Metadata } from "next";
import { SEO_ORIGIN } from "@/config/seo";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { AppMobileTabBarSlot } from "@/components/navigation/AppMobileTabBarSlot";
import { RegistrationPrompt } from "@/components/registration-prompt/RegistrationPrompt";
import { BRAND_LOGO, BRAND_NAME, BRAND_SHORT_DESCRIPTION, BRAND_TAGLINE } from "@/config/site";
import { fontVariables } from "@/lib/fonts";
import { getOrganizationJsonLd, getWebsiteJsonLd, toSafeJsonLdString } from "@/lib/seo/structured-data";
import { HomepageFailsafe } from "@/components/sections/home/launch/HomepageFailsafe";
import { HEADER_GEOMETRY_SCRIPT } from "@/lib/navigation/header-geometry";
import "../globals.css";
import "@/styles/cc22b-launch-overrides.css";
import "@/styles/site-header.css";
import "@/styles/page-hero.css";

const DEFAULT_TITLE = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

// Canonical identity must agree with the sitemap and structured data.
export const metadata: Metadata = {
  metadataBase: new URL(SEO_ORIGIN),
  applicationName: BRAND_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_SHORT_DESCRIPTION,
  openGraph: {
    siteName: BRAND_NAME,
    title: DEFAULT_TITLE,
    description: BRAND_SHORT_DESCRIPTION,
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: BRAND_LOGO.socialShare,
        width: BRAND_LOGO.socialShareWidth,
        height: BRAND_LOGO.socialShareHeight,
        alt: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: BRAND_SHORT_DESCRIPTION,
    images: [BRAND_LOGO.socialShare],
  },
  // M17A Step 6 — the temporary site-wide `robots: { index: false, follow:
  // false }` that lived here throughout M17A Steps 1-5 has been removed.
  // This is the controlled indexability release: every private/internal/
  // authenticated route was re-confirmed (M17A_STEP6_REPORT.md §2) to carry
  // its OWN independent, permanent `robots: { index: false, follow: false }`
  // — on its own page, or on a dedicated route-group `layout.tsx` — added in
  // Step 2 (or, for /admin and /pay/[token], predating M17A entirely) and
  // unaffected by this deletion. No page in the tree relied solely on this
  // field for its protection (confirmed by grepping every `robots:`
  // declaration under src/app/(site) and src/app/admin before this change).
  // Removing it is therefore the only change needed for legitimate public
  // pages to become indexable: none of them declares its own `robots` field,
  // so once this one is gone they simply have no `robots` metadata at
  // all — which is exactly Next.js/Google's implicit `index: true, follow:
  // true` default. Do not reinstate this field without first re-running the
  // same independent-protection audit for every route category in
  // M17A_STEP6_REPORT.md §2.
};

/**
 * Root layout for the public/student site — everything except `/admin`.
 * Milestone 7 split this out of what used to be the single
 * `src/app/layout.tsx` (see `src/app/admin/layout.tsx` for the other half)
 * specifically so the internal admin system never renders the public
 * marketing header/footer (login/register links, pricing, etc.) — an
 * admin looking at `/admin/students` should see an unambiguous internal
 * tool, not the public site with a sidebar bolted on. Splitting into two
 * root layouts is the Next.js-supported pattern for this
 * (https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#root-layout-required)
 * — each one defines its own `<html>`/`<body>`.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    // CIUX-01B: suppressHydrationWarning covers only <html>'s own attributes — the header geometry script sets
    // --nwh-* and data-nwh-mode there before hydration, by design (src/lib/navigation/header-geometry.ts).
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(getOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(getWebsiteJsonLd()) }}
        />
        {/* CIUX-01B: places the global header with the homepage's stage geometry before the first paint
            (src/lib/navigation/header-geometry.ts), so it never jumps or shifts content. */}
        <script dangerouslySetInnerHTML={{ __html: HEADER_GEOMETRY_SCRIPT }} />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <AppMobileTabBarSlot />
        <Footer />
        {/* NW08.5 — mounted once, centrally, for the whole public site;
            see RegistrationPrompt.tsx's own docblock. Renders nothing
            (a closed <dialog>) until its own timer/contextual-trigger
            logic decides to open. */}
        <RegistrationPrompt />
        <HomepageFailsafe />
      </body>
    </html>
  );
}
