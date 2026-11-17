import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG, PLAN_CAPABILITIES, planHasCapability, plansWithCapability } from "@/config/plan-capabilities";
import { UNIVERSITY_DIRECTORY_PLAN_SLUGS, canUseInternalCourseDatabase, canUseUniversityDirectory, resolveUniversityAccess } from "@/lib/education/university-discovery/access";
import { NEXTWISE_VERIFIED } from "@/lib/payments/checkout-charge-guard";
import { PR01_ACTIVE_CATALOG, PR01_RETIRED_SLUGS } from "@/lib/pricing/pr01-catalog";
import { canViewCareerIntelligence, careerIntelligenceAccessHref, resolveCareerIntelligenceAccess, type CareerIntelligenceAccessState } from "./access";

const SRC = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const student = (statuses: (string | null)[], extra: object = {}) => resolveCareerIntelligenceAccess({ isSignedIn: true, isStaff: false, qualifyingInvoiceStatuses: statuses, ...extra });

describe("Career Intelligence — plan capability mapping", () => {
  it("every plan in the active catalogue is listed explicitly, and nothing else is", () => {
    expect(Object.keys(PLAN_CAPABILITIES).sort()).toEqual(PR01_ACTIVE_CATALOG.map((p) => p.slug).sort());
  });

  it("the free plan and every plan that costs nothing unlock nothing", () => {
    for (const plan of PR01_ACTIVE_CATALOG.filter((p) => p.amountMinorUnits === 0)) expect(planHasCapability(plan.slug, "career_intelligence"), plan.slug).toBe(false);
    expect(planHasCapability("nextwise-explore", "career_intelligence")).toBe(false);
  });

  it("Nextwise Verified at ₹1,999 is the minimum qualifying plan", () => {
    expect(CAREER_INTELLIGENCE_MINIMUM_PLAN_SLUG).toBe(NEXTWISE_VERIFIED.slug);
    expect(NEXTWISE_VERIFIED.payableMinorUnits).toBe(199_900);
    const qualifying = PR01_ACTIVE_CATALOG.filter((p) => planHasCapability(p.slug, "career_intelligence"));
    expect(Math.min(...qualifying.map((p) => p.amountMinorUnits))).toBe(199_900);
    expect(qualifying.map((p) => p.slug)).toEqual(plansWithCapability("career_intelligence"));
  });

  it("matches by exact slug only: names, look-alikes, retired and unknown plans get nothing", () => {
    for (const slug of ["Nextwise Verified", "nextwise-verified-plus", "verified", "NEXTWISE-VERIFIED", "", "__proto__", "constructor", ...PR01_RETIRED_SLUGS]) {
      expect(planHasCapability(slug, "career_intelligence"), slug).toBe(false);
    }
    expect(planHasCapability(null, "career_intelligence")).toBe(false);
    expect(planHasCapability(undefined, "career_intelligence")).toBe(false);
  });
});

describe("Career Intelligence — access matrix", () => {
  const cases: [string, CareerIntelligenceAccessState, boolean][] = [
    ["paid", "active", true],
    ["issued", "payment_pending", false],
    ["partially_paid", "payment_pending", false],
    ["overdue", "payment_pending", false],
    ["draft", "free", false],
    ["void", "revoked", false],
    ["refunded", "revoked", false],
    ["partially_refunded", "revoked", false],
    ["some-future-status", "free", false],
  ];
  it.each(cases)("a qualifying purchase whose invoice is %s → %s", (status, state, allowed) => {
    expect(student([status])).toBe(state);
    expect(canViewCareerIntelligence(student([status]))).toBe(allowed);
  });

  it("anonymous visitors and students with no qualifying purchase have no access", () => {
    expect(resolveCareerIntelligenceAccess({ isSignedIn: false, isStaff: false, qualifyingInvoiceStatuses: ["paid"] })).toBe("anonymous");
    expect(student([])).toBe("free");
    expect(canViewCareerIntelligence("anonymous")).toBe(false);
    expect(canViewCareerIntelligence("free")).toBe(false);
  });

  it("a purchase with no invoice never grants access", () => {
    expect(student([null])).toBe("free");
    expect(student([null, "issued"])).toBe("payment_pending");
  });

  it("one confirmed payment is enough, whatever else is on the account", () => {
    expect(student(["refunded", "issued", "paid"])).toBe("active");
  });

  it("a refund after payment removes access (the invoice is no longer paid)", () => {
    expect(student(["refunded"])).toBe("revoked");
    expect(canViewCareerIntelligence(student(["refunded"]))).toBe(false);
  });

  it("a time-limited access period that has ended blocks results; an unreadable end date fails closed", () => {
    const now = Date.parse("2026-11-17T00:00:00Z");
    expect(student(["paid"], { accessEndsAt: "2026-11-16T00:00:00Z", now })).toBe("expired");
    expect(student(["paid"], { accessEndsAt: "2027-01-01T00:00:00Z", now })).toBe("active");
    expect(student(["paid"], { accessEndsAt: "not-a-date", now })).toBe("expired");
    expect(canViewCareerIntelligence("expired")).toBe(false);
  });

  it("staff access comes from the role, with or without purchases, and a student is never staff", () => {
    expect(resolveCareerIntelligenceAccess({ isSignedIn: true, isStaff: true, qualifyingInvoiceStatuses: [] })).toBe("staff");
    expect(canViewCareerIntelligence("staff")).toBe(true);
    expect(student(["paid"])).not.toBe("staff");
    expect(resolveCareerIntelligenceAccess({ isSignedIn: false, isStaff: true, qualifyingInvoiceStatuses: [] })).toBe("anonymous");
  });

  it("only active and staff can view; every other state cannot", () => {
    const all: CareerIntelligenceAccessState[] = ["anonymous", "free", "payment_pending", "active", "expired", "revoked", "staff"];
    expect(all.filter(canViewCareerIntelligence)).toEqual(["active", "staff"]);
  });

  it("the upgrade link carries a fixed label, never a URL", () => {
    expect(careerIntelligenceAccessHref("recommendations")).toBe("/career/access?from=recommendations");
    expect(careerIntelligenceAccessHref()).toBe("/career/access");
  });
});

describe("Career Intelligence — one resolver, enforced on the server", () => {
  const resolver = code("lib/supabase/career-intelligence-access.ts");

  it("the resolver is server-only, reads live tables as the student and fails closed", () => {
    expect(read("lib/supabase/career-intelligence-access.ts")).toMatch(/^import "server-only";/);
    for (const needle of ['from("pricing_plans")', 'from("pricing_purchases")', 'from("invoices")', ".eq(\"student_user_id\", user.id)", "getCurrentAdmin()", 'plansWithCapability("career_intelligence")']) {
      expect(resolver).toContain(needle);
    }
    expect(resolver).not.toMatch(/service-role|SERVICE_ROLE|user_metadata|app_metadata|localStorage|cookies\(/);
    expect(resolver).not.toMatch(/plan_name|ilike|includes\("verified"\)|toLowerCase/);
    expect(resolver.match(/return free\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("personalised matches are only ever scored behind the resolver", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) {
          const src = readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
          if (/getRecommendations\(/.test(src) && !/requireCareerIntelligence\(|canAccessCareerIntelligence\(/.test(src)) offenders.push(path.relative(SRC, full));
        }
      }
    };
    walk(path.join(SRC, "app"));
    walk(path.join(SRC, "components"));
    expect(offenders).toEqual([]);
  });

  it("/recommendations checks access before the career library is loaded or anything is scored", () => {
    const page = code("app/recommendations/page.tsx");
    const gate = page.indexOf('await requireCareerIntelligence("recommendations")');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(page.indexOf("await getCareersForMatching()"));
    expect(gate).toBeLessThan(page.indexOf("getRecommendations(snapshot, careers)"));
    // the free part comes first: an unfinished profile is asked to continue, not to pay
    expect(page.indexOf("if (!hasProfileData)")).toBeLessThan(gate);
  });

  it.each(["app/dashboard/page.tsx", "app/studio/page.tsx"])("%s scores matches only when the server has confirmed access", (rel) => {
    const page = code(rel);
    expect(page).toContain("const careerIntelligenceUnlocked = await canAccessCareerIntelligence();");
    expect(page).toMatch(/hasProfileDataForRecommendations && careerIntelligenceUnlocked\s*\?\s*\(await getRecommendations\(/);
  });

  it("the comparison's personal fit uses the same resolver", () => {
    const page = code("app/(site)/compare/page.tsx");
    expect(page).toContain("if (await canAccessCareerIntelligence())");
    expect(page).not.toContain("getMyProductEntitlements");
  });

  it("personalised reports are gated on the page and again in the data layer", () => {
    for (const rel of ["app/studio/recommendation-reports/page.tsx", "app/studio/recommendation-reports/[id]/page.tsx"]) {
      expect(code(rel), rel).toContain('await requireCareerIntelligence("report")');
    }
    const lib = code("lib/supabase/education/recommendation-reports.ts");
    const fn = lib.slice(lib.indexOf("export async function getMyRecommendationReportContent"));
    expect(fn.indexOf("if (!(await canAccessCareerIntelligence())) return null;")).toBeGreaterThan(-1);
    expect(fn.indexOf("canAccessCareerIntelligence")).toBeLessThan(fn.indexOf("supabase"));
  });

  it("the assessment itself has no paywall: profile and onboarding never ask the resolver", () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(name)) out.push(full);
      }
      return out;
    };
    const files = [...walk(path.join(SRC, "app/(site)/profile")), ...walk(path.join(SRC, "components/sections/profile")), path.join(SRC, "lib/supabase/student-profile-actions.ts")];
    for (const f of files) expect(readFileSync(f, "utf8"), path.relative(SRC, f)).not.toMatch(/CareerIntelligence|career\/access|getMyProductEntitlements/);
  });

  it("no personalised output is computed in a client component or exposed through an API route", () => {
    for (const rel of ["components/dashboard/RecommendedForYou.tsx", "app/(site)/career/access/page.tsx"]) expect(code(rel), rel).not.toMatch(/getRecommendations\(|getCareersForMatching\(/);
    expect(existsSync(path.join(SRC, "app/api/recommendations"))).toBe(false);
    expect(existsSync(path.join(SRC, "app/api/career-intelligence"))).toBe(false);
  });
});

describe("Career Intelligence — upgrade screen", () => {
  const page = code("app/(site)/career/access/page.tsx");

  it("uses the approved heading and copy, shows the assessment status and both actions", () => {
    for (const needle of [
      "Your career profile is ready. Unlock your Career Intelligence.",
      "You've completed the assessment. Your answers are saved.",
      "Assessment completed",
      "Your answers are saved",
      "Return to Student Studio",
      "GST included",
    ]) expect(page).toContain(needle);
  });

  it("shows ₹1,999 from the one approved constant and lists other plans from the live catalogue by capability", () => {
    expect(page).toContain("NEXTWISE_VERIFIED.payableMinorUnits");
    expect(page).toContain("listPublicPricingPlans()");
    expect(page).toContain('planHasCapability(p.plan.slug, "career_intelligence")');
    expect(page).not.toMatch(/199(?!_?9)/);
  });

  it("grants nothing and charges nothing: no checkout call, no entitlement write, payment only when switched on", () => {
    expect(page).toContain("arePaidFeaturesForcedOff");
    expect(page).not.toMatch(/purchasePricingPlan|razorpay|createOrder|\.insert\(|\.update\(|"use server"|onClick/i);
  });

  it("carries no personalised preview, score, urgency or guarantee", () => {
    expect(page).not.toMatch(/getRecommendations|matchBand|\d+\s?%|blur|limited time|only today|hurry|guaranteed (admission|job|placement)/i);
  });

  it("never asks a student with access to buy again", () => {
    expect(page).toMatch(/\{unlocked \? \(\s*<Link href=\{RESULTS_HREF\}/);
  });
});

describe("University Discovery V3 — access rules unchanged by Career Intelligence", () => {
  it("the directory plans and tiers are exactly as V3 defined them", () => {
    expect([...UNIVERSITY_DIRECTORY_PLAN_SLUGS]).toEqual(["nextwise-verified", "nextwise-essential"]);
    expect(resolveUniversityAccess({ isSignedIn: true, isAdmin: false, qualifyingInvoiceStatuses: ["paid"] })).toBe("verified");
    expect(resolveUniversityAccess({ isSignedIn: true, isAdmin: false, qualifyingInvoiceStatuses: ["issued"] })).toBe("payment_pending");
    expect(resolveUniversityAccess({ isSignedIn: true, isAdmin: false, qualifyingInvoiceStatuses: [], hasActiveGrant: true })).toBe("verified_by_grant");
    expect(canUseUniversityDirectory("signed_in_free")).toBe(false);
    expect(canUseInternalCourseDatabase("verified")).toBe(false);
  });

  it("Career Intelligence does not read or write the university grant table, and V3's resolver does not read Career Intelligence", () => {
    expect(code("lib/supabase/career-intelligence-access.ts")).not.toContain("university_access_grants");
    expect(code("lib/supabase/education/university-access.ts")).not.toMatch(/career-intelligence|plan-capabilities/);
  });
});
