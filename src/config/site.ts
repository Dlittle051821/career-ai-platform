import type { NavLink } from "@/types";

/**
 * Single source of truth for brand identity and site-wide constants.
 * Rename the product by editing BRAND_NAME here — nowhere else in the
 * codebase should the brand string be hard-coded.
 */
export const BRAND_NAME = "CareerPath AI";
export const BRAND_TAGLINE = "Career decisions before course decisions";
export const BRAND_SHORT_DESCRIPTION =
  "CareerPath AI helps students and families in Odisha make evidence-informed career and education decisions — in India and abroad — before they spend significant money.";

/**
 * No production domain has been assigned yet. Keep this empty in
 * Milestone 1; metadata and canonical URLs fall back to relative paths
 * when SITE_URL is unset.
 */
export const SITE_URL = "";

export const CURRENT_YEAR = new Date().getFullYear();

export const PRIMARY_NAV: NavLink[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Career Discovery", href: "/career-discovery" },
  { label: "Career Explorer", href: "/careers" },
  { label: "Study Options", href: "/study-options" },
  { label: "For Parents", href: "/parents" },
  { label: "Pricing", href: "/pricing" },
];

export const UTILITY_NAV: NavLink[] = [
  { label: "Trust Center", href: "/trust" },
];

export const FOOTER_NAV: Record<string, NavLink[]> = {
  Explore: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "Career Discovery", href: "/career-discovery" },
    { label: "Study Options", href: "/study-options" },
    { label: "Pricing", href: "/pricing" },
  ],
  Students: [
    { label: "Career Discovery", href: "/career-discovery" },
    { label: "Book Free Counselling", href: "/book-counselling" },
    { label: "How Support Works", href: "/how-it-works" },
  ],
  Parents: [
    { label: "For Parents", href: "/parents" },
    { label: "Trust Center", href: "/trust" },
    { label: "Refund Policy", href: "/refund-policy" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Trust Center", href: "/trust" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Refund Policy", href: "/refund-policy" },
  ],
};

/**
 * Contact details are placeholders until verified information is supplied
 * by the business owner. Never invent an address, phone number, or
 * registration ID — surface the placeholder state instead.
 */
export const CONTACT = {
  emailLabel: "hello@careerpathai.example (placeholder)",
  phoneLabel: "Phone support — coming soon",
  cityStatement:
    "Built for students and families across Odisha. We operate as a remote-first guidance team; a physical office is not yet published.",
  supportHours: "Mon–Sat, 10:00–18:00 IST (illustrative — to be confirmed)",
};

export const LEGAL_STATUS = {
  lastUpdated: "19 August 2026",
  registrationNote:
    "Legal entity name, registration number, and GST details will be published here once verified by the business owner.",
};

export type SupportedLanguage = {
  code: "en" | "or";
  label: string;
  nativeLabel: string;
  available: boolean;
};

export const LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", available: true },
  { code: "or", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", available: false },
];
