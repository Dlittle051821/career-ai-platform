import { describe, expect, it } from "vitest";
import { buildAuditSummary, buildChangeSet, redactSensitiveFields, summarizeFieldChange } from "./audit";

describe("redactSensitiveFields", () => {
  it("redacts a top-level key matching a sensitive pattern", () => {
    const result = redactSensitiveFields({ password: "hunter2", name: "Ada" }) as Record<string, unknown>;
    expect(result.password).toBe("[redacted]");
    expect(result.name).toBe("Ada");
  });

  it("redacts nested sensitive keys", () => {
    const result = redactSensitiveFields({ user: { apiKey: "sk-123", email: "a@b.com" } }) as {
      user: Record<string, unknown>;
    };
    expect(result.user.apiKey).toBe("[redacted]");
    expect(result.user.email).toBe("a@b.com");
  });

  it("redacts common payment-credential-shaped keys", () => {
    const result = redactSensitiveFields({ cardNumber: "4111111111111111", cvv: "123", amount: 500 }) as Record<
      string,
      unknown
    >;
    expect(result.cardNumber).toBe("[redacted]");
    expect(result.cvv).toBe("[redacted]");
    expect(result.amount).toBe(500);
  });

  it("redacts a service-role-shaped key", () => {
    const result = redactSensitiveFields({ serviceRoleKey: "eyJ..." }) as Record<string, unknown>;
    expect(result.serviceRoleKey).toBe("[redacted]");
  });

  it("redacts inside arrays of objects", () => {
    const result = redactSensitiveFields([{ token: "abc" }, { name: "ok" }]) as Record<string, unknown>[];
    expect(result[0].token).toBe("[redacted]");
    expect(result[1].name).toBe("ok");
  });

  it("passes through primitives unchanged", () => {
    expect(redactSensitiveFields("hello")).toBe("hello");
    expect(redactSensitiveFields(42)).toBe(42);
    expect(redactSensitiveFields(null)).toBeNull();
  });
});

describe("buildChangeSet", () => {
  it("redacts both before and after independently", () => {
    const result = buildChangeSet({ password: "old" }, { password: "new", name: "Ada" });
    expect(result.before?.password).toBe("[redacted]");
    expect(result.after?.password).toBe("[redacted]");
    expect(result.after?.name).toBe("Ada");
  });

  it("omits before/after keys entirely when not provided, rather than storing undefined", () => {
    const result = buildChangeSet(undefined, { status: "paid" });
    expect(result.before).toBeUndefined();
    expect(result.after).toEqual({ status: "paid" });
  });
});

describe("summarizeFieldChange", () => {
  it("formats a normal change", () => {
    expect(summarizeFieldChange("status", "pending", "paid")).toBe("status: pending -> paid");
  });

  it("renders null/undefined/empty-string as (none) rather than omitting them", () => {
    expect(summarizeFieldChange("notes", null, "hello")).toBe("notes: (none) -> hello");
    expect(summarizeFieldChange("notes", "hello", "")).toBe("notes: hello -> (none)");
  });
});

describe("buildAuditSummary", () => {
  it("joins field changes into one summary line", () => {
    const summary = buildAuditSummary("Updated", "payment #123", ["status: pending -> paid"]);
    expect(summary).toBe("Updated payment #123 — status: pending -> paid");
  });

  it("caps the number of field changes shown and notes how many more there were", () => {
    const changes = Array.from({ length: 8 }, (_, i) => `field${i}: a -> b`);
    const summary = buildAuditSummary("Updated", "record", changes);
    expect(summary).toContain("+3 more");
  });

  it("produces a plain summary with no trailing separator when there are no field changes", () => {
    expect(buildAuditSummary("Created", "lead #9", [])).toBe("Created lead #9");
  });
});
