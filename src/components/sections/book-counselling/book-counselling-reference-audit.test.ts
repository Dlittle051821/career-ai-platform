import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * UX10-DS02 "Public Discovery Entry & Auth Flow" — static source-text
 * audit, same "no React Testing Library/jsdom in this project" convention
 * as every other `*-reference-audit.test.ts` file in this codebase (e.g.
 * src/components/sections/discovery-session/discovery-session-reference-
 * audit.test.ts, this milestone's own direct predecessor). Covers this
 * milestone's own mandatory regression categories: the public landing no
 * longer looks like a fake booking form, auth CTAs carry a safe `next`,
 * public-vs-authenticated CTA destinations stay correctly classified, the
 * safe-redirect helper (not a hand-rolled check) is what every `next`
 * consumer actually uses, and UX10-DS01's real booking workflow is still
 * completely untouched.
 */
const ROOT = path.join(__dirname, "..", "..", "..");
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), "utf8");

/** Same false-positive-avoidance convention as every other *-reference-audit.test.ts file's own stripComments(). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const PAGE = read("app/(site)/book-counselling/page.tsx");
const HERO = read("components/sections/book-counselling/DiscoveryEntryHero.tsx");
const CARDS = read("components/sections/book-counselling/DiscoveryEntryExplainerCards.tsx");
const SAFE_REDIRECT = read("lib/auth/safe-redirect.ts");
const CALLBACK_ROUTE = read("app/auth/callback/route.ts");
const LOGIN_FORM = read("components/sections/auth/LoginForm.tsx");
const REGISTER_FORM = read("components/sections/auth/RegisterForm.tsx");
const LOGIN_PAGE = read("app/(site)/login/page.tsx");
const REGISTER_PAGE = read("app/(site)/register/page.tsx");
const MIDDLEWARE = read("lib/supabase/middleware.ts");

// Authenticated DS01 booking workflow — must remain completely untouched.
const DS01_PAGE = read("app/(site)/discovery-session/book/page.tsx");
const DS01_REAL_FORM = read("components/sections/discovery-session/DiscoverySessionBookingForm.tsx");
const DS01_REAL_ACTION = read("app/(site)/discovery-session/book/actions.ts");
const DS01_REAL_BOOK_LIB = read("lib/supabase/discovery-sessions/book.ts");

// Public marketing CTA surfaces — should route through /book-counselling.
const HOME_FINAL_CTA = read("components/sections/home/HomeFinalCTA.tsx");
const HOW_IT_WORKS_HERO = read("components/sections/how-it-works/HowItWorksHero.tsx");
const EUROPE_EXPLORER_HERO = read("components/sections/europe-explorer/EuropeExplorerHero.tsx");
const PRICING_CARD = read("components/sections/pricing/PublicPricingPlanCard.tsx");
const STUDY_EUROPE_PAGE = read("app/(site)/study-europe/page.tsx");
const HOW_IT_WORKS_PAGE = read("app/(site)/how-it-works/page.tsx");
const APPLICATIONS_PAGE = read("app/(site)/applications/page.tsx");
const NOT_FOUND_PAGE = read("app/(site)/not-found.tsx");
const CTA_SECTION = read("components/sections/CTASection.tsx");
const SITE_CONFIG = read("config/site.ts");

// Authenticated/internal student surfaces — should route directly to
// /discovery-session/book.
const DASHBOARD_SHELL = read("components/dashboard/DashboardShell.tsx");
const MOBILE_TAB_BAR = read("components/dashboard/MobileTabBar.tsx");
const PROFILE_COUNSELLOR_CARD = read("components/sections/profile/ProfileCounsellorCard.tsx");
const DISCOVERY_SESSION_CARD = read("components/dashboard/DiscoverySessionCard.tsx");

describe("DS02 — /book-counselling is a genuine public entry page, not a fake booking form", () => {
  it("no longer imports or renders the Milestone-1 demo BookingForm", () => {
    expect(PAGE).not.toContain("book-counselling/BookingForm");
    expect(PAGE).not.toMatch(/<BookingForm\s*\/>/);
  });

  it("renders the new public hero and explainer-card sections instead", () => {
    expect(PAGE).toContain('from "@/components/sections/book-counselling/DiscoveryEntryHero"');
    expect(PAGE).toContain('from "@/components/sections/book-counselling/DiscoveryEntryExplainerCards"');
    expect(PAGE).toMatch(/<DiscoveryEntryHero\b/);
    expect(PAGE).toMatch(/<DiscoveryEntryExplainerCards\s*\/>/);
  });

  it("checks real auth state server-side, via the same pattern UX10-DS01's own page uses — no private profile data is fetched, only session presence", () => {
    expect(PAGE).toContain('from "@/lib/supabase/server"');
    expect(PAGE).toContain("supabase.auth.getUser()");
    expect(PAGE).toMatch(/isAuthenticated=\{Boolean\(user\)\}/);
  });

  it("free / no-pressure / India+Europe / parents-welcome wording is present", () => {
    expect(HERO).toMatch(/free/i);
    expect(HERO).toMatch(/no pressure/i);
    expect(HERO).toMatch(/India and Europe/);
    expect(HERO).toMatch(/Parents welcome/);
  });

  it("the 3 explainer cards are present and make no guaranteed-outcome claim", () => {
    expect(CARDS).toMatch(/Understand your goals/);
    expect(CARDS).toMatch(/Explore India and Europe options/);
    expect(CARDS).toMatch(/Get clear next steps/);
    const strippedCards = stripComments(CARDS);
    expect(strippedCards).not.toMatch(/guarantee/i);
    expect(strippedCards).not.toMatch(/instant match/i);
  });

  it("never reintroduces the non-approved launch countries or a country-by-country Europe picker", () => {
    const strippedHero = stripComments(HERO);
    for (const forbidden of ["United States", "United Kingdom", /\bUSA\b/, /\bUK\b/, "Canada", "Australia", "Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"]) {
      if (typeof forbidden === "string") {
        expect(strippedHero).not.toContain(forbidden);
      } else {
        expect(strippedHero).not.toMatch(forbidden);
      }
    }
  });

  it("never uses scarcity/hard-sales auth copy", () => {
    const strippedHero = stripComments(HERO).toLowerCase();
    expect(strippedHero).not.toContain("limited availability");
    expect(strippedHero).not.toContain("unlock premium");
  });
});

describe("DS02 — auth CTAs preserve a safe return-to-booking destination", () => {
  it("the logged-out hero sends Create Free Account and Sign In through next=/discovery-session/book", () => {
    expect(HERO).toContain('href="/register?next=/discovery-session/book"');
    expect(HERO).toContain('href="/login?next=/discovery-session/book"');
    expect(HERO).toContain("Create Free Account");
    expect(HERO).toContain("Sign In");
  });

  it("an already-authenticated visitor sees a direct Book Free Session CTA instead of being asked to sign in again (brief's own preferred Option A)", () => {
    expect(HERO).toContain("isAuthenticated");
    expect(HERO).toMatch(/href="\/discovery-session\/book"/);
    expect(HERO).toContain("Book Free Session");
  });

  it("LoginForm and the auth callback route both resolve `next` through the shared getSafeRedirectPath helper, not a hand-rolled check", () => {
    expect(LOGIN_FORM).toContain('from "@/lib/auth/safe-redirect"');
    expect(LOGIN_FORM).toContain("getSafeRedirectPath(");
    expect(CALLBACK_ROUTE).toContain('from "@/lib/auth/safe-redirect"');
    expect(CALLBACK_ROUTE).toContain("getSafeRedirectPath(");
    // Checked against comment-stripped source: both files' own docblocks
    // legitimately quote the old, insufficient `next.startsWith("/")`
    // pattern in prose while explaining why it was replaced — the same
    // false-positive trap every other *-reference-audit.test.ts file's
    // own stripComments() docblock describes.
    expect(stripComments(LOGIN_FORM)).not.toMatch(/next\.startsWith\(/);
    expect(stripComments(CALLBACK_ROUTE)).not.toMatch(/next\.startsWith\(/);
  });

  it("the safe-redirect helper rejects protocol-relative and external values, not just checking a single leading slash", () => {
    expect(SAFE_REDIRECT).toContain("SAFE_INTERNAL_PATH");
    expect(SAFE_REDIRECT).toContain('includes("://")');
  });

  it("login and register pages preserve `next` across their cross-links to each other", () => {
    expect(LOGIN_FORM).toContain("registerHref");
    expect(REGISTER_FORM).toContain("loginHref");
    expect(LOGIN_PAGE).toContain("registerHref");
  });

  it("login/register copy stays generic for every other use (never Discovery-only) and only changes for the exact Discovery intent", () => {
    expect(LOGIN_PAGE).toContain('safeNext === "/discovery-session/book"');
    expect(LOGIN_PAGE).toContain("Welcome back");
    expect(REGISTER_PAGE).toContain('safeNext === "/discovery-session/book"');
    expect(REGISTER_PAGE).toContain("Create your student account");
  });
});

describe("DS02 — public vs. authenticated Discovery CTA destinations stay correctly classified", () => {
  it("public marketing CTAs route through /book-counselling, never directly to the authenticated booking route", () => {
    const publicSources: Array<[string, string]> = [
      ["HomeFinalCTA.tsx", HOME_FINAL_CTA],
      ["HowItWorksHero.tsx", HOW_IT_WORKS_HERO],
      ["EuropeExplorerHero.tsx", EUROPE_EXPLORER_HERO],
      ["PublicPricingPlanCard.tsx", PRICING_CARD],
      ["applications/page.tsx", APPLICATIONS_PAGE],
      ["not-found.tsx", NOT_FOUND_PAGE],
    ];
    for (const [name, source] of publicSources) {
      expect(source, `${name} should link to /book-counselling`).toMatch(/href="\/book-counselling"/);
    }
    expect(STUDY_EUROPE_PAGE).toContain('secondaryHref="/book-counselling"');
    expect(HOW_IT_WORKS_PAGE).toContain('secondaryHref="/book-counselling"');
    expect(CTA_SECTION).toContain('primaryHref = "/book-counselling"');
    expect(SITE_CONFIG).toContain('href: "/book-counselling"');
  });

  it("authenticated/internal student surfaces route directly to the real /discovery-session/book, unchanged by this milestone", () => {
    expect(DASHBOARD_SHELL).toContain('href: "/discovery-session/book"');
    expect(MOBILE_TAB_BAR).toContain('href: "/discovery-session/book"');
    expect(PROFILE_COUNSELLOR_CARD).toContain('href="/discovery-session/book"');
    expect(DISCOVERY_SESSION_CARD).toContain('href="/discovery-session/book"');
  });
});

describe("DS02 — UX10-DS01's real booking workflow is completely untouched", () => {
  it("the real DS01 page still auth-gates and renders the real booking form exactly as before", () => {
    expect(DS01_PAGE).toContain('redirect("/login?next=/discovery-session/book")');
    expect(DS01_PAGE).toContain('from "@/components/sections/discovery-session/DiscoverySessionBookingForm"');
    expect(DS01_PAGE).toMatch(/<DiscoverySessionBookingForm\s*\/>/);
  });

  it("the real form still submits through the same real action -> data layer -> discovery_sessions insert chain", () => {
    expect(DS01_REAL_FORM).toContain("bookDiscoverySessionAction(");
    expect(DS01_REAL_ACTION).toContain("bookDiscoverySession(");
    expect(DS01_REAL_BOOK_LIB).toContain('.from("discovery_sessions")');
    expect(DS01_REAL_BOOK_LIB).toContain(".insert(");
  });

  it("the real middleware-level protection for the whole /discovery-session subtree is untouched, and /login and /register remain auth-only", () => {
    expect(MIDDLEWARE).toContain('"/discovery-session"');
    expect(MIDDLEWARE).toContain('"/login"');
    expect(MIDDLEWARE).toContain('"/register"');
  });
});

describe("DS02 — accessibility and structure invariants", () => {
  it("exactly one <h1> across the new public-landing sections (the hero)", () => {
    const counts = [HERO, CARDS].map((s) => (s.match(/<h1[\s>]/g) ?? []).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("decorative hero question bubbles are aria-hidden", () => {
    expect(HERO).toMatch(/QUESTION_BUBBLES/);
    expect(HERO).toContain('aria-hidden="true"');
  });
});

describe("DS02 — metadata", () => {
  it("the public landing's title/description match the brief's direction, and canonical is preserved", () => {
    expect(PAGE).toContain("Free Discovery Session | Nextwise");
    expect(PAGE).toMatch(/Start with a free Nextwise Discovery Session/);
    expect(PAGE).toContain('alternates: { canonical: "/book-counselling" }');
  });
});
