import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "../admin-auth";

/**
 * Milestone 17 (v2) — orchestration tests for
 * src/lib/supabase/admin/application-documents.ts. Mocks createClient and
 * requireAdminPermission, same convention as
 * src/lib/supabase/admin/applications.test.ts.
 */

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({
  requireAdminPermission: vi.fn(),
  AdminAuthorizationError: class AdminAuthorizationError extends Error {},
}));
vi.mock("../education/application-documents", () => ({ APPLICATION_DOCUMENTS_BUCKET: "application-documents" }));
vi.mock("./audit", () => ({ recordAuditLog: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { getApplicationDocumentDownloadUrlForAdmin, listApplicationDocumentsForAdmin, reviewApplicationDocument } from "./application-documents";

type Row = Record<string, unknown>;

function makeFakeSupabase(rows: Row[]) {
  const storageCreateSignedUrl = vi.fn<(path: string, ttl: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>>();
  storageCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/admin" }, error: null });

  function from(_table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    const builder = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return builder;
      },
      order() {
        return builder;
      },
      then(onFulfilled: (v: { data: Row[]; error: null }) => unknown) {
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: filtered, error: null }).then(onFulfilled);
      },
    };
    return builder;
  }

  return {
    from,
    storage: { from: () => ({ createSignedUrl: storageCreateSignedUrl }) },
    _storageCreateSignedUrl: storageCreateSignedUrl,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminPermission).mockResolvedValue({ userId: "admin-1", email: null, role: "admin", counsellorId: null });
});

describe("listApplicationDocumentsForAdmin()", () => {
  it("requires application-documents:read (M17-v3 — narrowed from the broader applications:read v2 used)", async () => {
    vi.mocked(createClient).mockResolvedValue(makeFakeSupabase([]) as unknown as Awaited<ReturnType<typeof createClient>>);
    await listApplicationDocumentsForAdmin("app-1");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:read");
  });

  it("filters to is_current = true only — no version-history leak to admin/counsellor", async () => {
    const fake = makeFakeSupabase([
      { id: "doc-1", application_id: "app-1", document_type: "resume_cv", original_filename: "r.pdf", storage_path: "p1", mime_type: "application/pdf", file_size_bytes: 1, display_label: null, is_current: true, created_at: "t", updated_at: "t" },
    ]);
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await listApplicationDocumentsForAdmin("app-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("doc-1");
  });

  it("propagates a permission rejection (AdminAuthorizationError) rather than swallowing it", async () => {
    vi.mocked(requireAdminPermission).mockRejectedValue(new AdminAuthorizationError("no permission"));
    await expect(listApplicationDocumentsForAdmin("app-1")).rejects.toThrow();
  });

  it("returns [] (never throws) on a query error", async () => {
    const fake = makeFakeSupabase([]);
    (fake.from as unknown as ReturnType<typeof vi.fn>) = vi.fn(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) }),
    }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await listApplicationDocumentsForAdmin("app-1");
    expect(result).toEqual([]);
  });

  it("defensively drops a row with an unrecognized document_type", async () => {
    const fake = makeFakeSupabase([
      { id: "doc-1", application_id: "app-1", document_type: "visa_document", original_filename: "v.pdf", storage_path: "p1", mime_type: "application/pdf", file_size_bytes: 1, display_label: null, is_current: true, created_at: "t", updated_at: "t" },
    ]);
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await listApplicationDocumentsForAdmin("app-1");
    expect(result).toEqual([]);
  });
});

describe("getApplicationDocumentDownloadUrlForAdmin()", () => {
  it("requires application-documents:read (M17-v3 — narrowed from the broader applications:read v2 used)", async () => {
    const fake = makeFakeSupabase([]);
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await getApplicationDocumentDownloadUrlForAdmin("app-1/uuid/f.pdf");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:read");
  });

  it("returns the signed URL on success", async () => {
    const fake = makeFakeSupabase([]);
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const url = await getApplicationDocumentDownloadUrlForAdmin("app-1/uuid/f.pdf");
    expect(url).toBe("https://signed.example/admin");
  });

  it("returns null (never throws) when Storage denies the request — e.g. a retired document, even for an otherwise-authorized admin", async () => {
    const fake = makeFakeSupabase([]);
    fake._storageCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const url = await getApplicationDocumentDownloadUrlForAdmin("app-1/uuid/f.pdf");
    expect(url).toBeNull();
  });
});

/**
 * Milestone 18 — reviewApplicationDocument(). Mocks supabase.rpc directly
 * (this function never touches .from() at all — every mutation goes
 * through staff_review_application_document(), matching the RPC-only
 * posture 0020 PART 2 requires).
 */
function makeFakeSupabaseWithRpc(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>) {
  return { rpc: vi.fn(rpcImpl) };
}

describe("reviewApplicationDocument()", () => {
  it("requires application-documents:review — never the broader applications:write alone", async () => {
    const fake = makeFakeSupabaseWithRpc(async () => ({
      data: [{ id: "doc-1", application_id: "app-1", document_type: "resume_cv", review_status: "accepted", reviewed_at: "t", reviewed_by: "admin-1", review_note: null, correction_message: null }],
      error: null,
    }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await reviewApplicationDocument("doc-1", "accepted");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:review");
  });

  it("rejects an unrecognized review status before ever calling the RPC", async () => {
    const fake = makeFakeSupabaseWithRpc(async () => ({ data: null, error: null }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(reviewApplicationDocument("doc-1", "rejected")).rejects.toThrow();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("requires a student-facing message when requesting a correction", async () => {
    const fake = makeFakeSupabaseWithRpc(async () => ({ data: null, error: null }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(reviewApplicationDocument("doc-1", "needs_correction")).rejects.toThrow();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("clears correction_message client-side intent when accepting — never sends a stale message alongside 'accepted'", async () => {
    const fake = makeFakeSupabaseWithRpc(async () => ({
      data: [{ id: "doc-1", application_id: "app-1", document_type: "resume_cv", review_status: "accepted", reviewed_at: "t", reviewed_by: "admin-1", review_note: null, correction_message: null }],
      error: null,
    }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await reviewApplicationDocument("doc-1", "accepted", { correctionMessage: "leftover text" });
    expect(fake.rpc).toHaveBeenCalledWith("staff_review_application_document", expect.objectContaining({ p_correction_message: null }));
  });

  it("relays the RPC's own generic anti-enumeration error rather than swallowing or rewriting it", async () => {
    const fake = makeFakeSupabaseWithRpc(async () => ({
      data: null,
      error: { message: "This document could not be reviewed — it may no longer be current, or you may not have access. Please refresh and try again." },
    }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(reviewApplicationDocument("doc-1", "accepted")).rejects.toThrow(/no longer be current/);
  });

  it("records an audit log entry with entityType 'application_document_review' on success", async () => {
    const fake = makeFakeSupabaseWithRpc(async () => ({
      data: [{ id: "doc-1", application_id: "app-1", document_type: "resume_cv", review_status: "accepted", reviewed_at: "t", reviewed_by: "admin-1", review_note: null, correction_message: null }],
      error: null,
    }));
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await reviewApplicationDocument("doc-1", "accepted");
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "application_document_review" }));
  });
});
