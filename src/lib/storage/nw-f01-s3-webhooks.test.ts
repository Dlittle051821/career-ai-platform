import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { documentFilename } from "./document-filename";
const m = vi.hoisted(() => ({
  publicRpc: vi.fn(), serviceRpc: vi.fn(), configured: vi.fn(),
  verify: vi.fn(), document: vi.fn(), upload: vi.fn(), service: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: m.publicRpc }) }));
vi.mock("@/lib/supabase/service-role", () => ({ getServiceRoleClient: m.service }));
vi.mock("@/lib/signatures/config", () => ({ isSignatureWebhookConfigured: m.configured }));
vi.mock("@/lib/stamping/config", () => ({ isStampWebhookConfigured: m.configured }));
vi.mock("@/lib/signatures/get-provider", () => ({ getSignatureProvider: () => ({ verifyWebhook: m.verify, getSignedDocument: m.document }) }));
vi.mock("@/lib/stamping/get-provider", () => ({ getStampProvider: () => ({ verifyWebhook: m.verify, retrieveStampedDocument: m.document }) }));
vi.mock("@/lib/storage/signed-documents", () => ({
  uploadSignedDocument: m.upload, buildSignedDocumentStoragePath: () => "agreement/request/document.pdf",
}));
vi.mock("@/lib/storage/stamped-documents", () => ({
  uploadStampedDocument: m.upload, buildStampedDocumentStoragePath: () => "agreement/request/document.pdf",
}));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn(async () => {}) }));
import { POST as signature } from "@/app/api/webhooks/signature/route";
import { POST as stamp } from "@/app/api/webhooks/stamp/route";
import { recordVerifiedDocumentPath } from "./verified-document-path";
beforeEach(() => {
  vi.clearAllMocks();
  m.configured.mockReturnValue(true); m.verify.mockReturnValue(true);
  m.document.mockResolvedValue({ fileName: "document.pdf", bytes: new Uint8Array([1]), contentType: "application/pdf" });
  m.upload.mockResolvedValue({ ok: true }); m.serviceRpc.mockResolvedValue({ error: null });
  m.service.mockReturnValue({ rpc: m.serviceRpc });
});
const request = () => new Request("https://offline.invalid/webhook", {
  method: "POST", body: '{"offline":"fixture"}',
  headers: { "x-signature": "offline-valid", authorization: "Bearer untrusted-user", cookie: "untrusted=session" },
});
for (const [kind, post, terminal] of [["signature", signature, "signed"], ["stamp", stamp, "completed"]] as const) {
  const result = () => ({
    valid: true, processing_status: "processed", status: terminal, provider: "mock",
    provider_request_id: "provider-request", agreement_id: "agreement",
    signature_request_id: "request", stamp_request_id: "request",
  });
  describe(kind + " coordinated trusted capture", () => {
    it("keeps verified status processing and uses the cookie-free service client for capture only", async () => {
      m.publicRpc.mockResolvedValue({ data: result(), error: null });
      expect((await post(request())).status).toBe(200);
      expect(m.publicRpc).toHaveBeenCalledTimes(1);
      expect(m.publicRpc.mock.calls[0][0]).toBe("apply_" + kind + "_webhook_event");
      expect(m.serviceRpc).toHaveBeenCalledWith("set_" + kind + "_document_path", {
        p_provider: "mock", p_provider_request_id: "provider-request", p_storage_path: "agreement/request/document.pdf",
      });
      expect(m.service).toHaveBeenCalledWith();
    });
    it("rejects an invalid provider signature before either database path", async () => {
      m.verify.mockReturnValue(false);
      expect((await post(request())).status).toBe(400);
      expect(m.publicRpc).not.toHaveBeenCalled(); expect(m.service).not.toHaveBeenCalled();
    });
    it("does not capture when the database independently rejects the signature", async () => {
      m.publicRpc.mockResolvedValue({ data: { valid: false, reason: "invalid_signature" }, error: null });
      expect((await post(request())).status).toBe(400);
      expect(m.upload).not.toHaveBeenCalled(); expect(m.service).not.toHaveBeenCalled();
    });
    it("does not mistake an incomplete/ignored response for verified permission to capture", async () => {
      m.publicRpc.mockResolvedValue({ data: { ...result(), valid: undefined }, error: null });
      await post(request()); expect(m.service).not.toHaveBeenCalled();
      m.publicRpc.mockResolvedValue({ data: { ...result(), processing_status: "ignored" }, error: null });
      await post(request()); expect(m.service).not.toHaveBeenCalled();
    });
    it("duplicate deliveries do not repeat document updates", async () => {
      m.publicRpc.mockResolvedValue({ data: { ...result(), duplicate: true }, error: null });
      expect((await post(request())).status).toBe(200);
      expect(m.upload).not.toHaveBeenCalled(); expect(m.service).not.toHaveBeenCalled();
    });
    it("missing service configuration preserves the successful provider status", async () => {
      m.publicRpc.mockResolvedValue({ data: result(), error: null }); m.service.mockReturnValue(null);
      expect((await post(request())).status).toBe(200); expect(m.serviceRpc).not.toHaveBeenCalled();
    });
    it("upload failure does not set a pointer or roll back the provider event", async () => {
      m.publicRpc.mockResolvedValue({ data: result(), error: null }); m.upload.mockResolvedValue({ ok: false, error: "offline upload failed" });
      expect((await post(request())).status).toBe(200); expect(m.service).not.toHaveBeenCalled();
    });
  });
}
it("capture errors return no sensitive SDK detail", async () => {
  m.serviceRpc.mockResolvedValue({ error: { message: "sensitive offline detail" } });
  expect(await recordVerifiedDocumentPath("signature", { provider: "mock", providerRequestId: "r", storagePath: "a/b/c" }))
    .toEqual({ ok: false, error: "document_path_not_recorded" });
});
it("service client never reads request cookies or forwards user Authorization", () => {
  const source = readFileSync("src/lib/supabase/service-role.ts", "utf8");
  expect(source).toMatch(/^import "server-only"/);
  expect(source).not.toMatch(/cookies\(|headers\(|Authorization/);
  expect(source).toContain("persistSession: false"); expect(source).toContain("autoRefreshToken: false");
});
it.each(["", ".", "..", "../../file.pdf", "-hidden.pdf", "/foo/bar.pdf", "a".repeat(300)])("canonical filename %s stays one bounded segment", (name) => {
  const filename = documentFilename(name);
  expect(filename).toMatch(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,199}$/);
});
it("consent read and withdrawal share the reservation lock before reading consent", () => {
  const sql = readFileSync("supabase/migrations-proposed/nw-f01-s3/02_nw09_2_replacement.sql", "utf8");
  for (const name of ["staff_withdraw_ai_processing_consent", "staff_reserve_ai_generation_run_v2"]) {
    const start = sql.indexOf("create or replace function public." + name + "(");
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    expect(body.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(0);
    const read = body.indexOf("select * into v_", body.indexOf("begin"));
    expect(read).toBeGreaterThan(body.indexOf("pg_advisory_xact_lock"));
  }
});
