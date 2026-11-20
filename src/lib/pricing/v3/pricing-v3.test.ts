import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planHasCapability } from "@/config/plan-capabilities";
import { ABROAD_PRICING_CATEGORIES } from "@/lib/products/entitlements";
import { PRICING_CATEGORIES } from "@/types/pricing";
import { V3_COMPARISON, V3_FAQS } from "./content";
import { ADDITIONAL_UNIVERSITIES_HARD_CEILING, V3_PLAN_ORDER, computePackageQuote, formatInr, isV3PlanSlug, maxAdditional, parseAdditionalUniversities, type UniversityAddonTerms } from "./quote";

const SRC = path.resolve(import.meta.dirname, "../../..");
const ROOT = path.resolve(SRC, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MIGRATION = read("supabase/migrations-proposed/NW_PRICING_V3/0001_three_plan_catalogue.sql");

// the catalogue values the migration publishes (asserted against the SQL below)
const LITE = { base: 4_499_900, addon: { includedQuantity: 5, unitAmountMinorUnits: 799_900, currency: "INR", maxAdditionalQuantity: null } satisfies UniversityAddonTerms };
const PREMIUM = { base: 7_499_900, addon: { includedQuantity: 10, unitAmountMinorUnits: 799_900, currency: "INR", maxAdditionalQuantity: null } satisfies UniversityAddonTerms };
const quote = (p: typeof LITE, n: number) => {
  const r = computePackageQuote({ baseAmountMinorUnits: p.base, currency: "INR", addon: p.addon, additionalUniversities: n });
  if (!r.ok) throw new Error(r.reason);
  return r.quote;
};

describe("NW-PRICING-V3 — calculator acceptance examples", () => {
  it.each([
    ["Lite default", LITE, 0, 5, "₹44,999"],
    ["Lite +1", LITE, 1, 6, "₹52,998"],
    ["Lite +3", LITE, 3, 8, "₹68,996"],
    ["Premium default", PREMIUM, 0, 10, "₹74,999"],
    ["Premium +1", PREMIUM, 1, 11, "₹82,998"],
    ["Premium +3", PREMIUM, 3, 13, "₹98,996"],
  ] as const)("%s: %i extra → %i universities, %s", (_n, plan, extra, universities, total) => {
    const q = quote(plan, extra);
    expect(q.totalUniversities).toBe(universities);
    expect(formatInr(q.totalAmountMinorUnits)).toBe(total);
  });

  it("the +3 breakdown is exact: ₹23,997 of additional universities, in paise", () => {
    const q = quote(LITE, 3);
    expect(q.addonAmountMinorUnits).toBe(2_399_700);
    expect(q.totalAmountMinorUnits).toBe(6_899_600);
    expect(quote(PREMIUM, 3).totalAmountMinorUnits).toBe(9_899_600);
  });

  it("removing universities recalculates back down", () => {
    expect(quote(LITE, 2).totalAmountMinorUnits).toBe(quote(LITE, 3).totalAmountMinorUnits - 799_900);
    expect(quote(LITE, 0)).toEqual(quote(LITE, 0));
  });

  it("never negative, never fractional, never over the ceiling or the configured limit", () => {
    for (const bad of [-1, 1.5, Number.NaN, Infinity, "-1", "1.5", "1e2", "", " ", "abc", null, undefined, {}, [], "999999", ADDITIONAL_UNIVERSITIES_HARD_CEILING + 1]) {
      expect(parseAdditionalUniversities(bad), String(bad)).toBeNull();
    }
    expect(parseAdditionalUniversities("3")).toBe(3);
    expect(parseAdditionalUniversities(0)).toBe(0);
    expect(computePackageQuote({ baseAmountMinorUnits: LITE.base, currency: "INR", addon: LITE.addon, additionalUniversities: -1 })).toEqual({ ok: false, reason: "invalid_quantity" });
    const limited = { ...LITE.addon, maxAdditionalQuantity: 2 };
    expect(maxAdditional(limited)).toBe(2);
    expect(computePackageQuote({ baseAmountMinorUnits: LITE.base, currency: "INR", addon: limited, additionalUniversities: 3 })).toEqual({ ok: false, reason: "over_limit" });
  });

  it("Verified has no university add-on: extra universities are refused", () => {
    expect(computePackageQuote({ baseAmountMinorUnits: 199_900, currency: "INR", addon: null, additionalUniversities: 1 })).toEqual({ ok: false, reason: "addon_not_available" });
    const r = computePackageQuote({ baseAmountMinorUnits: 199_900, currency: "INR", addon: null, additionalUniversities: 0 });
    expect(r.ok && formatInr(r.quote.totalAmountMinorUnits)).toBe("₹1,999");
  });

  it("a malformed catalogue is refused rather than priced", () => {
    expect(computePackageQuote({ baseAmountMinorUnits: 1.5, currency: "INR", addon: null, additionalUniversities: 0 }).ok).toBe(false);
    expect(computePackageQuote({ baseAmountMinorUnits: 100, currency: "inr", addon: null, additionalUniversities: 0 }).ok).toBe(false);
    expect(computePackageQuote({ baseAmountMinorUnits: 100, currency: "INR", addon: { ...LITE.addon, currency: "USD" }, additionalUniversities: 1 }).ok).toBe(false);
  });
});

describe("NW-PRICING-V3 — catalogue migration (proposed SQL)", () => {
  it("publishes exactly the three plans at the approved prices and add-on terms", () => {
    expect(V3_PLAN_ORDER).toEqual(["nextwise-verified", "study-abroad-lite", "study-abroad-premium"]);
    expect(MIGRATION).toMatch(/'nextwise-verified', 'school_counselling', 'Nextwise Verified'[\s\S]*?199900/);
    expect(MIGRATION).toMatch(/'study-abroad-lite', 'study_abroad'[\s\S]*?'Nextwise Study Abroad Lite'[\s\S]*?4499900[\s\S]*?\]'::jsonb, 5, 799900\)/);
    expect(MIGRATION).toMatch(/'study-abroad-premium', 'study_abroad'[\s\S]*?'Nextwise Study Abroad Premium'[\s\S]*?7499900[\s\S]*?\]'::jsonb, 10, 799900\)/);
    expect(MIGRATION).toMatch(/Nextwise Verified[\s\S]*?\]'::jsonb, null, null\)/);
    expect(MIGRATION).not.toMatch(/359900|3599/);
  });

  it("retires other plans instead of deleting anything", () => {
    expect(MIGRATION).toContain("update public.pricing_plans set is_active = false");
    expect(MIGRATION).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
    expect(MIGRATION).toMatch(/^begin;/m);
    expect(MIGRATION).toMatch(/^commit;/m);
    expect(MIGRATION).toMatch(/raise exception 'NW-PRICING-V3 check failed: % active plans, expected 3'/);
  });

  it("keeps purchasers able to resolve the plan and version they bought after retirement", () => {
    expect(MIGRATION).toContain('create policy "Students can read plans they purchased"');
    expect(MIGRATION).toContain('create policy "Students can read plan versions they purchased"');
    expect(MIGRATION).toMatch(/pp\.student_user_id = auth\.uid\(\)/);
  });

  it("the database recomputes every quote; the caller supplies only a slug and a count", () => {
    expect(MIGRATION).toMatch(/create or replace function public\.create_pricing_quote\(p_plan_slug text, p_additional_universities integer default 0\)/);
    expect(MIGRATION).toContain("v_addon_amount := v_extra::bigint * v_addon.unit_amount_minor_units;");
    expect(MIGRATION).toContain("revoke all on function public.create_pricing_quote(text, integer) from public, anon;");
    expect(MIGRATION).toContain("pg_advisory_xact_lock");
    expect(MIGRATION).toContain("pricing_quotes_one_open_per_student");
    expect(MIGRATION).toMatch(/total_amount_minor_units = base_amount_minor_units \+ addon_amount_minor_units/);
  });

  it("a rollback exists and restores from the snapshot without deleting", () => {
    const rb = read("supabase/migrations-proposed/NW_PRICING_V3/0001_three_plan_catalogue_ROLLBACK.sql");
    expect(rb).toContain("from public.pricing_v3_catalogue_snapshot s");
    expect(rb).not.toMatch(/\bdelete\s+from\b|\bdrop\s+table\b/i);
  });
});

describe("NW-PRICING-V3 — entitlements", () => {
  it("Verified keeps Career Intelligence; Lite and Premium include it; retired plans keep theirs", () => {
    for (const slug of ["nextwise-verified", "study-abroad-lite", "study-abroad-premium", "nextwise-essential", "bachelor-abroad-plus", "master-abroad-plus", "bachelor-abroad-premium", "master-abroad-premium"]) {
      expect(planHasCapability(slug, "career_intelligence"), slug).toBe(true);
    }
    expect(planHasCapability("nextwise-explore", "career_intelligence")).toBe(false);
  });

  it("the new category counts as the Abroad product", () => {
    expect(PRICING_CATEGORIES).toContain("study_abroad");
    expect(ABROAD_PRICING_CATEGORIES).toContain("study_abroad");
  });
});

describe("NW-PRICING-V3 — the browser is never the pricing authority", () => {
  const action = code("src/app/(site)/pricing/actions.ts");

  it("the quote action takes a slug and a count, re-reads the catalogue, and checks the database's own figure", () => {
    expect(action).toMatch(/^"use server";/);
    expect(action).toContain("export async function quotePackage(planSlugRaw: unknown, additionalRaw: unknown, saveRaw: unknown = false)");
    expect(action).toContain("isV3PlanSlug(planSlugRaw)");
    expect(action).toContain("parseAdditionalUniversities(additionalRaw)");
    expect(action).toContain("await getV3Plan(planSlugRaw)");
    expect(action).toContain('supabase.rpc("create_pricing_quote"');
    expect(action).toMatch(/Number\(saved\.totalAmountMinorUnits\) !== result\.quote\.totalAmountMinorUnits/);
    expect(action).not.toMatch(/amountMinorUnits\s*:\s*(raw|input|body)/i);
  });

  it("no new pricing code creates invoices, purchases or entitlements, or calls the payment provider", () => {
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [path.join(d, n)] : []));
    const dirs = ["src/components/pricing-v3", "src/lib/pricing/v3"].map((d) => path.join(ROOT, d));
    const files = [path.join(ROOT, "src/app/(site)/pricing/actions.ts"), ...dirs.flatMap(walk)];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/purchase_pricing_plan|purchasePricingPlan|razorpay|createOrder|from\("invoices"\)|from\("pricing_purchases"\)|\.insert\(|\.update\(|Pay now/i);
  });

  it("checkout is offered only when online payment is open and there are no add-ons (purchase_pricing_plan has no add-on support)", () => {
    const ui = code("src/components/pricing-v3/PricingV3.tsx");
    expect(ui).toContain("const checkoutAllowed = purchasesOpen && extra === 0;");
    expect(ui).toContain("Continue with a Nextwise counsellor");
    expect(code("src/lib/career-intelligence/plans.ts")).toContain("!arePaidFeaturesForcedOff() && isPaidCheckoutEnabled()");
  });

  it("prices on the page come from the catalogue, not from component code", () => {
    for (const rel of ["src/components/pricing-v3/PricingV3.tsx", "src/components/pricing-v3/PricingV3Page.tsx", "src/lib/pricing/v3/content.ts"]) {
      expect(code(rel), rel).not.toMatch(/₹\s?\d|199900|4499900|7499900|799900|1,999|44,999|74,999|7,999/);
    }
  });

  it("the page falls back to the existing catalogue until the migration is applied", () => {
    const page = code("src/app/(site)/pricing/page.tsx");
    expect(page).toContain("if (v3.available)");
    expect(page).toContain("return <LegacyPricingPage />;");
    expect(code("src/lib/pricing/v3/catalogue.ts")).toContain("return { available: false, plans: [] };");
  });
});

describe("NW-PRICING-V3 — content", () => {
  it("every comparison row covers all three plans, and Verified offers no applications", () => {
    for (const g of V3_COMPARISON) for (const r of g.rows) expect(Object.keys(r.cells).sort()).toEqual([...V3_PLAN_ORDER].sort());
    const apps = V3_COMPARISON.flatMap((g) => g.rows).find((r) => r.label === "University application assistance")!;
    expect(apps.cells["nextwise-verified"]).toBe(false);
    expect(apps.cells["study-abroad-lite"]).toBe("Up to 5 universities");
    expect(apps.cells["study-abroad-premium"]).toBe("Up to 10 universities");
  });

  it("covers the required FAQs without inventing refund or credit rules", () => {
    const qs = V3_FAQS.map((f) => f.question).join("|");
    for (const q of ["Which plan should I choose?", "Can I add more universities later?", "Does Nextwise Verified include application assistance?", "Are application and visa fees included?", "What happens after I choose a package?", "Can I upgrade later?", "earlier Nextwise plan"]) expect(qs).toContain(q);
    expect(JSON.stringify(V3_FAQS)).not.toMatch(/refund|credit of|discount/i);
  });

  it("only known slugs are accepted", () => {
    for (const s of ["nextwise-verified", "study-abroad-lite", "study-abroad-premium"]) expect(isV3PlanSlug(s)).toBe(true);
    for (const s of ["nextwise-essential", "bachelor-abroad-plus", "", "__proto__", 1, null]) expect(isV3PlanSlug(s)).toBe(false);
  });
});

describe("NW-PRICING-V3.1 — visual refinement keeps the business rules", () => {
  const ui = () => code("src/components/pricing-v3/PricingV3.tsx");
  const page = () => code("src/components/pricing-v3/PricingV3Page.tsx");
  const css = () => code("src/styles/pricing-v3.css");

  it("the introductory hero is gone: the packages start under the navigation", () => {
    expect(page()).not.toMatch(/pv3-hero|The right guidance\. At the right stage\./);
    expect(page()).toContain('<h1 className="sr">');
    expect(css()).not.toMatch(/\.pv3-hero\b/);
    expect(css()).not.toMatch(/body:has\(\.pv3\) header/);
  });

  it("phones and tablets get a three-price overview that selects a package", () => {
    expect(ui()).toContain('aria-label="Choose a package"');
    expect(ui()).toContain("pickFromOverview");
    expect(css()).toMatch(/@media \(max-width:1060px\)\{\s*\.pv3 \.pv3-overview\{display:block/);
  });

  it("animated prices never write an in-between amount into state, and respect reduced motion", () => {
    expect(ui()).toContain("data-amount={minor}");
    expect(ui()).toMatch(/<span className="sr">\{formatInr\(minor\)\}<\/span>/);
    expect(ui()).toContain('reducedMotion() ? 0 : PRICE_TWEEN_MS');
    expect(css()).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses the site's real coral token and changes no shared token", () => {
    expect(css()).toContain("--action:#FF4D6D");
    expect(css()).not.toMatch(/(^|\n)\s*:root\s*\{/);
  });

  it("the quote logic, server check and checkout guard are untouched", () => {
    expect(ui()).toContain("computePackageQuote");
    expect(ui()).toContain("quotePackage(selected, extra, false)");
    expect(ui()).toContain("const checkoutAllowed = purchasesOpen && extra === 0;");
  });
});
