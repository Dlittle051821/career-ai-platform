import type { Metadata } from "next";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { BRAND_LOGO, BRAND_NAME, BRAND_SHORT_DESCRIPTION, BRAND_TAGLINE, SITE_URL } from "@/config/site";
import { fontVariables } from "@/lib/fonts";
import { getOrganizationJsonLd, getWebsiteJsonLd, toSafeJsonLdString } from "@/lib/seo/structured-data";
import "../globals.css";

const DEFAULT_TITLE = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/**
 * M17A Step 5 — production fallback for `metadataBase`. `SITE_URL` (from
 * src/config/site.ts) reads `NEXT_PUBLIC_APP_URL`, which is unset in this
 * repo's own env files and, per the audit, cannot be assumed to be reliably
 * configured to the production origin in every environment this builds in
 * — exactly why every build this milestone has produced logs Next.js's own
 * "metadataBase ... using http://localhost:3000" warning. Every canonical
 * URL added in this step (via `alternates.canonical`) is a *relative* path
 * resolved against this value, so an unset/misconfigured env var would
 * silently turn every canonical tag into a `localhost:3000` URL in
 * production — a real regression, not a cosmetic warning. This mirrors the
 * same reliability reasoning already applied to `src/app/sitemap.ts` and
 * `src/app/robots.ts` (Steps 3-4): prefer `SITE_URL` when it is genuinely
 * set to something, but never fall through to `undefined`/localhost for
 * the one deployment that matters.
 */
const PRODUCTION_ORIGIN = "https://nextwise.world";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL || PRODUCTION_ORIGIN),
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
  robots: {
    index: false,
    follow: false,
  },
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
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(getOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(getWebsiteJsonLd()) }}
        />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
