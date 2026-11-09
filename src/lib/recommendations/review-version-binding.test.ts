import { beforeEach, expect, it, vi } from "vitest";

// CC-15 (independent review F4): an approval/request-changes decision must name
// the exact draft version the reviewer was shown. The database RPC enforces it;
// these tests pin the application side of that contract.
const io = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: io.rpc }) }));
vi.mock("@/lib/supabase/admin-auth", () => ({ requireAdminPermission: vi.fn(async () => ({ userId: "reviewer-1", role: "admin" })) }));
vi.mock("@/lib/supabase/admin/audit", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));

import { reviewRecommendationDraft } from "@/lib/supabase/admin/recommendation-drafts";

beforeEach(() => { io.rpc.mockReset().mockResolvedValue({ data: null, error: null }); });

it("sends the reviewed version id with the decision", async () => {
  await reviewRecommendationDraft("draft-1", "approve", "version-7", null);
  expect(io.rpc).toHaveBeenCalledExactlyOnceWith("staff_review_recommendation_draft", {
    p_draft_id: "draft-1", p_decision: "approve", p_expected_version_id: "version-7", p_review_notes: null,
  });
});

it("refuses to send a decision without a reviewed version", async () => {
  await expect(reviewRecommendationDraft("draft-1", "approve", null, null)).rejects.toThrow(/Reload the page/);
  expect(io.rpc).not.toHaveBeenCalled();
});

it("relays the database's stale-version refusal to the reviewer", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  io.rpc.mockResolvedValue({ data: null, error: { message: "This draft changed since you opened it. Reload the page and review the current version." } });
  await expect(reviewRecommendationDraft("draft-1", "approve", "version-6", null)).rejects.toThrow(/changed since you opened it/);
  log.mockRestore();
});
