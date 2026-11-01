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

/** Flat navy used to keep the OG image and any dark logo surface visually consistent with the product's own design tokens. UX10A correction pass: now matches the authoritative --brand-ink value in src/app/globals.css (#0b1f3a), the approved brand spec's Navy. Not a full design-token palette change (this is a plain-string constant for non-CSS contexts, not a second source of truth). */
export const BRAND_DARK_BG = "#0b1f3a";

export const CURRENT_YEAR = new Date().getFullYear();

/**
 * NW08.5 — single authoritative primary-navigation config.
 *
 * Supersedes the UX03-04/NW03.2/NW04.5 structure (a flat "Explore"
 * dropdown + a separate PRODUCT_NAV row + a separate PRIMARY_NAV row,
 * each rendered slightly differently by Header.tsx vs MobileNav.tsx).
 * NW08.5's own brief is explicit: the public primary desktop nav must be
 * exactly six flat items in exactly this order, with no "Products" /
 * "For Students" / "Resources" / "About" dropdown grouping on the main
 * nav — and there must be ONE array both Header.tsx and MobileNav.tsx
 * read, not independently-maintained lists. MAIN_NAV is that one array.
 *
 * Label choices follow the brief's own explicit product-naming
 * distinction (section "Product & Navigation Philosophy"): "Explore
 * Careers" is the plain public directory (/careers), "Career
 * Intelligence" is the guided product (/career), and the nav slot for
 * /abroad is labelled "Study Abroad" (the public entry point) rather than
 * the branded product name "Nextwise Abroad" (which still appears on the
 * page itself and in FOOTER_NAV's "Products" group — the product's brand
 * name, not the nav entry point's label).
 *
 * No href below is new: every one of these six routes already existed
 * and was already reachable before this change.
 */
export const MAIN_NAV: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Explore Careers", href: "/careers", description: "Browse careers, what they involve, and how to get there." },
  { label: "Career Intelligence", href: "/career", description: "Guided career discovery, planning, and counselling in India." },
  { label: "Study Abroad", href: "/abroad", description: "Research and plan studying abroad across six countries." },
  { label: "Universities", href: "/universities", description: "Explore universities and compare what each one offers." },
  { label: "Courses", href: "/courses", description: "Find courses across universities that match a path you're considering." },
];

/**
 * UX10A — the header's explicit "Home" link, kept as its own named export
 * (rather than requiring every caller to read MAIN_NAV[0]) since several
 * existing call sites (Header.tsx, MobileNav.tsx, this file's own tests)
 * already address it by name. Always the same object as MAIN_NAV[0] — not
 * a second, independently-maintained copy of the label/href.
 */
export const HOME_NAV_LINK: NavLink = MAIN_NAV[0];

/**
 * NW08.5 — every primary-nav item except Home, in the same order, for
 * callers (Header.tsx's desktop row, MobileNav.tsx's drawer) that render
 * Home separately from the rest of the row.
 */
export const MAIN_NAV_ITEMS: NavLink[] = MAIN_NAV.slice(1);

/**
 * NW08.5 — secondary public pages. Per the brief: these do NOT get a
 * top-level primary-nav slot, but stay fully reachable via the footer (and
 * via in-page sections/CTAs/breadcrumbs) — nothing below is deleted or
 * made unreachable, only moved out of the primary header row. Previously
 * split across PRIMARY_NAV (How It Works/Counselling/Pricing/About) and
 * assorted footer-only entries (Career Discovery/Compare Careers/Study
 * Options/Parents/Trust/Contact); now one list, which FOOTER_NAV below
 * reads from directly rather than re-declaring its own copies.
 */
export const SECONDARY_NAV: NavLink[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Counselling", href: "/book-counselling" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Career Discovery", href: "/career-discovery" },
  { label: "Compare Careers", href: "/compare" },
  { label: "Study Options", href: "/study-options" },
  { label: "For Parents", href: "/parents" },
  { label: "Trust Center", href: "/trust" },
  { label: "Contact", href: "/contact" },
];

/**
 * NW08.5 — footer navigation, now sourced from MAIN_NAV/SECONDARY_NAV
 * rather than independently hand-typed hrefs/labels (the brief's own "one
 * authoritative navigation config... not independent arrays" instruction).
 * Group HEADINGS stay hand-authored (the brief explicitly allows "Products"
 * / "For Students" / "Resources" / "About" to remain as footer headings
 * even though they're gone from the primary nav) and the "Products" group
 * keeps the branded product name "Nextwise Abroad" (a product-naming
 * choice, distinct from the primary nav's "Study Abroad" entry-point
 * label — see MAIN_NAV's own docblock) since nothing requires the footer
 * and header to use identical label text for the same href, only that
 * both read from the same underlying route data.
 */
function findNav(href: string): NavLink {
  const found = [...MAIN_NAV, ...SECONDARY_NAV].find((link) => link.href === href);
  if (!found) throw new Error(`findNav: no nav entry registered for ${href}`);
  return found;
}

export const FOOTER_NAV: Record<string, NavLink[]> = {
  Products: [
    { ...findNav("/career"), label: "Career Intelligence" },
    { ...findNav("/abroad"), label: "Nextwise Abroad" },
  ],
  Explore: [
    { ...findNav("/careers"), label: "Careers" },
    findNav("/courses"),
    findNav("/universities"),
    findNav("/study-options"),
    findNav("/compare"),
  ],
  Nextwise: [
    findNav("/how-it-works"),
    findNav("/book-counselling"),
    findNav("/pricing"),
    findNav("/about"),
    findNav("/career-discovery"),
  ],
  "For Families": [findNav("/parents"), findNav("/trust"), findNav("/contact")],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Refund Policy", href: "/refund-policy" },
  ],
  Account: [
    { label: "Sign In", href: "/login" },
    { label: "Get Started", href: "/register" },
  ],
};

/**
 * Contact details are placeholders until verified information is supplied
 * by the business owner. Never invent an address, phone number, or
 * registration ID — surface the placeholder state instead.
 *
 * NW08.5 — `hello@nextwise.example` (an RFC 2606 reserved "example" domain
 * that cannot route real mail) was removed per this milestone's explicit
 * instruction not to present a fabricated-looking business email address
 * as if it were a real contact method. No real, approved email address has
 * been supplied, so this now states that plainly — the same honest
 * "coming soon" / "not yet published" treatment already used below for
 * phone support and the physical office, not a guessed replacement address.
 */
export const CONTACT = {
  emailLabel: "Email support — coming soon",
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
