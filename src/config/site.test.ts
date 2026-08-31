import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOGO, BRAND_NAME, BRAND_PRODUCT_NAME, BRAND_SHORT_NAME, BRAND_TAGLINE, CONTACT, SITE_URL } from "./site";

const ROOT = process.cwd();

describe("central brand configuration (src/config/site.ts)", () => {
  it("names the product NextWise consistently across every brand-name export", () => {
    expect(BRAND_NAME).toBe("NextWise");
    expect(BRAND_PRODUCT_NAME).toBe("NextWise");
    expect(BRAND_SHORT_NAME).toBe("NextWise");
  });

  it("carries the official tagline from the supplied logo lockup", () => {
    expect(BRAND_TAGLINE).toBe("Know What's Next.");
  });

  it("every BRAND_LOGO path is absolute (site-root-relative) and points at a file that actually exists under public/", () => {
    const pathKeys = Object.entries(BRAND_LOGO).filter(([key]) => !key.match(/Width|Height$/));
    expect(pathKeys.length).toBeGreaterThan(0);
    for (const [key, value] of pathKeys) {
      expect(value, `${key} should start with "/"`).toMatch(/^\//);
      const onDisk = path.join(ROOT, "public", value as string);
      expect(existsSync(onDisk), `${key} (${value}) should exist on disk at ${onDisk}`).toBe(true);
    }
  });

  it("never presents the placeholder support email as if it were a real, monitored address", () => {
    // This must never be silently "promoted" to a bare address by a future
    // edit — the placeholder marker is what tells every caller (footer,
    // contact page) not to treat it as a real inbox.
    expect(CONTACT.emailLabel).toContain("(placeholder)");
    expect(CONTACT.emailLabel).not.toContain("careerpathai");
  });

  it("SITE_URL has no trailing slash when set, and is a plain empty string (not undefined/null) when unset", () => {
    expect(SITE_URL === "" || !SITE_URL.endsWith("/")).toBe(true);
  });
});

describe("SITE_URL reads NEXT_PUBLIC_APP_URL at import time", () => {
  it("strips a trailing slash from a configured NEXT_PUBLIC_APP_URL", async () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.nextwise.example/";
    // Fresh module instance so the top-level `SITE_URL = ...` assignment
    // re-reads process.env with the value set above — importing "./site"
    // again without resetting the module registry would just return the
    // already-evaluated (and cached) export from the first import earlier
    // in this file.
    const vitestApi = await import("vitest");
    vitestApi.vi.resetModules();
    const fresh = await import("./site");
    expect(fresh.SITE_URL).toBe("https://app.nextwise.example");
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
    vitestApi.vi.resetModules();
  });
});

/**
 * Regression guard for the CareerPath AI → NextWise rebrand
 * (docs/branding-guide.md): a fixed set of the highest-traffic
 * user-visible source files must never contain the old brand string again.
 * Deliberately NOT repo-wide — src/config/site.ts's own docblock and
 * README.md intentionally mention "CareerPath AI" once each, as history,
 * and a handful of already-applied migration/seed comments are explicitly
 * left alone per docs/branding-guide.md §4 ("do not modify old
 * migrations"). This list is the surface that actually renders to a user
 * or a generated document.
 */
const FILES_THAT_MUST_NOT_MENTION_THE_OLD_BRAND = [
  "src/components/navigation/Header.tsx",
  "src/components/navigation/Footer.tsx",
  "src/components/navigation/Logo.tsx",
  "src/components/navigation/MobileNav.tsx",
  "src/components/sections/auth/AuthLayout.tsx",
  "src/components/admin/AdminShell.tsx",
  "src/components/payments/PayButton.tsx",
  "src/components/sections/home/Hero.tsx",
  "src/components/sections/book-counselling/BookingForm.tsx",
  "src/app/(site)/layout.tsx",
  "src/app/admin/layout.tsx",
  "src/app/(site)/about/page.tsx",
  "src/app/(site)/contact/page.tsx",
  "src/app/(site)/pricing/page.tsx",
  "src/app/(site)/pricing/checkout/[slug]/page.tsx",
  "src/components/sections/pricing/PublicPricingPlanCard.tsx",
  "src/components/sections/pricing/PricingComparisonTable.tsx",
  "src/components/sections/pricing/ViewAllServicesDialog.tsx",
  "src/components/sections/home/PricingPreview.tsx",
  "src/app/(site)/parents/page.tsx",
  "src/app/(site)/careers/page.tsx",
  "src/app/(site)/how-it-works/page.tsx",
  "src/app/(site)/dashboard/page.tsx",
  "src/app/(site)/applications/page.tsx",
  "src/app/(site)/terms/page.tsx",
  "src/app/(site)/courses/[universitySlug]/[courseSlug]/page.tsx",
  "src/data/faqs.ts",
  "src/lib/payments/pdf.ts",
  "src/types/index.ts",
  "package.json",
  ".env.example",
];

// Matches "CareerPath AI", "CareerPathAI", "Career Path AI", and the
// no-space domain form "careerpathai(.example)" — any amount of
// whitespace (including none) between "career", "path", and "ai".
const OLD_BRAND_PATTERN = /career\s*path\s*ai/i;

describe("no active user-visible reference to the old brand remains", () => {
  for (const relativePath of FILES_THAT_MUST_NOT_MENTION_THE_OLD_BRAND) {
    it(`${relativePath} does not mention the old brand name`, () => {
      const fullPath = path.join(ROOT, relativePath);
      expect(existsSync(fullPath), `expected ${relativePath} to exist`).toBe(true);
      const content = readFileSync(fullPath, "utf8");
      expect(content).not.toMatch(OLD_BRAND_PATTERN);
    });
  }
});
