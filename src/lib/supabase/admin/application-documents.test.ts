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

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { getApplicationDocumentDownloadUrlForAdmin, listApplicationDocumentsForAdmin } from "./application-documents";

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
