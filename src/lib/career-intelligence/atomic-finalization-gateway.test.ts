import { beforeEach, expect, it, vi } from "vitest";
import type { CareerIntelligenceGateway } from "./service";
import { resolveAiConfig } from "@/lib/ai/config";
// CC-16 (F1): finalization goes through the trusted service-role client only,
// on behalf of the staff user authenticated from their own session.
const io = vi.hoisted(() => ({ rpc: vi.fn(), sessionRpc: vi.fn(), admin: vi.fn(), trustedConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: io.sessionRpc }) }));
vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: () => (io.trustedConfigured ? { rpc: io.rpc } : null),
  isServiceRoleConfigured: () => io.trustedConfigured,
}));
vi.mock("@/lib/supabase/admin-auth", () => ({ getCurrentAdmin: io.admin, requireAdminPermission: vi.fn() }));
vi.mock("@/lib/supabase/admin/audit", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/admin/student-profile", () => ({ getStudentProfileSnapshotForAdmin: vi.fn() }));
vi.mock("@/lib/supabase/careers", () => ({ getCareersForMatching: vi.fn() }));
vi.mock("@/lib/supabase/admin/profile-provenance", () => ({ getSectionProvenanceMap: vi.fn() }));
import { createCareerIntelligenceGateway } from "@/lib/supabase/admin/career-intelligence";
const args = {
  runId: "offline-run", studentUserId: "offline-student", consentId: "offline-consent",
  content: { aiAssisted: true, summary: "PRIVATE fixture content" },
  report: { privateFixture: "PRIVATE fixture report" },
  usage: { model: "offline-model", inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.4, attempts: 1, latencyMs: 2 },
} as unknown as Parameters<CareerIntelligenceGateway["finalizeRun"]>[0];
const gateway = () => createCareerIntelligenceGateway(resolveAiConfig({ NODE_ENV: "test" }));
beforeEach(() => { vi.clearAllMocks(); io.trustedConfigured = true; io.admin.mockResolvedValue({ userId: "staff-session-user", role: "counsellor" }); });
it.each(["finalized", "duplicate"])("maps %s through exactly one session-scoped atomic RPC", async (outcome) => {
  io.rpc.mockResolvedValue({ data: { outcome, draft_id: "offline-draft" }, error: null });
  expect(await gateway().finalizeRun(args)).toEqual({ kind: outcome, draftId: "offline-draft" });
  expect(io.rpc).toHaveBeenCalledExactlyOnceWith("staff_finalize_ai_generation_run", {
    p_requester_user_id: "staff-session-user",
    p_run_id: args.runId, p_student_user_id: args.studentUserId, p_consent_id: args.consentId,
    p_report: args.report, p_draft_content: args.content, p_usage: args.usage,
  });
});
it.each(["failed", "consent_withdrawn"])("maps %s without fallback content writes", async (outcome) => {
  io.rpc.mockResolvedValue({ data: { outcome }, error: null });
  expect(await gateway().finalizeRun(args)).toEqual({ kind: outcome });
  expect(io.rpc).toHaveBeenCalledTimes(1);
});
it("does not expose sensitive database diagnostics or retry when commit status is unknown", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    io.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "PRIVATE fixture report" } });
    await expect(gateway().finalizeRun(args)).rejects.toThrow("Do not retry the provider call");
    expect(io.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
  } finally { log.mockRestore(); }
});
it("missing atomic RPC fails closed without a split-RPC compatibility fallback", async () => {
  io.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  await expect(gateway().finalizeRun(args)).rejects.toMatchObject({ name: "CareerIntelligenceUnavailableError" });
  expect(io.rpc).toHaveBeenCalledTimes(1);
});
it.each([null, {}, { outcome: "finalized" }, { outcome: "unknown" }])("unrecognized response %j cannot report success", async (data) => {
  io.rpc.mockResolvedValue({ data, error: null });
  await expect(gateway().finalizeRun(args)).rejects.toThrow("could not be confirmed");
  expect(io.rpc).toHaveBeenCalledTimes(1);
});
it("never finalizes through the user's own session client", async () => {
  io.rpc.mockResolvedValue({ data: { outcome: "finalized", draft_id: "offline-draft" }, error: null });
  await gateway().finalizeRun(args);
  expect(io.sessionRpc).not.toHaveBeenCalled();
});
it("refuses without an authenticated staff session and never calls the trusted RPC", async () => {
  io.admin.mockResolvedValue(null);
  await expect(gateway().finalizeRun(args)).rejects.toThrow("could not be confirmed");
  expect(io.rpc).not.toHaveBeenCalled();
});
it("fails closed when the trusted server identity is not configured", async () => {
  io.trustedConfigured = false;
  await expect(gateway().finalizeRun(args)).rejects.toMatchObject({ name: "CareerIntelligenceUnavailableError" });
});
it("denies a reservation before any provider call when trusted finalization is unavailable", async () => {
  io.trustedConfigured = false;
  const r = await gateway().reserveRun({} as Parameters<CareerIntelligenceGateway["reserveRun"]>[0]);
  expect(r.kind).toBe("denied");
  expect(io.sessionRpc).not.toHaveBeenCalled();
});
