import type { Metadata } from "next";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { fontVariables } from "@/lib/fonts";
import SiteNotFound from "./(site)/not-found";
import "./globals.css";
import "@/styles/site-header.css";
import "@/styles/page-hero.css";
import { HEADER_GEOMETRY_SCRIPT } from "@/lib/navigation/header-geometry";

/**
 * CC-22B — the app has several root layouts ((site), dashboard, studio,
 * profile, admin, counsellor, …) and no single root layout, so an unmatched
 * top-level URL used to fall through to Next.js's default unbranded 404.
 * This renders the same branded not-found content as (site)/not-found.tsx
 * inside the public site chrome. Enabled by experimental.globalNotFound in
 * next.config.ts. It is noindex, like every other not-found branch.
 */
export const metadata: Metadata = {
  title: "Page not found | NextWise",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    // CIUX-01B: suppressHydrationWarning covers only <html>'s own attributes — the header geometry script sets
    // --nwh-* and data-nwh-mode there before hydration, by design (src/lib/navigation/header-geometry.ts).
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        {/* CIUX-01B: the global header's geometry before first paint (as in the (site) layout). */}
        <script dangerouslySetInnerHTML={{ __html: HEADER_GEOMETRY_SCRIPT }} />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content">
          <SiteNotFound />
        </main>
        <Footer />
      </body>
    </html>
  );
}
