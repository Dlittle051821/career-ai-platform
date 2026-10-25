import { beforeEach, describe, expect, it, vi } from "vitest";

// NW05.6 (P0 security fix) — a narrow, explicitly-justified exception to
// the "src/lib/supabase/ is untested here" convention (see
// vitest.config.mts's own commentary on this pattern), extended here to
// src/lib/products/entitlements.ts's I/O wrapper specifically because this
// is the SECURITY-CRITICAL function this fix targets: getMyProductEntitlements()
// orchestrates two Supabase reads (pricing_plans, invoices) and must
// fail CLOSED (grant nothing) on any lookup error, per ENTITLEMENT RULE 13
// in the NW05 brief. That orchestration — and the fail-closed guarantee
// specifically — cannot be exercised by the pure classifyPurchaseEntitlements()
// tests in entitlements.test.ts, which receive their inputs already
// resolved. Mocks createClient and listMyPurchases behind hand-rolled
// fakes, same convention as every other narrow src/lib/supabase/
// exception in this codebase.

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/pricing/my-purchases", () => ({ listMyPurchases: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { listMyPurchases } from "@/lib/supabase/pricing/my-purchases";
import { getMyProductEntitlements } from "./entitlements";
import type { PricingPurchase } from "@/types/pricing";

function makePurchase(overrides: Partial<PricingPurchase> & { id: string }): PricingPurchase {
  return {
    studentUserId: "student-1",
    planId: "plan-1",
    planVersionId: "version-1",
    planNameAtPurchase: "Test Plan",
    includedServicesAtPurchase: [],
    originalAmountMinorUnits: 100000,
    discountMinorUnits: 0,
    taxMinorUnits: 0,
    finalAmountMinorUnits: 100000,
    currency: "INR",
    offerId: null,
    couponCodeUsed: null,
    invoiceId: null,
    purchasedAt: "2026-01-01T00:00:00.000Z",
    sessionCountAtPurchase: null,
    inclusionsAtPurchase: [],
    presentationLimitsAtPurchase: null,
    ...overrides,
  };
}

function makeFakeSupabase(opts: {
  plans?: Array<{ id: string; category: string }>;
  plansError?: { message: string } | null;
  invoices?: Array<{ id: string; status: string }>;
  invoicesError?: { message: string } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "pricing_plans") {
      return { select: () => ({ in: () => Promise.resolve({ data: opts.plans ?? [], error: opts.plansError ?? null }) }) };
    }
    if (table === "invoices") {
      return { select: () => ({ in: () => Promise.resolve({ data: opts.invoices ?? [], error: opts.invoicesError ?? null }) }) };
    }
    throw new Error(`unexpected table in test fake: ${table}`);
  });
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMyProductEntitlements() — NW05.6 fail-closed orchestration", () => {
  it("returns empty and never touches Supabase for a student with no purchases (free/registered-only account)", async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([]);
    const result = await getMyProductEntitlements();
    expect(result).toEqual({ hasCareerEntitlement: false, hasAbroadEntitlement: false, careerPurchases: [], abroadPurchases: [] });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns empty and never touches Supabase when no purchase has a linked invoice (checkout started, never paid)", async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", invoiceId: null })]);
    const result = await getMyProductEntitlements();
    expect(result.hasCareerEntitlement).toBe(false);
    expect(result.hasAbroadEntitlement).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("grants the real entitlement for a genuinely paid purchase", async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-abroad", invoiceId: "inv-1" })]);
    const fake = makeFakeSupabase({ plans: [{ id: "plan-abroad", category: "master_abroad" }], invoices: [{ id: "inv-1", status: "paid" }] });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getMyProductEntitlements();
    expect(result.hasAbroadEntitlement).toBe(true);
    expect(result.hasCareerEntitlement).toBe(false);
  });

  it('SECURITY: a purchase linked to a "refunded" invoice grants no entitlement, even though the purchase row and a resolvable category both exist', async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" })]);
    const fake = makeFakeSupabase({ plans: [{ id: "plan-career", category: "school_counselling" }], invoices: [{ id: "inv-1", status: "refunded" }] });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getMyProductEntitlements();
    expect(result.hasCareerEntitlement).toBe(false);
  });

  it('SECURITY: a purchase linked to a "partially_paid" invoice grants no entitlement', async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" })]);
    const fake = makeFakeSupabase({ plans: [{ id: "plan-career", category: "school_counselling" }], invoices: [{ id: "inv-1", status: "partially_paid" }] });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getMyProductEntitlements();
    expect(result.hasCareerEntitlement).toBe(false);
  });

  it('SECURITY: a purchase linked to a "pending"-equivalent "issued" invoice grants no entitlement', async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-abroad", invoiceId: "inv-1" })]);
    const fake = makeFakeSupabase({ plans: [{ id: "plan-abroad", category: "bachelor_abroad" }], invoices: [{ id: "inv-1", status: "issued" }] });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getMyProductEntitlements();
    expect(result.hasAbroadEntitlement).toBe(false);
  });

  it("SECURITY (fail-closed): a pricing_plans lookup error grants nothing, even though the invoice IS paid", async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" })]);
    const fake = makeFakeSupabase({ plansError: { message: "boom" }, invoices: [{ id: "inv-1", status: "paid" }] });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getMyProductEntitlements();
    expect(result).toEqual({ hasCareerEntitlement: false, hasAbroadEntitlement: false, careerPurchases: [], abroadPurchases: [] });
  });

  it("SECURITY (fail-closed): an invoices lookup error grants nothing, even though the category IS known", async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" })]);
    const fake = makeFakeSupabase({ plans: [{ id: "plan-career", category: "school_counselling" }], invoicesError: { message: "boom" } });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getMyProductEntitlements();
    expect(result).toEqual({ hasCareerEntitlement: false, hasAbroadEntitlement: false, careerPurchases: [], abroadPurchases: [] });
  });

  it("never throws even when the fake Supabase client would reject", async () => {
    vi.mocked(listMyPurchases).mockResolvedValue([makePurchase({ id: "p1", planId: "plan-career", invoiceId: "inv-1" })]);
    const fake = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: "unreachable" } }) }) }) };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);

    await expect(getMyProductEntitlements()).resolves.toEqual({
      hasCareerEntitlement: false,
      hasAbroadEntitlement: false,
      careerPurchases: [],
      abroadPurchases: [],
    });
  });
});
