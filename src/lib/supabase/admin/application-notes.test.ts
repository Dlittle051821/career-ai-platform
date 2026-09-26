import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("./audit", () => ({ recordAuditLog: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { addApplicationInternalNote, getApplicationInternalNotes } from "./application-notes";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminPermission).mockResolvedValue({ userId: "admin-1", email: null, role: "admin", counsellorId: null });
});

describe("getApplicationInternalNotes()", () => {
  it("requires application-documents:review", async () => {
    const fake = {
      from: (table: string) =>
        table === "application_internal_notes"
          ? { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }
          : { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) },
    };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await getApplicationInternalNotes("app-1");
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:review");
  });

  it("resolves author names and orders newest first (as returned by the query)", async () => {
    const notes = [{ id: "n-2", application_id: "app-1", author_user_id: "admin-1", note: "second", created_at: "2026-01-02T00:00:00Z" }];
    const fake = {
      from: (table: string) =>
        table === "application_internal_notes"
          ? { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: notes, error: null }) }) }) }
          : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "admin-1", full_name: "Priya Admin" }], error: null }) }) },
    };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getApplicationInternalNotes("app-1");
    expect(result).toEqual([{ id: "n-2", applicationId: "app-1", authorUserId: "admin-1", authorName: "Priya Admin", note: "second", createdAt: "2026-01-02T00:00:00Z" }]);
  });

  it("returns [] (never throws) on a query error", async () => {
    const fake = {
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) }),
    };
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getApplicationInternalNotes("app-1");
    expect(result).toEqual([]);
  });
});

describe("addApplicationInternalNote()", () => {
  function makeForm(note: string) {
    const fd = new FormData();
    fd.set("note", note);
    return fd;
  }

  it("requires application-documents:review", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await addApplicationInternalNote("app-1", makeForm("Called the student, awaiting a clearer transcript scan."));
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:review");
  });

  it("rejects an empty note before ever touching the database", async () => {
    const insert = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(addApplicationInternalNote("app-1", makeForm("   "))).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a note over 4000 characters", async () => {
    const insert = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(addApplicationInternalNote("app-1", makeForm("x".repeat(4001)))).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("sets author_user_id to the server-derived admin id, never a client-supplied value", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await addApplicationInternalNote("app-1", makeForm("Note text."));
    expect(insert).toHaveBeenCalledWith({ application_id: "app-1", author_user_id: "admin-1", note: "Note text." });
  });

  it("records an audit log entry on success", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await addApplicationInternalNote("app-1", makeForm("Note text."));
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "application" }));
  });

  it("throws a safe, generic error (never a raw DB error) on a database failure", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "violates row-level security policy" } });
    vi.mocked(createClient).mockResolvedValue({ from: () => ({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>);
    await expect(addApplicationInternalNote("app-1", makeForm("Note text."))).rejects.toThrow("We couldn't save this note. Please try again.");
  });
});
