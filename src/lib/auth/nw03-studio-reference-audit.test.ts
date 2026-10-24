import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * NW03.6 — regression/security audit for the NW03 "Two-Product
 * Architecture" routing and auth changes (NW03.2-NW03.4), mirroring the
 * established "static source-text audit, no React rendering" convention
 * already used throughout this codebase (see e.g.
 * src/lib/profile/profile-reference-audit.test.ts,
 * src/lib/dashboard/dashboard-reference-audit.test.ts).
 */

const ROOT = path.resolve(__dirname, "../../..");

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("NW03.6 audit — /studio is a real, auth-protected route, exactly once each", () => {
  it("middleware protects /studio (and, via the existing prefix match, every route beneath it)", () => {
    const content = read("src/lib/supabase/middleware.ts");
    expect(content).toMatch(/PROTECTED_PATHS\s*=\s*\[[\s\S]*?"\/studio"[\s\S]*?\]/);
  });

  it("exactly one page resolves to each of /studio, /studio/career, /studio/abroad", () => {
    expect(existsSync(path.join(ROOT, "src/app/studio/page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src/app/studio/career/page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src/app/studio/abroad/page.tsx"))).toBe(true);
    // No collision with any pre-existing (site) route of the same name.
    expect(existsSync(path.join(ROOT, "src/app/(site)/studio/page.tsx"))).toBe(false);
  });

  it("/studio shares the real DashboardShell, not a new/competing shell", () => {
    const content = read("src/app/studio/layout.tsx");
    expect(content).toContain("DashboardShell");
    expect(content).not.toMatch(/function\s+\w*Sidebar/);
  });
});

describe("NW03.6 audit — /studio/career reuses /dashboard, never forks it", () => {
  it("redirects to the real, existing /dashboard rather than duplicating its data-fetching", () => {
    const content = read("src/app/studio/career/page.tsx");
    expect(content).toMatch(/redirect\(\s*["']\/dashboard["']\s*\)/);
    // A fork would start pulling in the dashboard's own real data sources
    // directly into this page — it should do none of that; it only redirects.
    expect(content).not.toContain("getCurrentProfile");
    expect(content).not.toContain("listMyPurchases");
  });
});

describe("NW03.6 audit — /studio/abroad never fabricates Abroad progress/application data", () => {
  it("uses the existing honest-placeholder primitives for not-yet-built features", () => {
    const content = read("src/app/studio/abroad/page.tsx");
    expect(content).toContain("ComingSoon");
    expect(content).toContain("DemoNotice");
  });

  it("links to the real Country Explorer and course search rather than re-implementing them", () => {
    const content = read("src/app/studio/abroad/page.tsx");
    expect(content).toContain('"/study-europe"');
    expect(content).toContain('"/courses"');
  });
});

describe("NW03.6 audit — AC-04: Abroad signup must never be forced through Career onboarding", () => {
  it("RegisterForm routes its post-signup redirect through the shared safe-redirect validator, not a hardcoded /welcome", () => {
    const content = read("src/components/sections/auth/RegisterForm.tsx");
    expect(content).toContain("getSafeRedirectPath(searchParams.get(\"next\"), \"/welcome\")");
    expect(content).toMatch(/router\.push\(\s*safeNext\s*\)/);
    // The old, unconditional hardcode must be gone from the actual redirect call.
    expect(content).not.toMatch(/router\.push\(\s*["']\/welcome["']\s*\)/);
  });

  it("RegisterForm's emailRedirectTo also carries the real next destination, not a hardcoded ?next=/welcome", () => {
    const content = read("src/components/sections/auth/RegisterForm.tsx");
    expect(content).not.toContain("/auth/callback?next=/welcome");
    expect(content).toMatch(/\/auth\/callback\?next=\$\{encodeURIComponent\(safeNext\)\}/);
  });

  it("the auth callback route already applies the same shared validator to `next` (no change needed there)", () => {
    const content = read("src/app/auth/callback/route.ts");
    expect(content).toContain("getSafeRedirectPath");
  });
});

describe("NW03.6 audit — the NW02 6-country Abroad allowlist is reused, never re-typed", () => {
  it("/abroad imports EUROPE_COUNTRIES rather than defining its own country list", () => {
    const content = read("src/app/(site)/abroad/page.tsx");
    expect(content).toContain('from "@/data/europe-explorer"');
    expect(content).toContain("EUROPE_COUNTRIES.map");
  });

  it("the underlying launch-country registry is still exactly the 7 approved destinations", () => {
    const content = read("src/lib/education/external-search/launch-countries.ts");
    expect(content).toMatch(/LAUNCH_COUNTRY_CODES\s*=\s*\[\s*"IN",\s*"DE",\s*"IE",\s*"NL",\s*"FR",\s*"SE",\s*"DK"\s*\]/);
  });
});

describe("NW03.6 audit — DashboardShell nav gained Studio without losing any pre-existing item", () => {
  it("every pre-NW03 nav item is still present", () => {
    const content = read("src/components/dashboard/DashboardShell.tsx");
    for (const href of ["/dashboard", "/profile", "/recommendations", "/saved", "/applications", "/discovery-session/book", "/payments"]) {
      expect(content, `expected DashboardShell to still link to ${href}`).toContain(`href: "${href}"`);
    }
  });

  it("Studio is the new entry point back to the shared hub", () => {
    const content = read("src/components/dashboard/DashboardShell.tsx");
    expect(content).toMatch(/label:\s*"Studio",\s*href:\s*"\/studio"/);
  });
});

describe("NW03.6 audit — entitlements are informational only, never a gate", () => {
  it("the Studio hub shows entitlement badges but never conditions the workspace links on them", () => {
    const content = read("src/app/studio/page.tsx");
    expect(content).toContain("getMyProductEntitlements");
    // Both workspace links must be unconditional <Link> elements, not wrapped
    // in an entitlement check.
    expect(content).toMatch(/<Link href="\/studio\/career"/);
    expect(content).toMatch(/<Link href="\/studio\/abroad"/);
  });
});
