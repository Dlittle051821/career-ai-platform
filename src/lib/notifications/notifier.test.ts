import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoggingNotifier, redactNotificationData, NOTIFICATION_TEMPLATES } from "./notifier";

describe("notifications/notifier — redactNotificationData", () => {
  it("passes through ordinary keys unchanged", () => {
    expect(redactNotificationData({ agreementType: "Counselling Services Agreement", signerName: "Asha" })).toEqual({
      agreementType: "Counselling Services Agreement",
      signerName: "Asha",
    });
  });

  it("redacts keys that look sensitive", () => {
    const result = redactNotificationData({ token: "abc", apiKey: "xyz", password: "hunter2", note: "fine" });
    expect(result.token).toBe("[redacted]");
    expect(result.apiKey).toBe("[redacted]");
    expect(result.password).toBe("[redacted]");
    expect(result.note).toBe("fine");
  });

  it("is case-insensitive", () => {
    expect(redactNotificationData({ SECRET_VALUE: "x" }).SECRET_VALUE).toBe("[redacted]");
  });

  it("never throws on an empty object", () => {
    expect(redactNotificationData({})).toEqual({});
  });
});

describe("notifications/notifier — LoggingNotifier", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("never throws for any implemented template", async () => {
    const notifier = new LoggingNotifier();
    for (const template of NOTIFICATION_TEMPLATES) {
      await expect(notifier.notify({ to: "student@example.com", template, data: {} })).resolves.toBeUndefined();
    }
  });

  it("logs a line mentioning the template and recipient in development", async () => {
    // @types/node marks process.env.NODE_ENV specifically as readonly; this
    // cast is test-only plumbing so this test can restore it afterward.
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    // vitest sets NODE_ENV to "test" by default — this test doesn't need
    // to force it, just verify it isn't the production (quiet) branch.
    const notifier = new LoggingNotifier();
    await notifier.notify({ to: "student@example.com", template: "signature_requested", data: { agreementId: "a-1" } });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [line] = warnSpy.mock.calls[0] as unknown[];
    expect(String(line)).toContain("signature_requested");
    expect(String(line)).toContain("student@example.com");
    env.NODE_ENV = originalEnv;
  });

  it("redacts sensitive-looking data keys before logging", async () => {
    const notifier = new LoggingNotifier();
    await notifier.notify({ to: "student@example.com", template: "signature_requested", data: { token: "should-not-appear-raw" } });
    const call = warnSpy.mock.calls[0] as unknown[];
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain("should-not-appear-raw");
  });

  it("never throws even if console.warn itself throws", async () => {
    warnSpy.mockImplementation(() => {
      throw new Error("logging backend down");
    });
    const notifier = new LoggingNotifier();
    await expect(notifier.notify({ to: "x@example.com", template: "signature_completed", data: {} })).resolves.toBeUndefined();
  });
});
