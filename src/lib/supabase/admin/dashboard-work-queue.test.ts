import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("./application-documents", () => ({ listApplicationDocumentsForAdminBatch: vi.fn() }));
vi.mock("./application-checklist", () => ({ getApplicationChecklistItemsBatch: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { listApplicationDocumentsForAdminBatch } from "./application-documents";
import { getApplicationChecklistItemsBatch } from "./application-checklist";
import { getApplicationsNeedingAttention } from "./dashboard-work-queue";
import { APPLICATION_CHECKLIST_ITEM_KEYS } from "@/lib/applications/application-checklist";

const ALL_CHECKLIST_COMPLETE = APPLICATION_CHECKLIST_ITEM_KEYS.map((key) => ({ key, completedAt: "2026-01-01T00:00:00Z" }));

function makeFakeSupabase(appRows: Record<string, unknown>[], profileRows: Record<string, unknown>[]) {
  return {
    from: (table: string) => {
      if (table === "applications") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: appRows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ in: () => Promise.resolve({ data: profileRows, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getApplicationsNeedingAttention()", () => {
  it("returns [] without throwing for a role lacking application-documents:read (finance/analyst/content_editor)", async () => {
    const result = await getApplicationsNeedingAttention("finance");
    expect(result).toEqual([]);
    expect(requireAdminPermission).not.toHaveBeenCalled();
  });

  it("returns [] for an undefined role (no current admin)", async () => {
    const result = await getApplicationsNeedingAttention(undefined);
    expect(result).toEqual([]);
  });

  it("includes an application whose next action is 'needs_action' (a missing required document)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeSupabase(
        [{ id: "app-needs-doc", student_user_id: "student-1", stage: "preparing", updated_at: "2026-01-05T00:00:00Z" }],
        [{ id: "student-1", full_name: "Asha Rao" }]
      ) as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(listApplicationDocumentsForAdminBatch).mockResolvedValue(new Map());
    vi.mocked(getApplicationChecklistItemsBatch).mockResolvedValue(new Map([["app-needs-doc", ALL_CHECKLIST_COMPLETE]]));

    const result = await getApplicationsNeedingAttention("admin");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "app-needs-doc", studentName: "Asha Rao", bucket: "needs_action" });
    expect(requireAdminPermission).toHaveBeenCalledWith("application-documents:read");
  });

  it("excludes an application that is fully on track (ready_for_submission bucket, not needs_action)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeSupabase([{ id: "app-ontrack", student_user_id: "student-2", stage: "ready_to_submit", updated_at: "2026-01-04T00:00:00Z" }], []) as unknown as Awaited<
        ReturnType<typeof createClient>
      >
    );
    vi.mocked(listApplicationDocumentsForAdminBatch).mockResolvedValue(
      new Map([
        [
          "app-ontrack",
          [
            { id: "d1", documentType: "academic_transcript", originalFilename: "t.pdf", storagePath: "p", mimeType: "application/pdf", fileSizeBytes: 1, displayLabel: null, createdAt: "t", updatedAt: "t", reviewStatus: "accepted" as const, reviewedAt: "t", reviewedBy: "a", reviewNote: null, correctionMessage: null },
            { id: "d2", documentType: "identity_document", originalFilename: "i.pdf", storagePath: "p", mimeType: "application/pdf", fileSizeBytes: 1, displayLabel: null, createdAt: "t", updatedAt: "t", reviewStatus: "accepted" as const, reviewedAt: "t", reviewedBy: "a", reviewNote: null, correctionMessage: null },
            { id: "d3", documentType: "resume_cv", originalFilename: "r.pdf", storagePath: "p", mimeType: "application/pdf", fileSizeBytes: 1, displayLabel: null, createdAt: "t", updatedAt: "t", reviewStatus: "accepted" as const, reviewedAt: "t", reviewedBy: "a", reviewNote: null, correctionMessage: null },
          ],
        ],
      ])
    );
    vi.mocked(getApplicationChecklistItemsBatch).mockResolvedValue(new Map([["app-ontrack", ALL_CHECKLIST_COMPLETE]]));

    const result = await getApplicationsNeedingAttention("admin");
    expect(result).toEqual([]);
  });

  it("excludes an application waiting on the student (waiting_on_student bucket, not needs_action)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeSupabase([{ id: "app-waiting", student_user_id: "student-3", stage: "preparing", updated_at: "2026-01-03T00:00:00Z" }], []) as unknown as Awaited<
        ReturnType<typeof createClient>
      >
    );
    vi.mocked(listApplicationDocumentsForAdminBatch).mockResolvedValue(
      new Map([
        [
          "app-waiting",
          [
            { id: "d1", documentType: "academic_transcript", originalFilename: "t.pdf", storagePath: "p", mimeType: "application/pdf", fileSizeBytes: 1, displayLabel: null, createdAt: "t", updatedAt: "t", reviewStatus: "needs_correction" as const, reviewedAt: "t", reviewedBy: "a", reviewNote: null, correctionMessage: "please re-upload" },
            { id: "d2", documentType: "identity_document", originalFilename: "i.pdf", storagePath: "p", mimeType: "application/pdf", fileSizeBytes: 1, displayLabel: null, createdAt: "t", updatedAt: "t", reviewStatus: "accepted" as const, reviewedAt: "t", reviewedBy: "a", reviewNote: null, correctionMessage: null },
            { id: "d3", documentType: "resume_cv", originalFilename: "r.pdf", storagePath: "p", mimeType: "application/pdf", fileSizeBytes: 1, displayLabel: null, createdAt: "t", updatedAt: "t", reviewStatus: "accepted" as const, reviewedAt: "t", reviewedBy: "a", reviewNote: null, correctionMessage: null },
          ],
        ],
      ])
    );
    vi.mocked(getApplicationChecklistItemsBatch).mockResolvedValue(new Map([["app-waiting", ALL_CHECKLIST_COMPLETE]]));

    const result = await getApplicationsNeedingAttention("admin");
    expect(result).toEqual([]);
  });

  it("caps results at `limit`, taking the most-recently-updated candidates first (query already orders by updated_at desc)", async () => {
    const appRows = Array.from({ length: 10 }, (_, i) => ({ id: `app-${i}`, student_user_id: `student-${i}`, stage: "preparing", updated_at: `2026-01-${String(10 - i).padStart(2, "0")}T00:00:00Z` }));
    vi.mocked(createClient).mockResolvedValue(makeFakeSupabase(appRows, []) as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(listApplicationDocumentsForAdminBatch).mockResolvedValue(new Map());
    vi.mocked(getApplicationChecklistItemsBatch).mockResolvedValue(new Map());

    const result = await getApplicationsNeedingAttention("admin", 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(["app-0", "app-1", "app-2"]);
  });

  it("returns [] (never throws) on a query error", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({ select: () => ({ in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) }) }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await getApplicationsNeedingAttention("admin");
    expect(result).toEqual([]);
  });
});
