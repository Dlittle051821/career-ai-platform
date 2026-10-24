import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql
 * — a static text-level check, same convention as m12-seed-catalogue.test.ts
 * (this project has no live database in its Vitest setup). What this test
 * catches: someone silently widening the retirement list, dropping the
 * never-delete/idempotency discipline, repricing a continuing plan, or
 * sneaking the file toward auto-execution. It is not a substitute for
 * actually running the VERIFY query at the bottom of the seed file against a
 * real database after a human reviews and applies it.
 */

const SEED_PATH = path.resolve(process.cwd(), "supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql");
const sql = readFileSync(SEED_PATH, "utf8");

const RETIRED_SLUGS = ["launch-essential", "launch-pro", "bachelor-abroad-essential", "master-abroad-essential"];
const NEW_SLUGS = ["nextwise-explore", "nextwise-verified", "nextwise-essential"];
const CONTINUING_SLUGS = ["bachelor-abroad-plus", "master-abroad-plus", "bachelor-abroad-premium", "master-abroad-premium"];

const NEW_PRICES_MINOR_UNITS: Record<string, number> = {
  "nextwise-explore": 0,
  "nextwise-verified": 199900,
  "nextwise-essential": 2499900,
};

describe("0009_pr01_new_commercial_catalogue_seed.sql — catalogue-migration invariants (PR01)", () => {
  it("never deletes a row — no DELETE/DROP/TRUNCATE anywhere in this file (deactivation only, per the user's explicit instruction)", () => {
    expect(sql).not.toMatch(/delete from/i);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/drop column/i);
    expect(sql).not.toMatch(/truncate/i);
  });

  it("never alters table structure — this is a data-only catalog migration", () => {
    expect(sql).not.toMatch(/alter table/i);
  });

  it("retires exactly the four superseded plans via is_active = false, and only those four", () => {
    const match = sql.match(/update public\.pricing_plans\s+set is_active = false\s+where slug in \(([^)]+)\)/i);
    expect(match).not.toBeNull();
    const listed = match![1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
    expect(listed.sort()).toEqual([...RETIRED_SLUGS].sort());
  });

  it("the retirement UPDATE is also guarded by `and is_active = true` — never flips an already-inactive row, never touches an active row outside the named list", () => {
    const start = sql.indexOf("update public.pricing_plans\nset is_active = false");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf(";", start);
    const statement = sql.slice(start, end);
    expect(statement).toMatch(/and is_active = true/);
  });

  it("marks exactly the two Premium plans is_recommended = true, via plain UPDATE statements that never touch price/version columns", () => {
    for (const slug of ["bachelor-abroad-premium", "master-abroad-premium"]) {
      const re = new RegExp(`update public\\.pricing_plans set display_order = \\d+, is_recommended = true where slug = '${slug}';`);
      expect(sql).toMatch(re);
    }
  });

  it("the two continuing non-premium plans are reordered but never marked is_recommended by this file", () => {
    for (const slug of ["bachelor-abroad-plus", "master-abroad-plus"]) {
      const re = new RegExp(`update public\\.pricing_plans set display_order = \\d+ where slug = '${slug}';`);
      expect(sql).toMatch(re);
      expect(sql).not.toMatch(new RegExp(`is_recommended = true where slug = '${slug}'`));
    }
  });

  it("inserts exactly the three new plans into pricing_plans, idempotently (on conflict do nothing), none of them pre-marked recommended", () => {
    const start = sql.indexOf("insert into public.pricing_plans");
    const end = sql.indexOf("on conflict (slug) do nothing;", start);
    expect(end).toBeGreaterThan(start);
    const section = sql.slice(start, end);
    for (const slug of NEW_SLUGS) {
      expect(section).toContain(`'${slug}'`);
    }
    const rowCount = (section.match(/^\s*\('/gm) ?? []).length;
    expect(rowCount).toBe(3);
    expect(section).not.toMatch(/true,\s*true\)/);
  });

  it("every new plan is seeded under the existing school_counselling category — no new enum value introduced", () => {
    const start = sql.indexOf("insert into public.pricing_plans");
    const end = sql.indexOf("on conflict (slug) do nothing;", start);
    const section = sql.slice(start, end);
    for (const slug of NEW_SLUGS) {
      const rowMatch = section.match(new RegExp(`\\('${slug}',\\s*'([a-z_0-9]+)'`));
      expect(rowMatch, `expected to find a category for ${slug}`).not.toBeNull();
      expect(rowMatch![1]).toBe("school_counselling");
    }
  });

  it("matches the exact new prices (minor units) for all three brand-new plans", () => {
    for (const [slug, amount] of Object.entries(NEW_PRICES_MINOR_UNITS)) {
      expect(sql).toMatch(new RegExp(`'${slug}', '[^']*',\\s*\\n\\s*'[^']*',\\s*\\n\\s*${amount}::bigint`));
    }
  });

  it("every new version row is currency INR, payment_type one_time, status published", () => {
    const start = sql.indexOf("insert into public.pricing_plan_versions");
    const end = sql.indexOf("PART 5", start);
    const section = sql.slice(start, end);
    expect(section).toMatch(/'INR', v\.amount_minor_units, 'one_time'/);
    expect(section).toMatch(/'published'/);
    expect(section).not.toMatch(/'USD'|'EUR'|'GBP'/);
  });

  it("uses idempotency guards throughout — ON CONFLICT DO NOTHING for new plans, WHERE NOT EXISTS for versions and inclusions", () => {
    expect(sql).toMatch(/on conflict \(slug\) do nothing;/);
    expect(sql).toMatch(/where not exists \(select 1 from public\.pricing_plan_versions existing where existing\.plan_id = p\.id\)/);
    expect(sql).toMatch(/where not exists \(\s*select 1 from public\.pricing_plan_inclusions existing/);
  });

  it("current_version_id is only repointed when currently null for the three new plans — never overwrites a live pointer", () => {
    const start = sql.indexOf("PART 5");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("PART 6", start);
    const section = sql.slice(start, end);
    expect(section).toMatch(/and p\.current_version_id is null/);
    for (const slug of NEW_SLUGS) {
      expect(section).toContain(`'${slug}'`);
    }
  });

  it("creates zero pricing_offers rows — no fabricated discounts", () => {
    expect(sql).not.toMatch(/insert into public\.pricing_offers/);
  });

  it("inserts structured inclusions only for the three new plans, never re-inserting rows for the four continuing plans (their real inclusions already exist from 0007)", () => {
    const start = sql.indexOf("insert into public.pricing_plan_inclusions");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("VERIFY", start);
    const section = sql.slice(start, end);
    for (const slug of CONTINUING_SLUGS) {
      expect(section).not.toContain(`'${slug}'`);
    }
    for (const slug of NEW_SLUGS) {
      expect(section).toContain(`'${slug}'`);
    }
  });

  it("the file's own header is explicit that this is for review only and must not be executed, committed, pushed, or deployed by this milestone", () => {
    expect(sql).toMatch(/FOR REVIEW ONLY/i);
    expect(sql).toMatch(/NOT EXECUTED AGAINST ANY DATABASE/i);
  });
});
