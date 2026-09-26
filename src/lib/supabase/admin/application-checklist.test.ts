import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("./audit", () => ({ recordAuditLog: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { getApplicationChecklistItems, toggleApplicationChecklistItem } from "./application-checklist";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminPermission).mockResolvedValue({ userId: "admin-1", email: null, role: "admin", counsellorId: null });
});

function makeFakeSupabaseForRead(rows: Record<string, unknown>[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  };
}

describe("getApplicationChecklistItems()", () => {
  it("requires application-documents:review", async () => {
    vi.mocked(createClient).mockResolvedValue(makeFakeSupabaseForRead([]) as unknown as Awaited<ReturnType<typeof createClient>>);
    await getApplicationChecklistItems("app-1");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:review");
  });

  it("drops a row with an unrecognized item_key", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeSupabaseForRead([{ item_key: "unknown_future_item", completed_at: null }]) as unknown as Awaited<ReturnType<typeof createClient>>
    );
    const result = await getApplicationChecklistItems("app-1");
    expect(result).toEqual([]);
  });

  it("maps a recognized row through", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeSupabaseForRead([{ item_key: "eligibility_checked", completed_at: "2026-01-01T00:00:00Z" }]) as unknown as Awaited<ReturnType<typeof createClient>>
    );
    const result = await getApplicationChecklistItems("app-1");
    expect(result).toEqual([{ key: "eligibility_checked", completedAt: "2026-01-01T00:00:00Z" }]);
  });
});

describe("toggleApplicationChecklistItem()", () => {
  it("requires application-documents:review", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ upsert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await toggleApplicationChecklistItem("app-1", "eligibility_checked", true);
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:review");
  });

  it("rejects an unrecognized item key before ever touching the database", async () => {
    const upsert = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ upsert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(toggleApplicationChecklistItem("app-1", "not_a_real_item", true)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts on the (application_id, item_key) conflict target — never a separate insert-or-update round trip", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ upsert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await toggleApplicationChecklistItem("app-1", "eligibility_checked", true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ application_id: "app-1", item_key: "eligibility_checked" }), { onConflict: "application_id,item_key" });
  });

  it("sets completed_by to the server-derived admin id, never a client-supplied value, and clears it on un-toggle", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ upsert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await toggleApplicationChecklistItem("app-1", "eligibility_checked", true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ completed_by: "admin-1" }), expect.anything());

    await toggleApplicationChecklistItem("app-1", "eligibility_checked", false);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ completed_by: null, completed_at: null }), expect.anything());
  });

  it("records an audit log entry", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ upsert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await toggleApplicationChecklistItem("app-1", "eligibility_checked", true);
    expect(recordAuditLog).toHaveBeenCalled();
  });

  it("throws a safe, generic error (never a raw DB error) on a database failure", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "duplicate key value violates unique constraint" } });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ upsert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(toggleApplicationChecklistItem("app-1", "eligibility_checked", true)).rejects.toThrow("We couldn't update this checklist item. Please try again.");
  });
});
