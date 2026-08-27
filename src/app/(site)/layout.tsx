import type { Metadata } from "next";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { BRAND_NAME, BRAND_SHORT_DESCRIPTION, SITE_URL } from "@/config/site";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: {
    default: `${BRAND_NAME} — Career-first guidance for students in Odisha`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_SHORT_DESCRIPTION,
  openGraph: {
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — Career-first guidance for students in Odisha`,
    description: BRAND_SHORT_DESCRIPTION,
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: `${BRAND_NAME} — Career-first guidance for students in Odisha`,
    description: BRAND_SHORT_DESCRIPTION,
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
