import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server", () => ({ createClient: vi.fn() }));

import { createClient } from "../server";
import { getMyApplicationSubmission } from "./application-submissions";

type FakeSupabase = { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }; rpc: ReturnType<typeof vi.fn> };

function makeFake(user: { id: string } | null, rpcResult: { data: unknown; error: unknown }): FakeSupabase {
  return { auth: { getUser: () => Promise.resolve({ data: { user } }) }, rpc: vi.fn().mockResolvedValue(rpcResult) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMyApplicationSubmission()", () => {
  it("returns null when logged out, never calls the RPC", async () => {
    const fake = makeFake(null, { data: [], error: null });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getMyApplicationSubmission("app-1");
    expect(result).toBeNull();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("returns null (not another student's data) when the RPC returns zero rows for a not-yet-submitted or not-owned application", async () => {
    const fake = makeFake({ id: "student-1" }, { data: [], error: null });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getMyApplicationSubmission("app-1");
    expect(result).toBeNull();
  });

  it("returns null (never throws) on an RPC error", async () => {
    const fake = makeFake({ id: "student-1" }, { data: null, error: { message: "boom" } });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getMyApplicationSubmission("app-1");
    expect(result).toBeNull();
  });

  it("calls get_my_application_submission() with the application id — identity comes from auth.uid() server-side only", async () => {
    const fake = makeFake({ id: "student-1" }, { data: [], error: null });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    await getMyApplicationSubmission("app-1");
    expect(fake.rpc).toHaveBeenCalledWith("get_my_application_submission", { p_application_id: "app-1" });
  });

  it("maps a returned row into the narrow student-safe shape", async () => {
    const row = {
      id: "sub-1",
      application_id: "app-1",
      submitted_at: "2026-01-02T00:00:00Z",
      submission_method: "university_portal",
      external_reference: "REF-1",
      university_label: "Test University",
      course_label: "Test Course",
      created_at: "2026-01-02T00:00:00Z",
    };
    const fake = makeFake({ id: "student-1" }, { data: [row], error: null });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getMyApplicationSubmission("app-1");
    expect(result).toEqual({
      id: "sub-1",
      applicationId: "app-1",
      submittedAt: "2026-01-02T00:00:00Z",
      submissionMethod: "university_portal",
      externalReference: "REF-1",
      universityLabel: "Test University",
      courseLabel: "Test Course",
      createdAt: "2026-01-02T00:00:00Z",
    });
  });

  it("the mapped shape structurally cannot carry submitted_by_user_id/internal_note/external_url/platform_name even if a misconfigured RPC response included them", async () => {
    const rowWithExtraFields = {
      id: "sub-1",
      application_id: "app-1",
      submitted_at: "2026-01-02T00:00:00Z",
      submission_method: "university_portal",
      external_reference: null,
      university_label: null,
      course_label: null,
      created_at: "2026-01-02T00:00:00Z",
      // These should never be present per the RPC's own RETURNS TABLE
      // (0021 PART 4), but this test simulates a misconfigured/future
      // response to prove the TypeScript mapping itself never forwards them
      // even if they somehow arrived.
      submitted_by_user_id: "admin-1",
      internal_note: "internal only",
      external_url: "https://staff-only-portal.example.com",
      platform_name: "Common App",
    };
    const fake = makeFake({ id: "student-1" }, { data: [rowWithExtraFields], error: null });
    vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getMyApplicationSubmission("app-1");
    expect(result).not.toHaveProperty("submittedByUserId");
    expect(result).not.toHaveProperty("internalNote");
    expect(result).not.toHaveProperty("externalUrl");
    expect(result).not.toHaveProperty("platformName");
  });
});
