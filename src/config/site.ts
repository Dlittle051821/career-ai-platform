import type { NavLink } from "@/types";

/**
 * Single source of truth for brand identity and site-wide constants.
 * Rename the product by editing the values below — nowhere else in the
 * codebase should the brand string, tagline, or logo paths be hard-coded.
 *
 * Branding history: this product shipped Milestones 1-9 under the working
 * name "CareerPath AI" and was rebranded to "NextWise" afterward. The
 * rename touched only this file's values, the logo assets under
 * public/brand/, and every call site that previously hard-coded the old
 * string — no route paths, table names, or technical identifiers changed
 * (see docs/branding-guide.md for the full list of what was and wasn't
 * renamed).
 */
export const BRAND_NAME = "NextWise";
export const BRAND_PRODUCT_NAME = BRAND_NAME;
export const BRAND_SHORT_NAME = "NextWise";
export const BRAND_TAGLINE = "Know What's Next.";
export const BRAND_SHORT_DESCRIPTION =
  "NextWise helps students explore careers, discover universities and courses, manage applications, receive counselling, and make informed education decisions.";

/**
 * Legal entity name is intentionally NOT hard-coded here. The one place
 * legal/registered-business identity is recorded is the admin-configured
 * `billing_settings.legal_entity_name` column (see
 * src/lib/supabase/admin/billing-settings.ts) — it stays whatever value an
 * admin has entered (or null) and is never auto-populated with the product
 * name. Never invent a registration number, address, or tax ID here either.
 */

/**
 * Public site origin, read from the same NEXT_PUBLIC_APP_URL environment
 * variable already used to build absolute payment-link URLs
 * (src/lib/payments/env.ts). NEXT_PUBLIC_-prefixed variables are inlined at
 * build time and are safe to reference directly in code that also renders
 * on the client — this is not a private secret. Falls back to an empty
 * string (metadata and canonical URLs then fall back to relative paths)
 * when unset, e.g. in local development without a .env.local.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

/**
 * Logo and icon assets. All files live under public/brand/ as supplied,
 * optimized PNGs — see docs/branding-guide.md for provenance, proportions,
 * and which supplied source file each one was derived from. Never stretch,
 * recolor, or add effects to these; if a new lockup is needed, source a new
 * asset rather than modifying these.
 */
export const BRAND_LOGO = {
  /** Full horizontal lockup (mark + "NEXTWISE" + tagline), transparent background — for light surfaces. */
  horizontal: "/brand/nextwise-logo-horizontal.png",
  horizontalWidth: 2235,
  horizontalHeight: 779,
  /** Full horizontal lockup, flattened on its own dark-navy field — for dark surfaces (admin shell, dark footers, PDF cover if ever needed). */
  horizontalDark: "/brand/nextwise-logo-horizontal-dark.png",
  horizontalDarkWidth: 1660,
  horizontalDarkHeight: 948,
  /** Icon/symbol only ("N" ribbon + arrow), transparent, square canvas — for compact placements (mobile nav, favicons, avatars). */
  icon: "/brand/nextwise-icon.png",
  icon192: "/brand/nextwise-icon-192.png",
  icon512: "/brand/nextwise-icon-512.png",
  /** Social share / Open Graph image, 1200x630, logo letterboxed on its own navy field (no distortion). */
  socialShare: "/brand/nextwise-social-share.png",
  socialShareWidth: 1200,
  socialShareHeight: 630,
} as const;

/** Flat navy sampled from the supplied dark lockup — used to keep the OG image and any dark logo surface visually consistent. Not a full design-token palette change. */
export const BRAND_DARK_BG = "#000c24";

export const CURRENT_YEAR = new Date().getFullYear();

export const PRIMARY_NAV: NavLink[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Career Discovery", href: "/career-discovery" },
  { label: "Career Explorer", href: "/careers" },
  { label: "Compare Careers", href: "/compare" },
  { label: "Universities", href: "/universities" },
  { label: "Courses", href: "/courses" },
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
    { label: "Universities", href: "/universities" },
    { label: "Courses", href: "/courses" },
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
  emailLabel: "hello@nextwise.example (placeholder)",
  phoneLabel: "Phone support — coming soon",
  cityStatement:
    "Built for students and families across Odisha. We operate as a remote-first guidance team; a physical office is not yet published.",
  supportHours: "Mon–Sat, 10:00–18:00 IST (illustrative — to be confirmed)",
};

export const LEGAL_STATUS = {
  lastUpdated: "28 August 2026",
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
