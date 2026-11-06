import { describe, expect, it, vi } from "vitest";
import { checkKeyFormat, ClipboardError, normaliseKey, takeKeyFromClipboard, verifyKeyWithProject, type PsRunner } from "./supabase-key-input";
import { checkQaTarget, KNOWN_PRODUCTION_REFS, QA_PROJECT_REF, refFromSupabaseUrl } from "./qa-db/qa-project";

// Fictional credentials and injected I/O only: no clipboard, child process or network.
const FAKE_KEY = "sb_secret_FICTIONAL_TEST_ONLY_123456789";

describe("recovered NW09 helper boundaries", () => {
  it("accepts only the configured QA target and rejects production, unknown and missing targets", () => {
    expect(checkQaTarget(QA_PROJECT_REF)).toEqual({ ok: true });
    for (const ref of [...KNOWN_PRODUCTION_REFS, "z".repeat(20), null]) {
      expect(checkQaTarget(ref).ok).toBe(false);
    }
  });

  it("recognizes exact Supabase URLs and rejects lookalike hosts", () => {
    expect(refFromSupabaseUrl(`https://${QA_PROJECT_REF}.supabase.co/`)).toBe(QA_PROJECT_REF);
    expect(refFromSupabaseUrl(`https://${QA_PROJECT_REF}.supabase.co.evil.test`)).toBeNull();
    expect(refFromSupabaseUrl(undefined)).toBeNull();
  });

  it("normalizes pasted keys and rejects public, malformed and wrong-project JWT keys", () => {
    expect(normaliseKey(`SUPABASE_SERVICE_ROLE_KEY="${FAKE_KEY}"\r\n`)).toBe(FAKE_KEY);
    expect(checkKeyFormat(FAKE_KEY, QA_PROJECT_REF).ok).toBe(true);
    const payload = Buffer.from(JSON.stringify({ role: "service_role", ref: "z".repeat(20) })).toString("base64url");
    for (const key of ["sb_publishable_FICTIONAL", "sb_secret_short", `e30.${payload}.ZmFrZQ`]) {
      const result = checkKeyFormat(key, QA_PROJECT_REF);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).not.toContain(key);
    }
  });

  it("reads and clears only an injected clipboard without putting the key in command text", () => {
    let clipboard = FAKE_KEY;
    const run = vi.fn<PsRunner>((command) => {
      if (command.includes("Get-Clipboard")) return { status: 0, stdout: clipboard };
      clipboard = "";
      return { status: 0, stdout: "" };
    });
    expect(takeKeyFromClipboard(run, "win32")).toEqual({ key: FAKE_KEY, cleared: true });
    expect(clipboard).toBe("");
    for (const [command] of run.mock.calls) expect(command).not.toContain(FAKE_KEY);
  });

  it("clears the injected clipboard even when reading fails", () => {
    const run = vi.fn<PsRunner>(() => ({ status: 1, stdout: "" }));
    expect(() => takeKeyFromClipboard(run, "win32")).toThrow(ClipboardError);
    expect(run.mock.calls.some(([command]) => command.includes("Clear()"))).toBe(true);
  });

  it("refuses clipboard access on unsupported platforms without invoking I/O", () => {
    const run = vi.fn<PsRunner>();
    expect(() => takeKeyFromClipboard(run, "linux")).toThrow(ClipboardError);
    expect(run).not.toHaveBeenCalled();
  });

  it("verifies through an injected read-only request", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }));
    await expect(verifyKeyWithProject("https://qa.example.test/", FAKE_KEY, fetchImpl)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://qa.example.test/auth/v1/admin/users?page=1&per_page=1", {
      method: "GET", headers: { apikey: FAKE_KEY, Authorization: `Bearer ${FAKE_KEY}` },
    });
  });

  it("does not expose credentials or raw request errors in verification failures", async () => {
    const rejected = await verifyKeyWithProject("https://qa.example.test", FAKE_KEY, async () => ({ status: 403 }));
    const offline = await verifyKeyWithProject("https://qa.example.test", FAKE_KEY, async () => { throw new Error(FAKE_KEY); });
    for (const result of [rejected, offline]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).not.toContain(FAKE_KEY);
    }
  });
});
