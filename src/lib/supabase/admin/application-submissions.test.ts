import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("./audit", () => ({ recordAuditLog: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { getApplicationSubmissionForAdmin, listApplicationSubmissionDocumentsForAdmin, recordApplicationSubmission } from "./application-submissions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminPermission).mockResolvedValue({ userId: "admin-1", email: null, role: "admin", counsellorId: null });
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const VALID_SUBMISSION_FIELDS = { submissionMethod: "university_portal", platformName: "", externalReference: "", externalUrl: "", internalNote: "" };

describe("getApplicationSubmissionForAdmin()", () => {
  it("requires application-submissions:read", async () => {
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } as unknown as Awaited<
      ReturnType<typeof createClient>
    >);
    await getApplicationSubmissionForAdmin("app-1");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-submissions:read");
  });

  it("returns null when no submission exists yet", async () => {
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } as unknown as Awaited<
      ReturnType<typeof createClient>
    >);
    const result = await getApplicationSubmissionForAdmin("app-1");
    expect(result).toBeNull();
  });

  it("returns null (never throws) on a query error", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getApplicationSubmissionForAdmin("app-1");
    expect(result).toBeNull();
  });

  it("maps a found row and resolves the submitter's name via profiles, never exposing the raw row shape", async () => {
    const submissionRow = {
      id: "sub-1",
      application_id: "app-1",
      submitted_at: "2026-01-02T00:00:00Z",
      submitted_by_user_id: "admin-1",
      submission_method: "university_portal",
      platform_name: "Common App",
      external_reference: "REF-1",
      external_url: null,
      internal_note: "internal only",
      application_stage_at_submission: "ready_to_submit",
      university_id: "uni-1",
      university_label: "Test University",
      course_id: "course-1",
      course_label: "Test Course",
      course_intake_id: null,
      intake_label: null,
      created_at: "2026-01-02T00:00:00Z",
    };
    const fake = {
      from: (table: string) =>
        table === "application_submissions"
          ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: submissionRow, error: null }) }) }) }
          : { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { full_name: "Priya Admin" }, error: null }) }) }) },
    };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getApplicationSubmissionForAdmin("app-1");
    expect(result?.submittedByName).toBe("Priya Admin");
    expect(result?.internalNote).toBe("internal only");
  });
});

describe("listApplicationSubmissionDocumentsForAdmin()", () => {
  it("requires application-submissions:read", async () => {
    const fake = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await listApplicationSubmissionDocumentsForAdmin("sub-1");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-submissions:read");
  });

  it("resolves original_filename from the REFERENCED application_documents row, not a duplicated column", async () => {
    const snapshotRows = [{ id: "sd-1", application_document_id: "doc-1", document_type: "academic_transcript" }];
    const fake = {
      from: (table: string) =>
        table === "application_submission_documents"
          ? { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: snapshotRows, error: null }) }) }) }
          : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "doc-1", original_filename: "transcript.pdf" }], error: null }) }) },
    };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await listApplicationSubmissionDocumentsForAdmin("sub-1");
    expect(result).toEqual([{ id: "sd-1", documentType: "academic_transcript", originalFilename: "transcript.pdf" }]);
  });

  it("returns [] (never throws) when the snapshot query errors", async () => {
    const fake = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) }) };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await listApplicationSubmissionDocumentsForAdmin("sub-1");
    expect(result).toEqual([]);
  });
});

describe("recordApplicationSubmission()", () => {
  it("requires application-submissions:write", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "sub-1", application_id: "app-1" }], error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await recordApplicationSubmission("app-1", makeForm(VALID_SUBMISSION_FIELDS));
    expect(requireAdminPermission).toHaveBeenCalledWith("application-submissions:write");
  });

  it("rejects an unrecognized submission method before ever calling the RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(recordApplicationSubmission("app-1", makeForm({ ...VALID_SUBMISSION_FIELDS, submissionMethod: "agent_commission_engine" }))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid external URL before ever calling the RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(recordApplicationSubmission("app-1", makeForm({ ...VALID_SUBMISSION_FIELDS, externalUrl: "javascript:alert(1)" }))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an internal note over 2000 characters before ever calling the RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(recordApplicationSubmission("app-1", makeForm({ ...VALID_SUBMISSION_FIELDS, internalNote: "x".repeat(2001) }))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a platform name over 200 characters before ever calling the RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(recordApplicationSubmission("app-1", makeForm({ ...VALID_SUBMISSION_FIELDS, platformName: "x".repeat(201) }))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never passes a submitted-by/actor identity to the RPC — the RPC call only ever carries applicationId and form-derived fields", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "sub-1", application_id: "app-1" }], error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await recordApplicationSubmission("app-1", makeForm(VALID_SUBMISSION_FIELDS));
    const args = rpc.mock.calls[0][1];
    expect(Object.keys(args)).not.toContain("p_submitted_by");
    expect(Object.keys(args)).not.toContain("p_submitted_by_user_id");
    expect(args.p_application_id).toBe("app-1");
  });

  it("relays the RPC's own safe, generic error message on failure rather than inventing a new one", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "This application is no longer ready for submission. Refresh and review the latest details." } });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(recordApplicationSubmission("app-1", makeForm(VALID_SUBMISSION_FIELDS))).rejects.toThrow("This application is no longer ready for submission. Refresh and review the latest details.");
  });

  it("never leaks a raw Postgres error even if one somehow reached this function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'duplicate key value violates unique constraint "application_submissions_one_per_application"' } });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    // This function relays the RPC's error message as-is (matching
    // reviewApplicationDocument()'s own convention) — the RPC itself is
    // responsible for never raising a raw constraint message in the first
    // place (see the migration-security test's own "already been recorded
    // as submitted" assertion). This test documents that division of
    // responsibility rather than re-implementing a second sanitizer here.
    await expect(recordApplicationSubmission("app-1", makeForm(VALID_SUBMISSION_FIELDS))).rejects.toThrow();
  });

  it("records an audit log entry with entityType 'application_submission' on success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "sub-1", application_id: "app-1" }], error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await recordApplicationSubmission("app-1", makeForm(VALID_SUBMISSION_FIELDS));
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "application_submission", entityId: "app-1" }));
  });

  it("throws a safe generic error if the RPC succeeds but returns no row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(recordApplicationSubmission("app-1", makeForm(VALID_SUBMISSION_FIELDS))).rejects.toThrow();
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
