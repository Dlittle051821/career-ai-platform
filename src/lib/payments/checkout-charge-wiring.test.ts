import { beforeEach, describe, expect, it, vi } from "vitest";

// The real checkout module, with only its I/O boundaries replaced: Supabase
// (student session), the signed-in user, the gateway and its config. No real
// gateway, keys or database are touched.
type Result = { data: unknown; error: unknown };
const io = vi.hoisted(() => ({
  tables: {} as Record<string, Result>,
  createOrder: vi.fn(),
  inserts: [] as unknown[],
  dbCheck: { data: null, error: null } as Result,
  rpcCalls: [] as unknown[],
}));

function query(table: string) {
  let inserting = false;
  const result = () => (inserting ? { data: { id: "attempt-new" }, error: null } : io.tables[table] ?? { data: null, error: null });
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    limit: () => builder,
    insert: (row: unknown) => { io.inserts.push(row); inserting = true; return builder; },
    single: async () => result(),
    maybeSingle: async () => {
      const r = result();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
    },
    then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: query,
    rpc: async (name: string, args: unknown) => { io.rpcCalls.push({ name, args }); return io.dbCheck; },
  }),
}));
vi.mock("@/lib/supabase/profile", () => ({ getCurrentUser: async () => ({ id: "student-1" }) }));
vi.mock("@/lib/payments/env", () => ({ getRazorpayServerConfig: () => ({ keyId: "rzp_test_fixture", keySecret: "fixture" }) }));
vi.mock("@/lib/payments/get-gateway", () => ({ getPaymentGateway: () => ({ createOrder: io.createOrder }) }));

import { CheckoutError, createOrReuseCheckoutSession } from "@/lib/supabase/payments/checkout";

const PRICE = 199_900;
function verifiedInvoice(total: number, tax = 0, rate: number | null = null) {
  io.tables = {
    invoices: { data: { id: "inv-1", invoice_number: "NW-1", status: "issued", currency: "INR", subtotal_minor_units: PRICE, discount_minor_units: 0, tax_minor_units: tax, total_minor_units: total, student_user_id: "student-1" }, error: null },
    payment_attempts: { data: [], error: null },
    payment_transactions: { data: [], error: null },
    invoice_line_items: { data: [{ tax_rate_bps: rate, tax_minor_units: tax, line_total_minor_units: total }], error: null },
    pricing_purchases: { data: [{ plan_id: "plan-v", plan_version_id: "ver-v", plan_name_at_purchase: "Nextwise Verified", original_amount_minor_units: PRICE, discount_minor_units: 0, tax_minor_units: tax, final_amount_minor_units: total, currency: "INR" }], error: null },
    pricing_plans: { data: { slug: "nextwise-verified" }, error: null },
    pricing_plan_versions: { data: { tax_status: "tax_inclusive" }, error: null },
  };
}

beforeEach(() => {
  io.createOrder.mockReset().mockResolvedValue({ providerOrderId: "order_fixture" });
  io.inserts = [];
  io.rpcCalls = [];
  io.dbCheck = { data: null, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createOrReuseCheckoutSession fails closed before any gateway order", () => {
  it("creates an order for exactly ₹1,999 when the Verified invoice is valid (GST inclusive)", async () => {
    verifiedInvoice(PRICE, 30_493, 1_800);
    const session = await createOrReuseCheckoutSession("inv-1");
    expect(io.createOrder).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ amountMinorUnits: PRICE, currency: "INR" }));
    expect(session).toMatchObject({ paymentAttemptId: "attempt-new", amountMinorUnits: PRICE });
    expect(io.inserts).toEqual([expect.objectContaining({ amount_minor_units: PRICE, currency: "INR" })]);
  });

  it("refuses the known ₹2,358.82 defect and never calls the gateway", async () => {
    verifiedInvoice(235_882, 35_982, 1_800);
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(CheckoutError);
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(/price couldn't be verified/);
    expect(io.createOrder).not.toHaveBeenCalled();
    expect(io.inserts).toEqual([]);
  });

  it("refuses when the purchase record cannot be read", async () => {
    verifiedInvoice(PRICE);
    io.tables.pricing_purchases = { data: null, error: { message: "fixture failure" } };
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(/price couldn't be verified/);
    expect(io.createOrder).not.toHaveBeenCalled();
  });

  it("refuses when payment history cannot be read", async () => {
    verifiedInvoice(PRICE);
    io.tables.payment_attempts = { data: null, error: { message: "fixture failure" } };
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(/price couldn't be verified/);
    expect(io.createOrder).not.toHaveBeenCalled();
  });

  it("will not reuse an open order created for a wrong amount", async () => {
    verifiedInvoice(PRICE);
    io.tables.payment_attempts = { data: [{ id: "old", status: "created", provider_order_id: "order_old", amount_minor_units: 235_882 }], error: null };
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(/price couldn't be verified/);
    expect(io.createOrder).not.toHaveBeenCalled();
  });

  it("reuses an open order only when it is for exactly the amount due", async () => {
    verifiedInvoice(PRICE);
    io.tables.payment_attempts = { data: [{ id: "open", status: "created", provider_order_id: "order_open", amount_minor_units: PRICE }], error: null };
    const session = await createOrReuseCheckoutSession("inv-1");
    expect(session).toMatchObject({ paymentAttemptId: "open", amountMinorUnits: PRICE });
    expect(io.createOrder).not.toHaveBeenCalled();
  });

  it("asks the database's authoritative charge check before creating an order", async () => {
    verifiedInvoice(PRICE, 30_493, 1_800);
    await createOrReuseCheckoutSession("inv-1");
    expect(io.rpcCalls).toEqual([{ name: "check_invoice_charge", args: { p_invoice_id: "inv-1", p_amount: PRICE, p_currency: "INR" } }]);
  });

  it.each([
    ["registered GST with a missing GSTIN", { data: "gstin_invalid", error: null }],
    ["registered GST with an invalid rate", { data: "gst_rate_invalid", error: null }],
    ["missing billing settings", { data: "billing_settings_missing", error: null }],
    ["a Verified tax breakdown that does not match", { data: "verified_tax_mismatch", error: null }],
    ["the check RPC being unavailable", { data: null, error: { code: "PGRST202", message: "fixture" } }],
  ] as const)("blocks %s even when the invoice total is exactly 199,900", async (_label, result) => {
    verifiedInvoice(PRICE);
    io.dbCheck = result;
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(/price couldn't be verified/);
    expect(io.createOrder).not.toHaveBeenCalled();
    expect(io.inserts).toEqual([]);
  });

  it("does not reuse an open order when the database check fails", async () => {
    verifiedInvoice(PRICE);
    io.tables.payment_attempts = { data: [{ id: "open", status: "created", provider_order_id: "order_open", amount_minor_units: PRICE }], error: null };
    io.dbCheck = { data: "gstin_invalid", error: null };
    await expect(createOrReuseCheckoutSession("inv-1")).rejects.toThrow(/price couldn't be verified/);
  });
});
