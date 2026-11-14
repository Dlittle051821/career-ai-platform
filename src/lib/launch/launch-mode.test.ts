import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ENTRY_PREFIXES,
  FULL_PLATFORM,
  PUBLIC_MARKETING,
  classifyPublicMarketingRequest,
  resolveLaunchMode,
} from "./launch-mode";
import { resolvePaymentLaunchMode } from "@/lib/payments/launch-mode";
import { resolveAiConfig } from "@/lib/ai/config";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const get = (p: string) => classifyPublicMarketingRequest("GET", p, new Headers());

describe("launch mode selection (fails closed)", () => {
  it.each([
    [{}, FULL_PLATFORM],
    [{ VERCEL_ENV: "preview" }, FULL_PLATFORM],
    [{ VERCEL_ENV: "production" }, PUBLIC_MARKETING],
    [{ VERCEL_ENV: "production", NEXTWISE_LAUNCH_MODE: "public-marketing" }, PUBLIC_MARKETING],
    [{ VERCEL_ENV: "production", NEXTWISE_LAUNCH_MODE: "full-platform" }, FULL_PLATFORM],
    [{ NEXTWISE_LAUNCH_MODE: "public-marketing" }, PUBLIC_MARKETING],
    [{ NEXTWISE_LAUNCH_MODE: "Full-Platform" }, PUBLIC_MARKETING],
    [{ NEXTWISE_LAUNCH_MODE: "yes" }, PUBLIC_MARKETING],
    [{ NEXTWISE_LAUNCH_MODE: " full-platform " }, FULL_PLATFORM],
  ])("%j -> %s", (env, mode) => {
    expect(resolveLaunchMode(env)).toBe(mode);
  });
});

describe("public-marketing request policy", () => {
  it.each([
    "/", "/how-it-works", "/careers", "/careers/ai-engineer", "/universities", "/universities/tu-delft",
    "/courses", "/courses/compare", "/courses/tu-delft/msc-ai", "/study-europe", "/study-options", "/abroad",
    "/career", "/career-discovery", "/compare", "/pricing", "/about", "/contact", "/parents", "/trust",
    "/privacy", "/terms", "/refund-policy", "/book-counselling", "/robots.txt", "/sitemap.xml",
    "/manifest.webmanifest", "/_next/static/chunks/app.js", "/home-v562/scene.webp", "/brand/master-v1/x.png",
    "/go/course-search/0b6d7b56-1111-4222-8333-944445555666", "/careers/", "/pricing/",
  ])("serves the public page %s", (p) => {
    expect(get(p)).toEqual({ action: "allow" });
  });

  it.each([
    "/login", "/register", "/register?next=/studio", "/forgot-password", "/reset-password", "/welcome",
    "/discovery-session/book", "/dashboard", "/recommendations", "/profile", "/profile/onboarding", "/saved",
    "/applications", "/applications/123", "/roadmap", "/payments", "/payments/1/pdf", "/pay/token",
    "/pay/token.png", "/pricing/checkout/premium", "/agreements/1", "/studio", "/studio/career",
  ])("redirects the account entry point %s to /book-counselling", (p) => {
    expect(get(p.split("?")[0])).toEqual({ action: "redirect", location: "/book-counselling" });
  });

  it.each([
    "/admin", "/admin/students", "/admin/invoices/1/receipts/2", "/counsellor", "/counsellor/students/1",
    "/api/webhooks/razorpay", "/api/webhooks/signature", "/api/webhooks/stamp", "/auth/callback",
    "/homepage-preview", "/careers/a/b", "/courses/a", "/courses/a/b/c", "/universities/a/b", "/unknown",
    "/%2e%2e/admin", "/careers/..%2fadmin", "//admin", "/admin.png", "/dashboard.png/x",
  ])("returns 404 for %s", (p) => {
    expect(get(p)).toEqual({ action: "not-found" });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])("refuses %s on public pages (no Server Actions or forms)", (m) => {
    expect(classifyPublicMarketingRequest(m, "/contact", new Headers())).toEqual({ action: "method-not-allowed" });
    expect(classifyPublicMarketingRequest(m, "/login", new Headers())).toEqual({ action: "method-not-allowed" });
    expect(classifyPublicMarketingRequest(m, "/api/webhooks/razorpay", new Headers())).toEqual({ action: "method-not-allowed" });
  });

  it("refuses a Server Action header even on GET", () => {
    expect(classifyPublicMarketingRequest("GET", "/", new Headers({ "next-action": "abc" }))).toEqual({
      action: "method-not-allowed",
    });
  });

  it("allows HEAD like GET", () => {
    expect(classifyPublicMarketingRequest("HEAD", "/", new Headers())).toEqual({ action: "allow" });
  });
});

/** Every page and route handler in the app, as a URL pattern with [param] placeholders filled. */
function appRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, url: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        const seg = name.startsWith("(") ? "" : name.startsWith("[") ? "/x" : name.startsWith("_") ? null : `/${name}`;
        if (seg !== null) walk(full, url + seg);
      } else if (name === "page.tsx" || name === "route.ts") {
        out.push(url || "/");
      }
    }
  };
  walk(path.join(ROOT, "src/app"), "");
  return out;
}

describe("every route in the app is classified on purpose", () => {
  const PUBLIC = new Set([
    "/", "/about", "/abroad", "/book-counselling", "/career", "/career-discovery", "/careers", "/careers/x",
    "/compare", "/contact", "/courses", "/courses/compare", "/courses/x/x", "/how-it-works", "/parents",
    "/pricing", "/privacy", "/refund-policy", "/study-europe", "/study-options", "/terms", "/trust",
    "/universities", "/universities/x", "/go/course-search/x", "/go/course-search/provider/x",
  ]);

  it("only the intended public routes are served", () => {
    const routes = appRoutes();
    expect(routes.length).toBeGreaterThan(100);
    const served = routes.filter((r) => get(r).action === "allow");
    expect(new Set(served)).toEqual(PUBLIC);
  });

  it("no admin, counsellor, studio or API route is served or redirected", () => {
    for (const r of appRoutes().filter((r) => /^\/(admin|counsellor|api|auth)(\/|$)/.test(r))) {
      expect(get(r), r).toEqual({ action: "not-found" });
    }
  });
});

describe("middleware and defence in depth", () => {
  const mw = read("middleware.ts");

  it("checks the launch mode before refreshing any Supabase session", () => {
    expect(mw.indexOf("isPublicMarketingMode()")).toBeGreaterThan(-1);
    expect(mw.indexOf("isPublicMarketingMode()")).toBeLessThan(mw.indexOf("return updateSession(request)"));
  });

  it("the matcher only skips image files inside public/'s own folders", () => {
    const m = mw.match(/"\/\(\(\?!(.+)\)\.\*\)"/);
    expect(m).not.toBeNull();
    const rx = new RegExp(`^/((?!${m![1].replace(/\\\\/g, "\\")}).*)$`);
    for (const p of ["/pay/abc.png", "/payments/1/receipts/2.png", "/admin/x.webp", "/careers/a.png", "/login", "/"])
      expect(rx.test(p), p).toBe(true);
    for (const p of ["/home-v54/a.webp", "/brand/master-v1/x.png", "/_next/static/a.js", "/favicon.ico"])
      expect(rx.test(p), p).toBe(false);
    const dirs = read("src/lib/launch/launch-mode.ts").match(/const STATIC_DIRS = \[([^\]]+)\]/)![1];
    const listed = [...dirs.matchAll(/"\/([^"]+)\/"/g)].map((x) => x[1]).sort();
    const inMatcher = m![1].match(/\(\?:([a-z0-9|-]+)\)\//)![1].split("|").sort();
    expect(inMatcher).toEqual(listed);
  });

  it.each([
    "src/app/admin/layout.tsx", "src/app/counsellor/layout.tsx", "src/app/dashboard/layout.tsx",
    "src/app/profile/layout.tsx", "src/app/recommendations/layout.tsx", "src/app/studio/layout.tsx",
    "src/app/(site)/agreements/layout.tsx", "src/app/(site)/applications/layout.tsx",
    "src/app/(site)/discovery-session/layout.tsx", "src/app/(site)/payments/layout.tsx",
    "src/app/(site)/pricing/checkout/layout.tsx",
  ])("%s returns 404 in public-marketing mode", (f) => {
    expect(read(f)).toContain("notFoundInPublicMarketingMode();");
  });

  it("the public site layout hides the registration prompt in public-marketing mode", () => {
    expect(read("src/app/(site)/layout.tsx")).toContain("{launchMode === FULL_PLATFORM ? <RegistrationPrompt /> : null}");
  });

  it("the browser never starts Supabase Auth in public-marketing mode", () => {
    const hook = read("src/lib/supabase/use-auth-profile.ts");
    expect(hook).toMatch(/if \(!accountsOpen\) return;\n\s+let cancelled = false;/);
  });
});

describe("payments and AI are forced off in public-marketing mode", () => {
  const ALL_ON = {
    NEXTWISE_PAID_CHECKOUT: "enabled",
    NEXTWISE_PAID_CHECKOUT_PREREQUISITES: "CC19-CC20-APPROVED",
    RAZORPAY_KEY_ID: "rzp_test_x",
    RAZORPAY_KEY_SECRET: "y",
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    AI_OPENAI_MODEL: "gpt-test",
    AI_OPENAI_APPROVED: "true",
    GEMINI_API_KEY: "g",
  };

  it("payments stay off even with every payment variable set", () => {
    expect(resolvePaymentLaunchMode({ ...ALL_ON, VERCEL_ENV: "production" })).toEqual({
      paidCheckoutEnabled: false,
      blockReason: "public_marketing_launch",
    });
    expect(resolvePaymentLaunchMode({ ...ALL_ON, NEXTWISE_LAUNCH_MODE: "public-marketing" }).paidCheckoutEnabled).toBe(false);
  });

  it("AI stays off even with OpenAI approved", () => {
    expect(resolveAiConfig({ ...ALL_ON, VERCEL_ENV: "production" }).mode).toBe("disabled");
    expect(resolveAiConfig({ ...ALL_ON, AI_PROVIDER: "gemini", NEXTWISE_LAUNCH_MODE: "public-marketing" }).mode).toBe("disabled");
  });

  it("the switches still work in full-platform mode (unchanged behaviour)", () => {
    expect(resolvePaymentLaunchMode({ ...ALL_ON, NEXTWISE_LAUNCH_MODE: "full-platform" }).paidCheckoutEnabled).toBe(true);
    expect(resolveAiConfig({ ...ALL_ON, NEXTWISE_LAUNCH_MODE: "full-platform" }).mode).toBe("openai");
  });

  it("account entry list covers every protected path in the session middleware", () => {
    const src = read("src/lib/supabase/middleware.ts");
    const protectedList = src.match(/const PROTECTED_PATHS = \[([\s\S]*?)\];/)![1];
    const paths = [...protectedList.matchAll(/"(\/[^"]+)"/g)].map((x) => x[1]);
    for (const p of paths) {
      const d = get(p);
      expect(d.action === "redirect" || d.action === "not-found", p).toBe(true);
    }
    expect(ACCOUNT_ENTRY_PREFIXES).toContain("/login");
  });
});
