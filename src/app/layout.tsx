import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { BRAND_NAME, BRAND_SHORT_DESCRIPTION, SITE_URL } from "@/config/site";
import "./globals.css";

// Body copy: a warm, highly-legible geometric sans.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Headings: a soft-optical-size serif for an editorial, trustworthy feel —
// distinct from generic SaaS sans-only type without tipping into ornate.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: "variable",
  axes: ["opsz", "SOFT"],
});

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
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
