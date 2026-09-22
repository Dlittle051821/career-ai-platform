import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Milestone 17 (v2) — orchestration tests for
 * src/lib/supabase/education/application-documents.ts. Mocks every I/O
 * boundary (createClient — both its .rpc() and .storage.from() surfaces)
 * behind a small hand-rolled fake, same pattern as
 * src/lib/supabase/education/applications.test.ts.
 *
 * This file specifically covers the two security fixes that live in THIS
 * file rather than the migration (Issue 2 — replacement cleanup ordering;
 * Issue 5 — raw error leakage / the explicit error-sanitization allow-list)
 * plus the general upload/replace/remove orchestration surface: first
 * upload, replacement, metadata (RPC) failure, old-object cleanup failure,
 * IDOR/ownership posture, and unauthenticated access.
 */

vi.mock("../server", () => ({ createClient: vi.fn() }));

import { createClient } from "../server";
import {
  buildApplicationDocumentStoragePath,
  getApplicationDocumentDownloadUrl,
  listMyApplicationDocuments,
  removeApplicationDocument,
  uploadApplicationDocument,
} from "./application-documents";

function makeFakeSupabase(userId: string | null) {
  const rpc = vi.fn<(name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>>();
  const storageUpload = vi.fn<(path: string, bytes: Uint8Array, opts: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>>();
  const storageRemove = vi.fn<(paths: string[]) => Promise<{ data: unknown; error: { message: string } | null }>>();
  const storageCreateSignedUrl = vi.fn<(path: string, ttl: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>>();

  storageUpload.mockResolvedValue({ data: {}, error: null });
  storageRemove.mockResolvedValue({ data: {}, error: null });
  storageCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null });

  return {
    auth: { getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }) },
    rpc,
    storage: {
      from: (_bucket: string) => ({
        upload: storageUpload,
        remove: storageRemove,
        createSignedUrl: storageCreateSignedUrl,
      }),
    },
    _rpc: rpc,
    _storageUpload: storageUpload,
    _storageRemove: storageRemove,
    _storageCreateSignedUrl: storageCreateSignedUrl,
  };
}

type FakeSupabase = ReturnType<typeof makeFakeSupabase>;
let fake: FakeSupabase;

function setUser(userId: string | null) {
  fake = makeFakeSupabase(userId);
  vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setUser("student-1");
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

// ---------------------------------------------------------------------------
// Path building
// ---------------------------------------------------------------------------
describe("buildApplicationDocumentStoragePath()", () => {
  it("shape: <applicationId>/<uuid>/<sanitized filename>", () => {
    const path = buildApplicationDocumentStoragePath("app-123", "transcript.pdf");
    const parts = path.split("/");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("app-123");
    expect(parts[2]).toBe("transcript.pdf");
  });

  it("sanitizes unsafe characters out of the filename", () => {
    const path = buildApplicationDocumentStoragePath("app-1", "my résumé (final)!.pdf");
    const filenameSegment = path.split("/")[2];
    expect(filenameSegment).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it("two calls for the same application/filename produce different paths (independent random correlation id)", () => {
    const a = buildApplicationDocumentStoragePath("app-1", "same.pdf");
    const b = buildApplicationDocumentStoragePath("app-1", "same.pdf");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// listMyApplicationDocuments()
// ---------------------------------------------------------------------------
describe("listMyApplicationDocuments()", () => {
  it("logged out: returns [] without ever calling the RPC", async () => {
    setUser(null);
    const result = await listMyApplicationDocuments("app-1");
    expect(result).toEqual([]);
    expect(fake._rpc).not.toHaveBeenCalled();
  });

  it("maps RPC rows to the camelCase shape", async () => {
    fake._rpc.mockResolvedValue({
      data: [
        {
          id: "doc-1",
          document_type: "academic_transcript",
          original_filename: "t.pdf",
          storage_path: "app-1/uuid/t.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1000,
          display_label: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const result = await listMyApplicationDocuments("app-1");
    expect(result).toEqual([
      {
        id: "doc-1",
        documentType: "academic_transcript",
        originalFilename: "t.pdf",
        storagePath: "app-1/uuid/t.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1000,
        displayLabel: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("RPC error: returns [] rather than throwing", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await listMyApplicationDocuments("app-1");
    expect(result).toEqual([]);
  });

  it("defensively drops a row with an unrecognized document_type", async () => {
    fake._rpc.mockResolvedValue({
      data: [
        { id: "doc-1", document_type: "visa_document", original_filename: "v.pdf", storage_path: "p", mime_type: "application/pdf", file_size_bytes: 1, display_label: null, created_at: "t", updated_at: "t" },
      ],
      error: null,
    });
    const result = await listMyApplicationDocuments("app-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// uploadApplicationDocument() — client-side pre-validation
// ---------------------------------------------------------------------------
describe("uploadApplicationDocument() — pre-validation never touches Storage", () => {
  it("rejects an unrecognized document type before calling storage.upload", async () => {
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "visa_document", file: makeFile("f.pdf", "application/pdf", 100) });
    expect(result.success).toBe(false);
    expect(fake._storageUpload).not.toHaveBeenCalled();
  });

  it("rejects a disallowed MIME type before calling storage.upload", async () => {
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("f.exe", "application/x-msdownload", 100) });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not supported/);
    expect(fake._storageUpload).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before calling storage.upload", async () => {
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("f.pdf", "application/pdf", 26214401) });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too large/);
    expect(fake._storageUpload).not.toHaveBeenCalled();
  });

  it("rejects a too-long display label before calling storage.upload", async () => {
    const result = await uploadApplicationDocument({
      applicationId: "app-1",
      documentType: "resume_cv",
      file: makeFile("f.pdf", "application/pdf", 100),
      displayLabel: "x".repeat(201),
    });
    expect(result.success).toBe(false);
    expect(fake._storageUpload).not.toHaveBeenCalled();
  });

  it("rejects when logged out, before calling storage.upload or the RPC", async () => {
    setUser(null);
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("f.pdf", "application/pdf", 100) });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/logged in/);
    expect(fake._storageUpload).not.toHaveBeenCalled();
    expect(fake._rpc).not.toHaveBeenCalled();
  });
});

describe("uploadApplicationDocument() — happy path (first upload)", () => {
  it("uploads to storage, then calls the RPC with the resulting path, and returns the mapped document", async () => {
    fake._rpc.mockResolvedValue({
      data: [
        {
          id: "doc-1",
          document_type: "resume_cv",
          original_filename: "resume.pdf",
          storage_path: "app-1/uuid/resume.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 500,
          display_label: null,
          created_at: "t",
          updated_at: "t",
          previous_storage_path: null,
        },
      ],
      error: null,
    });

    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });

    expect(result.success).toBe(true);
    expect(result.document?.id).toBe("doc-1");
    expect(fake._storageUpload).toHaveBeenCalledTimes(1);
    expect(fake._rpc).toHaveBeenCalledWith("student_upload_application_document", expect.objectContaining({ p_application_id: "app-1", p_document_type: "resume_cv" }));
    // No previous_storage_path -> no cleanup attempted at all.
    expect(fake._storageRemove).not.toHaveBeenCalled();
  });
});

describe("uploadApplicationDocument() — [security fix, Issue 2] replacement cleanup", () => {
  it("deletes the OLD object using the RPC's own returned previous_storage_path, only after the RPC succeeded", async () => {
    fake._rpc.mockResolvedValue({
      data: [
        {
          id: "doc-2",
          document_type: "resume_cv",
          original_filename: "resume-v2.pdf",
          storage_path: "app-1/uuid-2/resume-v2.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 500,
          display_label: null,
          created_at: "t",
          updated_at: "t",
          previous_storage_path: "app-1/uuid-1/resume-v1.pdf",
        },
      ],
      error: null,
    });

    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume-v2.pdf", "application/pdf", 500) });

    expect(result.success).toBe(true);
    expect(fake._storageRemove).toHaveBeenCalledTimes(1);
    expect(fake._storageRemove).toHaveBeenCalledWith(["app-1/uuid-1/resume-v1.pdf"]);
  });

  it("a cleanup failure on the old object is logged, but never turns a successful replacement into a failure", async () => {
    fake._rpc.mockResolvedValue({
      data: [
        {
          id: "doc-2",
          document_type: "resume_cv",
          original_filename: "resume-v2.pdf",
          storage_path: "app-1/uuid-2/resume-v2.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 500,
          display_label: null,
          created_at: "t",
          updated_at: "t",
          previous_storage_path: "app-1/uuid-1/resume-v1.pdf",
        },
      ],
      error: null,
    });
    fake._storageRemove.mockResolvedValue({ data: null, error: { message: "network error" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume-v2.pdf", "application/pdf", 500) });

    expect(result.success).toBe(true);
    expect(result.document?.id).toBe("doc-2");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("two successive replacements each clean up exactly their own reported previous_storage_path, never cross-contaminating (concurrency is the DB row-lock's job, not this layer's)", async () => {
    fake._rpc.mockResolvedValueOnce({
      data: [{ id: "doc-2", document_type: "resume_cv", original_filename: "v2.pdf", storage_path: "app-1/u2/v2.pdf", mime_type: "application/pdf", file_size_bytes: 1, display_label: null, created_at: "t", updated_at: "t", previous_storage_path: "app-1/u1/v1.pdf" }],
      error: null,
    });
    await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("v2.pdf", "application/pdf", 1) });
    expect(fake._storageRemove).toHaveBeenNthCalledWith(1, ["app-1/u1/v1.pdf"]);

    fake._rpc.mockResolvedValueOnce({
      data: [{ id: "doc-3", document_type: "resume_cv", original_filename: "v3.pdf", storage_path: "app-1/u3/v3.pdf", mime_type: "application/pdf", file_size_bytes: 1, display_label: null, created_at: "t", updated_at: "t", previous_storage_path: "app-1/u2/v2.pdf" }],
      error: null,
    });
    await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("v3.pdf", "application/pdf", 1) });
    expect(fake._storageRemove).toHaveBeenNthCalledWith(2, ["app-1/u2/v2.pdf"]);
  });
});

describe("uploadApplicationDocument() — metadata (RPC) failure after a successful Storage upload", () => {
  it("cleans up the now-orphaned newly-uploaded object and returns a sanitized error", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: "This document could not be saved. Please try uploading again." } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });

    expect(result.success).toBe(false);
    expect(result.error).toBe("This document could not be saved. Please try uploading again.");
    expect(fake._storageRemove).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("a failure to clean up the orphaned object is logged but does not change the reported (already-failed) result", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: "This document could not be saved. Please try uploading again." } });
    fake._storageRemove.mockResolvedValue({ data: null, error: { message: "network error" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });

    expect(result.success).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe("uploadApplicationDocument() — [security fix, Issue 5] error sanitization", () => {
  it("relays an exact allow-listed RPC error message as-is", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: "This file is too large. The maximum size is 25MB." } });
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });
    expect(result.error).toBe("This file is too large. The maximum size is 25MB.");
  });

  it("never relays a raw/unexpected Postgres error message — maps to the generic fallback instead", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: 'duplicate key value violates unique constraint "application_documents_storage_path_unique"' } });
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });
    expect(result.error).not.toMatch(/duplicate key/);
    expect(result.error).not.toMatch(/constraint/);
    expect(result.success).toBe(false);
  });

  it("never relays a raw Storage SDK error on the initial upload", async () => {
    fake._storageUpload.mockResolvedValue({ data: null, error: { message: "InvalidJWT: token expired at 2026-01-01T00:00:00Z" } });
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/InvalidJWT/);
    expect(fake._rpc).not.toHaveBeenCalled();
  });

  it("a message that merely CONTAINS an allow-listed phrase, but is not an exact match, still maps to the generic fallback", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: "ERROR: This file is too large. The maximum size is 25MB. (SQLSTATE 22023)" } });
    const result = await uploadApplicationDocument({ applicationId: "app-1", documentType: "resume_cv", file: makeFile("resume.pdf", "application/pdf", 500) });
    expect(result.error).not.toBe("ERROR: This file is too large. The maximum size is 25MB. (SQLSTATE 22023)");
  });
});

// ---------------------------------------------------------------------------
// removeApplicationDocument()
// ---------------------------------------------------------------------------
describe("removeApplicationDocument()", () => {
  it("happy path: calls the RPC with only the document id, then deletes the RPC's own returned storage_path", async () => {
    fake._rpc.mockResolvedValue({ data: [{ id: "doc-1", storage_path: "app-1/uuid/f.pdf" }], error: null });
    const result = await removeApplicationDocument("doc-1");
    expect(result.success).toBe(true);
    expect(fake._rpc).toHaveBeenCalledWith("student_remove_application_document", { p_document_id: "doc-1" });
    expect(fake._storageRemove).toHaveBeenCalledWith(["app-1/uuid/f.pdf"]);
  });

  it("[security fix, Issue 4] a Storage cleanup failure after a successful remove is logged but still reports success", async () => {
    fake._rpc.mockResolvedValue({ data: [{ id: "doc-1", storage_path: "app-1/uuid/f.pdf" }], error: null });
    fake._storageRemove.mockResolvedValue({ data: null, error: { message: "network error" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await removeApplicationDocument("doc-1");

    expect(result.success).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("[security fix, Issue 5] relays the RPC's own allow-listed anti-enumeration message, never a raw error, for an IDOR attempt (foreign/missing document id)", async () => {
    fake._rpc.mockResolvedValue({
      data: null,
      error: { message: "This document could not be removed — it may not be yours, or it may have already been removed. Please refresh and try again." },
    });
    const result = await removeApplicationDocument("someone-elses-doc");
    expect(result.success).toBe(false);
    expect(result.error).toBe("This document could not be removed — it may not be yours, or it may have already been removed. Please refresh and try again.");
    expect(fake._storageRemove).not.toHaveBeenCalled();
  });

  it("never relays a raw/unexpected RPC error", async () => {
    fake._rpc.mockResolvedValue({ data: null, error: { message: "permission denied for table application_documents" } });
    const result = await removeApplicationDocument("doc-1");
    expect(result.error).not.toMatch(/permission denied/);
  });

  it("rejects when logged out, before ever calling the RPC", async () => {
    setUser(null);
    const result = await removeApplicationDocument("doc-1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/logged in/);
    expect(fake._rpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getApplicationDocumentDownloadUrl()
// ---------------------------------------------------------------------------
describe("getApplicationDocumentDownloadUrl()", () => {
  it("returns the signed URL on success", async () => {
    const url = await getApplicationDocumentDownloadUrl("app-1/uuid/f.pdf");
    expect(url).toBe("https://signed.example/x");
  });

  it("returns null (never throws) when Storage returns an error — e.g. a retired/removed document the caller is no longer authorized to read", async () => {
    fake._storageCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });
    const url = await getApplicationDocumentDownloadUrl("app-1/uuid/f.pdf");
    expect(url).toBeNull();
  });

  it("returns null when no signedUrl is present even without an explicit error", async () => {
    fake._storageCreateSignedUrl.mockResolvedValue({ data: null, error: null });
    const url = await getApplicationDocumentDownloadUrl("app-1/uuid/f.pdf");
    expect(url).toBeNull();
  });
});
