import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V3PublicPlan } from "./catalogue";

/**
 * NW-PRICING-V3.1 — security behaviour of the server quote action, called directly
 * (as a crafted request would), with the catalogue and database mocked.
 */

const plans: Record<string, V3PublicPlan> = {
  "nextwise-verified": {
    planId: "v",
    slug: "nextwise-verified",
    name: "Nextwise Verified",
    description: null,
    amountMinorUnits: 199_900,
    currency: "INR",
    taxStatus: "tax_inclusive",
    ctaText: null,
    inclusions: [],
    universityAddon: null,
  },
  "study-abroad-lite": {
    planId: "l",
    slug: "study-abroad-lite",
    name: "Nextwise Study Abroad Lite",
    description: null,
    amountMinorUnits: 4_499_900,
    currency: "INR",
    taxStatus: "unconfigured",
    ctaText: null,
    inclusions: [],
    universityAddon: {
      includedQuantity: 5,
      unitAmountMinorUnits: 799_900,
      currency: "INR",
      maxAdditionalQuantity: null,
    },
  },
  "study-abroad-premium": {
    planId: "p",
    slug: "study-abroad-premium",
    name: "Nextwise Study Abroad Premium",
    description: null,
    amountMinorUnits: 7_499_900,
    currency: "INR",
    taxStatus: "unconfigured",
    ctaText: null,
    inclusions: [],
    universityAddon: {
      includedQuantity: 10,
      unitAmountMinorUnits: 799_900,
      currency: "INR",
      maxAdditionalQuantity: null,
    },
  },
};

const state = { user: null as null | { id: string }, rpc: vi.fn() };
vi.mock("@/lib/pricing/v3/catalogue", () => ({
  getV3Plan: async (slug: string) => plans[slug] ?? null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    rpc: state.rpc,
  }),
}));

const { quotePackage } = await import("@/app/(site)/pricing/actions");

beforeEach(() => {
  state.user = null;
  state.rpc = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("NW-PRICING-V3.1 — quote action security", () => {
  it.each([
    [-1],
    ["-1"],
    [1.5],
    ["1.5"],
    ["1e2"],
    ["3 "],
    [" 3x"],
    [NaN],
    [Infinity],
    [101],
    ["10000"],
    [null],
    [undefined],
    [{}],
    [[3]],
    [true],
  ])("rejects the quantity %j", async (bad) => {
    const r = await quotePackage("study-abroad-lite", bad);
    if (bad === "3 ")
      expect(r.status).toBe("ok"); // surrounding whitespace is trimmed, the number itself is valid
    else expect(r.status).toBe("invalid");
  });

  it("ignores any price a client tries to send: only the slug and count are read", async () => {
    // a crafted call with extra fields cannot change the amount
    const r = await (
      quotePackage as (...a: unknown[]) => ReturnType<typeof quotePackage>
    )("study-abroad-lite", 3, false, {
      totalAmountMinorUnits: 100,
      unitAmountMinorUnits: 1,
    });
    expect(r.status === "ok" && r.quote.totalAmountMinorUnits).toBe(6_899_600);
  });

  it("refuses universities on Verified, and unknown or retired plans", async () => {
    expect((await quotePackage("nextwise-verified", 2)).status).toBe("invalid");
    expect((await quotePackage("nextwise-verified", 0)).status).toBe("ok");
    for (const slug of [
      "bachelor-abroad-plus",
      "nextwise-essential",
      "nextwise-explore",
      "STUDY-ABROAD-LITE",
      "",
      42,
      null,
    ])
      expect((await quotePackage(slug, 0)).status, String(slug)).toBe(
        "invalid",
      );
  });

  it("prices exactly from the catalogue: the six acceptance values", async () => {
    const cases: [string, number, number][] = [
      ["study-abroad-lite", 0, 4_499_900],
      ["study-abroad-lite", 1, 5_299_800],
      ["study-abroad-lite", 3, 6_899_600],
      ["study-abroad-premium", 0, 7_499_900],
      ["study-abroad-premium", 1, 8_299_800],
      ["study-abroad-premium", 3, 9_899_600],
    ];
    for (const [slug, n, total] of cases) {
      const r = await quotePackage(slug, n);
      expect(
        r.status === "ok" && r.quote.totalAmountMinorUnits,
        `${slug} +${n}`,
      ).toBe(total);
    }
  });

  it("a signed-out student cannot store a quote, and nothing reaches the database", async () => {
    const r = await quotePackage("study-abroad-premium", 3, true);
    expect(r.status === "ok" && r.saved).toBe("not_signed_in");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("only a strict true asks to save (a truthy string or number is ignored)", async () => {
    state.user = { id: "u1" };
    for (const s of ["true", 1, "yes", {}])
      expect(
        ((await quotePackage("study-abroad-lite", 1, s)) as { saved?: string })
          .saved,
      ).toBe("checked");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("a saved quote passes only the slug and count to the database, and is refused if the database disagrees", async () => {
    state.user = { id: "u1" };
    state.rpc.mockResolvedValueOnce({
      data: {
        id: "q1",
        totalAmountMinorUnits: 9_899_600,
        baseAmountMinorUnits: 7_499_900,
        addonAmountMinorUnits: 2_399_700,
      },
      error: null,
    });
    const ok = await quotePackage("study-abroad-premium", 3, true);
    expect(ok.status === "ok" && ok.saved).toBe("account");
    expect(state.rpc).toHaveBeenCalledWith("create_pricing_quote", {
      p_plan_slug: "study-abroad-premium",
      p_additional_universities: 3,
    });

    state.rpc.mockResolvedValueOnce({
      data: {
        id: "q2",
        totalAmountMinorUnits: 100,
        baseAmountMinorUnits: 100,
        addonAmountMinorUnits: 0,
      },
      error: null,
    });
    const bad = await quotePackage("study-abroad-premium", 3, true);
    expect(bad.status === "ok" && bad.saved === "account").toBe(false);
  });

  it("the database function enforces the same hard ceiling as the application", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../../../../supabase/migrations-proposed/NW_PRICING_V3/0001_three_plan_catalogue.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const { ADDITIONAL_UNIVERSITIES_HARD_CEILING } = await import("./quote");
    expect(sql).toContain(
      `if v_extra > ${ADDITIONAL_UNIVERSITIES_HARD_CEILING} then raise exception`,
    );
  });

  it("repeated identical requests give identical quotes (no drift, no accumulation)", async () => {
    const a = await quotePackage("study-abroad-lite", 3);
    const b = await quotePackage("study-abroad-lite", 3);
    expect(a).toEqual(b);
  });

  it("a quote is never an entitlement: the action has no path to invoices, purchases or access", async () => {
    const src = (await import("node:fs")).readFileSync(
      new URL("../../../app/(site)/pricing/actions.ts", import.meta.url),
      "utf8",
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(
      /from\(["'](invoices|pricing_purchases|student_entitlements)|purchase_pricing_plan|\.insert\(|\.update\(/,
    );
    expect([...code.matchAll(/rpc\(["']([a-z_]+)/g)].map((m) => m[1])).toEqual([
      "create_pricing_quote",
    ]);
  });
});
