import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/admin/money";
import { PR01_ACTIVE_CATALOG, PR01_RETIRED_SLUGS } from "./pr01-catalog";

/**
 * Fixture regression for the new 7-plan active commercial catalogue — see
 * pr01-catalog.ts's own docblock for why this fixture exists separately from
 * the seed SQL (supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql)
 * it mirrors, mirroring official-catalog.test.ts's own convention for the
 * superseded M12 catalogue. If any of these numbers or slugs ever changes
 * without a corresponding reviewed catalog-migration change, this test is
 * the tripwire.
 */
describe("PR01_ACTIVE_CATALOG", () => {
  it("has exactly seven active plans", () => {
    expect(PR01_ACTIVE_CATALOG).toHaveLength(7);
  });

  it("every slug is unique and matches the user's specified clean stable slugs", () => {
    const slugs = PR01_ACTIVE_CATALOG.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual([
      "nextwise-explore",
      "nextwise-verified",
      "nextwise-essential",
      "bachelor-abroad-plus",
      "master-abroad-plus",
      "bachelor-abroad-premium",
      "master-abroad-premium",
    ]);
  });

  it("every plan is priced in INR with a non-negative integer minor-units amount (zero is a real, valid free tier)", () => {
    for (const plan of PR01_ACTIVE_CATALOG) {
      expect(plan.currency).toBe("INR");
      expect(Number.isInteger(plan.amountMinorUnits)).toBe(true);
      expect(plan.amountMinorUnits).toBeGreaterThanOrEqual(0);
    }
  });

  it("matches the exact new official price list (minor units)", () => {
    const bySlug = Object.fromEntries(PR01_ACTIVE_CATALOG.map((p) => [p.slug, p.amountMinorUnits]));
    expect(bySlug).toEqual({
      "nextwise-explore": 0,
      "nextwise-verified": 199_900,
      "nextwise-essential": 2_499_900,
      "bachelor-abroad-plus": 7_000_000,
      "master-abroad-plus": 7_500_000,
      "bachelor-abroad-premium": 12_000_000,
      "master-abroad-premium": 12_500_000,
    });
  });

  it("matches the exact major-unit (rupee) price list — the free plan is a real ₹0, never fabricated", () => {
    const bySlug = Object.fromEntries(PR01_ACTIVE_CATALOG.map((p) => [p.slug, formatMoney(p.amountMinorUnits, p.currency)]));
    expect(bySlug).toEqual({
      "nextwise-explore": "₹0.00",
      "nextwise-verified": "₹1,999.00",
      "nextwise-essential": "₹24,999.00",
      "bachelor-abroad-plus": "₹70,000.00",
      "master-abroad-plus": "₹75,000.00",
      "bachelor-abroad-premium": "₹1,20,000.00",
      "master-abroad-premium": "₹1,25,000.00",
    });
  });

  it("the four continuing Bachelor/Master Abroad plans keep their EXACT pre-existing M12 prices — this milestone never repriced them", () => {
    const bySlug = Object.fromEntries(PR01_ACTIVE_CATALOG.map((p) => [p.slug, p.amountMinorUnits]));
    expect(bySlug["bachelor-abroad-plus"]).toBe(7_000_000);
    expect(bySlug["master-abroad-plus"]).toBe(7_500_000);
    expect(bySlug["bachelor-abroad-premium"]).toBe(12_000_000);
    expect(bySlug["master-abroad-premium"]).toBe(12_500_000);
  });

  it("exactly two plans are marked recommended — Bachelor Abroad Premium and Master Abroad Premium", () => {
    const recommended = PR01_ACTIVE_CATALOG.filter((p) => p.isRecommended).map((p) => p.slug);
    expect(recommended.sort()).toEqual(["bachelor-abroad-premium", "master-abroad-premium"]);
  });

  it("display_order is strictly increasing in the 10/20/.../70 sequence the seed file uses", () => {
    const orders = PR01_ACTIVE_CATALOG.map((p) => p.displayOrder);
    expect(orders).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it("the three new India-guidance plans carry their own real, non-empty inclusion fixtures (never fabricated at render time)", () => {
    for (const slug of ["nextwise-explore", "nextwise-verified", "nextwise-essential"]) {
      const plan = PR01_ACTIVE_CATALOG.find((p) => p.slug === slug);
      expect(plan?.inclusions).not.toBeNull();
      expect(plan?.inclusions?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("the four continuing Bachelor/Master Abroad plans carry null inclusions here — their real inclusions live unchanged in the 0007 seed, never duplicated", () => {
    for (const slug of ["bachelor-abroad-plus", "master-abroad-plus", "bachelor-abroad-premium", "master-abroad-premium"]) {
      const plan = PR01_ACTIVE_CATALOG.find((p) => p.slug === slug);
      expect(plan?.inclusions).toBeNull();
    }
  });

  it("every new plan's category is the existing school_counselling enum value — no new category was invented", () => {
    for (const slug of ["nextwise-explore", "nextwise-verified", "nextwise-essential"]) {
      const plan = PR01_ACTIVE_CATALOG.find((p) => p.slug === slug);
      expect(plan?.category).toBe("school_counselling");
    }
  });
});

describe("PR01_RETIRED_SLUGS", () => {
  it("lists exactly the four superseded plans, never one of the 7 active slugs", () => {
    expect(PR01_RETIRED_SLUGS).toEqual(["launch-essential", "launch-pro", "bachelor-abroad-essential", "master-abroad-essential"]);
    const activeSlugs = new Set(PR01_ACTIVE_CATALOG.map((p) => p.slug));
    for (const retired of PR01_RETIRED_SLUGS) {
      expect(activeSlugs.has(retired)).toBe(false);
    }
  });
});
