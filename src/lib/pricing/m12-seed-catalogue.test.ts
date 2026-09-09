import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for supabase/seed/0007_m12_current_pricing_catalogue_seed.sql
 * — a static check against the actual seed SQL text, not a live Postgres
 * connection (this project has no database in its Vitest setup), mirroring
 * the same convention used by src/lib/stamping/migration-security.test.ts
 * and src/lib/signatures/migration-security.test.ts. What this test DOES
 * catch: someone accidentally adding a ninth plan, changing a price,
 * dropping an idempotency guard, or sneaking in an offer without touching
 * this file. It is a text-level invariant check, not a substitute for
 * running the verification query at the bottom of the seed file against a
 * real database after applying it.
 */

const SEED_PATH = path.resolve(process.cwd(), "supabase/seed/0007_m12_current_pricing_catalogue_seed.sql");
const sql = readFileSync(SEED_PATH, "utf8");

const OFFICIAL_SLUGS = [
  "launch-essential",
  "launch-pro",
  "bachelor-abroad-essential",
  "bachelor-abroad-plus",
  "bachelor-abroad-premium",
  "master-abroad-essential",
  "master-abroad-plus",
  "master-abroad-premium",
];

const OFFICIAL_PRICES_MINOR_UNITS: Record<string, number> = {
  "launch-essential": 500000,
  "launch-pro": 1000000,
  "bachelor-abroad-essential": 1500000,
  "bachelor-abroad-plus": 7000000,
  "bachelor-abroad-premium": 12000000,
  "master-abroad-essential": 1600000,
  "master-abroad-plus": 7500000,
  "master-abroad-premium": 12500000,
};

describe("0007_m12_current_pricing_catalogue_seed.sql — catalogue invariants (M12)", () => {
  it("inserts exactly eight plans into pricing_plans, no more and no fewer", () => {
    const start = sql.indexOf("insert into public.pricing_plans");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("on conflict (slug) do nothing;", start);
    expect(end).toBeGreaterThan(start);
    const section = sql.slice(start, end);
    for (const slug of OFFICIAL_SLUGS) {
      expect(section).toContain(`'${slug}'`);
    }
    const rowCount = (section.match(/^\s*\('/gm) ?? []).length;
    expect(rowCount).toBe(8);
  });

  it("every plan row is inserted as is_active = true", () => {
    const start = sql.indexOf("insert into public.pricing_plans");
    const end = sql.indexOf("on conflict (slug) do nothing;", start);
    const section = sql.slice(start, end);
    for (const slug of OFFICIAL_SLUGS) {
      const lineStart = section.indexOf(`'${slug}'`);
      const lineEnd = section.indexOf("\n", lineStart);
      const line = section.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      expect(line.trim().endsWith("true),") || line.trim().endsWith("true)")).toBe(true);
    }
  });

  it("category values are restricted to the allowed pricing_plans category enum", () => {
    const allowed = ["school_counselling", "class_11_counselling", "class_12_counselling", "bachelor_abroad", "master_abroad"];
    const start = sql.indexOf("insert into public.pricing_plans");
    const end = sql.indexOf("on conflict (slug) do nothing;", start);
    const section = sql.slice(start, end);
    for (const slug of OFFICIAL_SLUGS) {
      const rowMatch = section.match(new RegExp(`\\('${slug}',\\s*'([a-z_0-9]+)'`));
      expect(rowMatch, `expected to find a category for ${slug}`).not.toBeNull();
      expect(allowed).toContain(rowMatch![1]);
    }
  });

  it("both Launch plans use the school_counselling category (relabeled 'India Guidance' in presentation only)", () => {
    const start = sql.indexOf("insert into public.pricing_plans");
    const end = sql.indexOf("on conflict (slug) do nothing;", start);
    const section = sql.slice(start, end);
    for (const slug of ["launch-essential", "launch-pro"]) {
      const rowMatch = section.match(new RegExp(`\\('${slug}',\\s*'([a-z_0-9]+)'`));
      expect(rowMatch![1]).toBe("school_counselling");
    }
  });

  it("matches the exact official price list (minor units) for every plan", () => {
    for (const [slug, amount] of Object.entries(OFFICIAL_PRICES_MINOR_UNITS)) {
      expect(sql).toMatch(new RegExp(`'${slug}',\\s*'[^']*',\\s*${amount}::bigint`));
    }
  });

  it("every version row uses currency INR and payment_type one_time", () => {
    const start = sql.indexOf("insert into public.pricing_plan_versions");
    const end = sql.indexOf("PART 3", start);
    const section = sql.slice(start, end);
    expect(section).toMatch(/'INR', v\.amount_minor_units, 'one_time'/);
    expect(section).not.toMatch(/'USD'|'EUR'|'GBP'/);
  });

  it("uses idempotency guards throughout — ON CONFLICT DO NOTHING for plans, WHERE NOT EXISTS for versions and inclusions", () => {
    expect(sql).toMatch(/on conflict \(slug\) do nothing;/);
    expect(sql).toMatch(/where not exists \(select 1 from public\.pricing_plan_versions existing where existing\.plan_id = p\.id\)/);
    expect(sql).toMatch(/where not exists \(\s*select 1 from public\.pricing_plan_inclusions existing/);
  });

  it("current_version_id is only repointed when currently null — never overwrites an admin-customized live plan", () => {
    const start = sql.indexOf("PART 3");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("PART 4", start);
    const section = sql.slice(start, end);
    expect(section).toMatch(/and p\.current_version_id is null;/);
  });

  it("creates zero pricing_offers rows — no insert into pricing_offers anywhere in this file", () => {
    expect(sql).not.toMatch(/insert into public\.pricing_offers/);
  });

  it("does not modify or reference ALTER/DROP against any pre-existing table structure — this is a data-only seed", () => {
    expect(sql).not.toMatch(/alter table/i);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/drop column/i);
  });

  it("inserts structured inclusions only for the six Bachelor/Master Abroad plans, never for the two Launch plans", () => {
    const start = sql.indexOf("insert into public.pricing_plan_inclusions");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("PART 5", start);
    const section = sql.slice(start, end);
    expect(section).not.toContain("'launch-essential'");
    expect(section).not.toContain("'launch-pro'");
    for (const slug of ["bachelor-abroad-essential", "bachelor-abroad-plus", "bachelor-abroad-premium", "master-abroad-essential", "master-abroad-plus", "master-abroad-premium"]) {
      expect(section).toContain(`'${slug}'`);
    }
  });
});
