import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminValidationError } from "@/lib/admin/form-state";
import { GatewayDefiniteRejectionError, GatewayUncertainOutcomeError, PaymentGatewayNotConfiguredError, type GatewayRefund } from "@/lib/payments/gateway";

/**
 * Milestone 13 FINAL FINANCIAL SAFETY PATCH — orchestration tests for
 * src/lib/supabase/admin/refunds.ts, the one place a refund's lifecycle is
 * actually driven from application code. There is no live Postgres in this
 * test environment (see refund-operations-migration-security.test.ts's own
 * static-analysis approach for the SQL layer) — this file instead mocks
 * every I/O boundary refunds.ts talks to (createClient, requireAdminPermission,
 * recordAuditLog, getPaymentGateway, getNotifier) behind a small hand-rolled
 * in-memory Supabase fake, so the STATEFUL ORCHESTRATION LOGIC itself
 * (issue #1's finalize-vs-await-confirmation branching, issue #2's atomic
 * conditional-update transitions, issue #3's gateway-before-claim ordering)
 * is exercised exactly the way production code exercises it, without a
 * database.
 *
 * This is a new testing pattern for this codebase (no prior vi.mock()
 * usage existed anywhere in src/) — justified by the complexity of this
 * particular orchestration and the explicit, detailed test demands of the
 * FINAL FINANCIAL SAFETY PATCH spec. The fake query builder below supports
 * only the exact chains refunds.ts itself uses; it is not a general-purpose
 * Supabase mock.
 */

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("./audit", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/payments/get-gateway", () => ({ getPaymentGateway: vi.fn() }));
vi.mock("@/lib/notifications/get-notifier", () => ({ getNotifier: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { getNotifier } from "@/lib/notifications/get-notifier";
import { approveRefund, cancelRefund, markRefundUnderReview, processApprovedRefund, rejectRefund } from "./refunds";

// ---------------------------------------------------------------------------
// Hand-rolled in-memory fake Supabase client — supports exactly the chains
// refunds.ts uses: .from(table).select(...).eq(...).maybeSingle(),
// .from(table).update(patch).eq(...).in(...).select("*").maybeSingle(),
// .from(table).update(patch).eq(...).eq(...) awaited directly (no select),
// .from(table).insert(row).select(col).single(), and .rpc(name, params).
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** A test can register a one-shot "race": the next select of `table` matching `id` returns the row as it was BEFORE `mutate` runs, then `mutate` fires — modeling a concurrent write that lands between another admin's read and their later write. */
interface RaceHook {
  table: string;
  id: string;
  mutate: (tables: Tables) => void;
}

function makeFakeSupabase(tables: Tables) {
  const pendingRaces: RaceHook[] = [];
  const rpc = vi.fn<(name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>>();

  function from(table: string) {
    tables[table] = tables[table] ?? [];
    let mode: "select" | "update" | "insert" = "select";
    let updatePatch: Row | null = null;
    let insertRow: Row | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    let filterIds: string[] = []; // tracks eq("id", x) values specifically, for race-hook matching

    function currentRows(): Row[] {
      return tables[table];
    }

    function matched(): Row[] {
      return currentRows().filter((r) => filters.every((f) => f(r)));
    }

    function applyRaceIfSelecting(): Row[] {
      // Only select-mode reads can be raced (an update's own filters are
      // evaluated against whatever is current at that instant, which is
      // exactly the point — a stale update must see the post-race state).
      if (mode !== "select") return matched();
      const idFilter = filterIds[0];
      if (idFilter) {
        const hookIdx = pendingRaces.findIndex((h) => h.table === table && h.id === idFilter);
        if (hookIdx !== -1) {
          const snapshot = matched().map((r) => ({ ...r }));
          const [hook] = pendingRaces.splice(hookIdx, 1);
          hook.mutate(tables);
          return snapshot;
        }
      }
      return matched();
    }

    function runMutationAndReturn(): Row[] {
      if (mode === "update") {
        const targets = matched();
        for (const row of targets) Object.assign(row, updatePatch);
        return targets;
      }
      if (mode === "insert") {
        const row: Row = { id: `generated-${currentRows().length + 1}`, ...(insertRow ?? {}) };
        currentRows().push(row);
        return [row];
      }
      return applyRaceIfSelecting();
    }

    const builder = {
      select(_cols?: unknown) {
        return builder;
      },
      update(patch: Row) {
        mode = "update";
        updatePatch = patch;
        return builder;
      },
      insert(row: Row) {
        mode = "insert";
        insertRow = row;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        if (col === "id" && typeof val === "string") filterIds.push(val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      ilike() {
        return builder;
      },
      order() {
        return builder;
      },
      range() {
        const rows = runMutationAndReturn();
        return Promise.resolve({ data: rows, error: null, count: rows.length });
      },
      maybeSingle() {
        const rows = runMutationAndReturn();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        const rows = runMutationAndReturn();
        if (rows.length === 0) return Promise.resolve({ data: null, error: { message: "no rows" } });
        return Promise.resolve({ data: rows[0], error: null });
      },
      then(onFulfilled: (v: { data: Row[]; error: null }) => unknown, onRejected?: (e: unknown) => unknown) {
        const rows = runMutationAndReturn();
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    from,
    rpc,
    _tables: tables,
    _raceOnNextRead(table: string, id: string, mutate: (tables: Tables) => void) {
      pendingRaces.push({ table, id, mutate });
    },
  };
}

type FakeSupabase = ReturnType<typeof makeFakeSupabase>;

const ADMIN = { userId: "admin-1", email: "admin@example.com", role: "admin" as const, counsellorId: null };

function baseRefundRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "refund-1",
    payment_transaction_id: "txn-1",
    invoice_id: "invoice-1",
    provider_refund_id: null,
    amount_minor_units: 10000,
    status: "requested",
    reason: "test",
    initiated_by: "admin-1",
    reviewed_by: null,
    reviewed_at: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    cancelled_by: null,
    cancelled_at: null,
    finalized_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

let fake: FakeSupabase;

beforeEach(() => {
  vi.clearAllMocks();
  fake = makeFakeSupabase({});
  vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(requireAdminPermission).mockResolvedValue(ADMIN);
  vi.mocked(recordAuditLog).mockResolvedValue(undefined);
  vi.mocked(getNotifier).mockReturnValue({ notify: vi.fn().mockResolvedValue(undefined) });
});

// ---------------------------------------------------------------------------
// Issue 2 — atomic status transitions / stale-action races (tests 9-12)
// ---------------------------------------------------------------------------

describe("Issue 2 — refund lifecycle transitions are atomic, database-authoritative conditional updates", () => {
  it("[test 9] a stale reject cannot overwrite a refund that has since moved to processing", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "under_review" })];
    // Admin A's read of the (stale) under_review state races against
    // another process claiming the refund for processing in between A's
    // read and A's write.
    fake._raceOnNextRead("refunds", "r1", (tables) => {
      tables.refunds[0].status = "processing";
    });

    await expect(rejectRefund("r1", makeFormData(["rejectionReason", "not eligible"]))).rejects.toThrow(AdminValidationError);
    expect(fake._tables.refunds[0].status).toBe("processing");
  });

  it("[test 10] a stale cancel cannot overwrite a refund that has since moved to processing", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "approved" })];
    fake._raceOnNextRead("refunds", "r1", (tables) => {
      tables.refunds[0].status = "processing";
    });

    await expect(cancelRefund("r1")).rejects.toThrow(AdminValidationError);
    expect(fake._tables.refunds[0].status).toBe("processing");
  });

  it("[test 11] a stale approve cannot overwrite a refund that has since been rejected", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "under_review", amount_minor_units: 5000 })];
    fake._tables.payment_transactions = [
      { id: "txn-1", provider_payment_id: "pay_1", is_manual: false, status: "captured", amount_minor_units: 5000, amount_refunded_minor_units: 0, currency: "INR", payment_attempt_id: "attempt-1" },
    ];
    fake._tables.payment_attempts = [{ id: "attempt-1", invoice_id: "invoice-1" }];
    fake._raceOnNextRead("refunds", "r1", (tables) => {
      tables.refunds[0].status = "rejected";
      tables.refunds[0].rejection_reason = "already rejected by someone else";
    });

    const form = makeFormData();
    await expect(approveRefund("r1", form)).rejects.toThrow(AdminValidationError);
    expect(fake._tables.refunds[0].status).toBe("rejected");
  });

  it("[test 12] a stale under-review action cannot move a refund's state backwards once it has been approved", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "requested" })];
    fake._raceOnNextRead("refunds", "r1", (tables) => {
      tables.refunds[0].status = "approved";
    });

    await expect(markRefundUnderReview("r1")).rejects.toThrow(AdminValidationError);
    expect(fake._tables.refunds[0].status).toBe("approved");
  });

  it("two admins choosing different actions on the same case cannot both win (last-write-wins is impossible) — the loser gets a safe refresh error, never a silent overwrite", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "under_review" })];
    // Admin B's cancel actually lands first (simulated directly, no race
    // hook needed since we're calling it synchronously before Admin A's
    // stale reject below).
    await cancelRefund("r1");
    expect(fake._tables.refunds[0].status).toBe("cancelled");

    // Admin A's reject was based on the pre-cancellation under_review read.
    await expect(rejectRefund("r1", makeFormData(["rejectionReason", "too late"]))).rejects.toThrow(AdminValidationError);
    expect(fake._tables.refunds[0].status).toBe("cancelled");
  });

  it("a same-status re-application (idempotent no-op) is still allowed — e.g. re-marking an already under_review case under review to bump reviewed_at", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "under_review" })];
    await markRefundUnderReview("r1");
    expect(fake._tables.refunds[0].status).toBe("under_review");
    expect(fake._tables.refunds[0].reviewed_by).toBe("admin-1");
  });

  it("a valid, non-raced transition still succeeds normally (requested -> under_review)", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "requested" })];
    await markRefundUnderReview("r1");
    expect(fake._tables.refunds[0].status).toBe("under_review");
  });
});

// ---------------------------------------------------------------------------
// Issue 3 — gateway must be checked BEFORE the processing claim (tests 7-8)
// ---------------------------------------------------------------------------

describe("Issue 3 — processApprovedRefund checks gateway configuration before claiming the refund for processing", () => {
  it("[test 7 & 8] gateway not configured: refund stays approved, zero provider calls, claim RPC never even attempted", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "approved" })];
    vi.mocked(getPaymentGateway).mockReturnValue(null);

    await expect(processApprovedRefund("r1")).rejects.toThrow(PaymentGatewayNotConfiguredError);

    expect(fake.rpc).not.toHaveBeenCalledWith("claim_refund_for_processing", expect.anything());
    expect(fake._tables.refunds[0].status).toBe("approved");
  });

  it("can be retried and succeeds once the gateway is configured", async () => {
    fake._tables.refunds = [baseRefundRow({ id: "r1", status: "approved" })];
    vi.mocked(getPaymentGateway).mockReturnValueOnce(null);
    await expect(processApprovedRefund("r1")).rejects.toThrow(PaymentGatewayNotConfiguredError);

    const createRefund = vi.fn<() => Promise<GatewayRefund>>().mockResolvedValue({ providerRefundId: "rfnd_1", status: "processed", amountMinorUnits: 10000 });
    vi.mocked(getPaymentGateway).mockReturnValue({
      providerName: "razorpay",
      createOrder: vi.fn(),
      fetchPayment: vi.fn(),
      createRefund,
      getRefundStatus: vi.fn(),
      verifyCheckoutSignature: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    });
    fake.rpc.mockImplementation((name: string) => {
      if (name === "claim_refund_for_processing") {
        return Promise.resolve({ data: { refund_id: "r1", payment_transaction_id: "txn-1", provider_payment_id: "pay_1", amount_minor_units: 10000, currency: "INR" }, error: null });
      }
      if (name === "finalize_refund") return Promise.resolve({ data: null, error: null });
      throw new Error(`unexpected rpc ${name}`);
    });

    const outcome = await processApprovedRefund("r1");
    expect(outcome).toBe("processed");
    expect(createRefund).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Issue 1 + provider-refund-id persistence (tests 1-6)
// ---------------------------------------------------------------------------

function setUpClaimableRefund(status = "approved") {
  fake._tables.refunds = [baseRefundRow({ id: "r1", status })];
  fake.rpc.mockImplementation((name: string, params?: Record<string, unknown>) => {
    if (name === "claim_refund_for_processing") {
      fake._tables.refunds[0].status = "processing";
      return Promise.resolve({ data: { refund_id: "r1", payment_transaction_id: "txn-1", provider_payment_id: "pay_1", amount_minor_units: 10000, currency: "INR" }, error: null });
    }
    if (name === "finalize_refund") {
      const outcome = params?.p_outcome as string;
      fake._tables.refunds[0].status = outcome;
      fake._tables.refunds[0].provider_refund_id = params?.p_provider_refund_id ?? fake._tables.refunds[0].provider_refund_id;
      fake._tables.refunds[0].finalized_at = "2026-01-02T00:00:00Z";
      return Promise.resolve({ data: null, error: null });
    }
    throw new Error(`unexpected rpc ${name}`);
  });
}

function mockGateway(createRefund: ReturnType<typeof vi.fn>) {
  vi.mocked(getPaymentGateway).mockReturnValue({
    providerName: "razorpay",
    createOrder: vi.fn(),
    fetchPayment: vi.fn(),
    createRefund: createRefund as unknown as (params: never) => Promise<GatewayRefund>,
    getRefundStatus: vi.fn(),
    verifyCheckoutSignature: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  });
}

describe("Issue 1 — a successful gateway response is not itself proof the refund completed", () => {
  it("[test 1] createRefund returns 'processed' -> finalize_refund is called exactly once, with outcome 'processed'", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockResolvedValue({ providerRefundId: "rfnd_1", status: "processed", amountMinorUnits: 10000 }));

    const outcome = await processApprovedRefund("r1");

    expect(outcome).toBe("processed");
    const finalizeCalls = fake.rpc.mock.calls.filter(([name]) => name === "finalize_refund");
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0][1]).toMatchObject({ p_outcome: "processed", p_provider_refund_id: "rfnd_1" });
    expect(fake._tables.refunds[0].status).toBe("processed");
  });

  it("[test 2] createRefund returns 'pending' -> the refund stays 'processing', never finalized", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockResolvedValue({ providerRefundId: "rfnd_2", status: "pending", amountMinorUnits: 10000 }));

    const outcome = await processApprovedRefund("r1");

    expect(outcome).toBe("pending_provider_confirmation");
    expect(fake._tables.refunds[0].status).toBe("processing");
    expect(fake.rpc.mock.calls.some(([name]) => name === "finalize_refund")).toBe(false);
  });

  it("[test 3] a 'pending' response persists the provider refund id even though it does not finalize", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockResolvedValue({ providerRefundId: "rfnd_3", status: "pending", amountMinorUnits: 10000 }));

    await processApprovedRefund("r1");

    expect(fake._tables.refunds[0].provider_refund_id).toBe("rfnd_3");
    expect(fake._tables.refunds[0].status).toBe("processing");
  });

  it("[test 4] a 'pending' response never increments amount_refunded_minor_units — finalize_refund (the only place that arithmetic lives) is never invoked", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockResolvedValue({ providerRefundId: "rfnd_4", status: "pending", amountMinorUnits: 10000 }));

    await processApprovedRefund("r1");

    expect(fake.rpc.mock.calls.filter(([name]) => name === "finalize_refund")).toHaveLength(0);
  });

  it("[test 5] an uncertain network/transport result (thrown GatewayUncertainOutcomeError) leaves the refund in 'processing', never finalized", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockRejectedValue(new GatewayUncertainOutcomeError("timeout")));

    const outcome = await processApprovedRefund("r1");

    expect(outcome).toBe("uncertain_pending_reconciliation");
    expect(fake._tables.refunds[0].status).toBe("processing");
    expect(fake.rpc.mock.calls.some(([name]) => name === "finalize_refund")).toBe(false);
  });

  it("[test 6] a definite provider rejection (thrown GatewayDefiniteRejectionError) finalizes as failed", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockRejectedValue(new GatewayDefiniteRejectionError("card refund not supported")));

    const outcome = await processApprovedRefund("r1");

    expect(outcome).toBe("failed");
    const finalizeCalls = fake.rpc.mock.calls.filter(([name]) => name === "finalize_refund");
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0][1]).toMatchObject({ p_outcome: "failed" });
    expect(fake._tables.refunds[0].status).toBe("failed");
  });

  it("createRefund returning 'failed' (a non-throwing but terminal failure response) also finalizes as failed exactly once", async () => {
    setUpClaimableRefund();
    mockGateway(vi.fn().mockResolvedValue({ providerRefundId: "rfnd_7", status: "failed", amountMinorUnits: 10000 }));

    const outcome = await processApprovedRefund("r1");

    expect(outcome).toBe("failed");
    expect(fake.rpc.mock.calls.filter(([name]) => name === "finalize_refund")).toHaveLength(1);
  });

  it("a pending-then-webhook-finalized refund's persistence write cannot resurrect/overwrite a case already finalized by another process in the meantime", async () => {
    setUpClaimableRefund();
    // Simulate a webhook finalizing the refund the instant createRefund
    // resolves, before this function's own persistence write runs.
    const createRefund = vi.fn().mockImplementation(async () => {
      fake._tables.refunds[0].status = "processed";
      fake._tables.refunds[0].provider_refund_id = "rfnd_webhook";
      return { providerRefundId: "rfnd_race", status: "pending", amountMinorUnits: 10000 };
    });
    mockGateway(createRefund);

    await processApprovedRefund("r1");

    // The persistence update was conditioned on status = 'processing', which
    // is no longer true, so it must not have overwritten the webhook's own
    // provider_refund_id.
    expect(fake._tables.refunds[0].provider_refund_id).toBe("rfnd_webhook");
    expect(fake._tables.refunds[0].status).toBe("processed");
  });
});

/** Builds a real FormData from flat [key, value] pairs — refunds.ts only ever calls formData.get(). */
function makeFormData(...pairs: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of pairs) fd.append(k, v);
  return fd;
}
