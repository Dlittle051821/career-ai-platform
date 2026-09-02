import { describe, expect, it } from "vitest";
import { validateRequestStamp, validateRetryStampRequest, validateCancelStampRequest, type RequestStampInput } from "./rules";
import type { StampRequestStatus } from "@/types/stamping";

function baseRequest(overrides: Partial<RequestStampInput> = {}): RequestStampInput {
  return {
    hasPermission: true,
    agreementExists: true,
    agreementStatus: "draft",
    sequence: "STAMP_THEN_SIGN",
    signatureRequiredFirstButMissing: false,
    version: { status: "locked" },
    hasActiveRequestForVersion: false,
    ...overrides,
  };
}

describe("stamping/rules — validateRequestStamp", () => {
  it("accepts a fully valid input", () => {
    expect(validateRequestStamp(baseRequest())).toEqual({ ok: true });
  });

  it("accepts STAMP_ONLY", () => {
    expect(validateRequestStamp(baseRequest({ sequence: "STAMP_ONLY" })).ok).toBe(true);
  });

  it("accepts a draft version — a draft version is valid for stamping (it gets locked atomically)", () => {
    expect(validateRequestStamp(baseRequest({ version: { status: "draft" } })).ok).toBe(true);
  });

  it("rejects without permission", () => {
    expect(validateRequestStamp(baseRequest({ hasPermission: false })).ok).toBe(false);
  });

  it("rejects when the agreement does not exist", () => {
    const result = validateRequestStamp(baseRequest({ agreementExists: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not found/i);
  });

  it("rejects when the agreement is cancelled", () => {
    expect(validateRequestStamp(baseRequest({ agreementStatus: "cancelled" })).ok).toBe(false);
  });

  it('rejects when no stamp/sign sequence is configured (sequence: null), with the exact spec-required message', () => {
    const result = validateRequestStamp(baseRequest({ sequence: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("Electronic stamping is not configured for this agreement.");
  });

  it("rejects SIGN_ONLY — stamping does not apply", () => {
    const result = validateRequestStamp(baseRequest({ sequence: "SIGN_ONLY" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/signature only/i);
  });

  it("rejects SIGN_THEN_STAMP when the agreement is not yet signed", () => {
    const result = validateRequestStamp(baseRequest({ sequence: "SIGN_THEN_STAMP", signatureRequiredFirstButMissing: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/before stamping/i);
  });

  it("accepts SIGN_THEN_STAMP once already signed", () => {
    expect(validateRequestStamp(baseRequest({ sequence: "SIGN_THEN_STAMP", signatureRequiredFirstButMissing: false })).ok).toBe(true);
  });

  it("rejects when there is no version (null)", () => {
    const result = validateRequestStamp(baseRequest({ version: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/version/i);
  });

  it("rejects a duplicate active request for the same version", () => {
    const result = validateRequestStamp(baseRequest({ hasActiveRequestForVersion: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already has an active/i);
  });

  it("checks permission before agreement existence (fails fast on the first violated precondition)", () => {
    const result = validateRequestStamp(baseRequest({ hasPermission: false, agreementExists: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/permission/i);
  });
});

describe("stamping/rules — validateRetryStampRequest", () => {
  const retryable: StampRequestStatus[] = ["failed", "cancelled", "expired"];
  for (const status of retryable) {
    it(`accepts retry from "${status}"`, () => {
      expect(validateRetryStampRequest({ hasPermission: true, requestExists: true, status, hasActiveRequestForVersion: false }).ok).toBe(true);
    });
  }

  const notRetryable: StampRequestStatus[] = ["draft", "pending", "processing", "completed"];
  for (const status of notRetryable) {
    it(`rejects retry from "${status}"`, () => {
      expect(validateRetryStampRequest({ hasPermission: true, requestExists: true, status, hasActiveRequestForVersion: false }).ok).toBe(false);
    });
  }

  it("rejects without permission", () => {
    expect(validateRetryStampRequest({ hasPermission: false, requestExists: true, status: "failed", hasActiveRequestForVersion: false }).ok).toBe(false);
  });

  it("rejects when the request does not exist", () => {
    expect(validateRetryStampRequest({ hasPermission: true, requestExists: false, status: null, hasActiveRequestForVersion: false }).ok).toBe(false);
  });

  it("rejects retry when an active request already exists for the version", () => {
    expect(validateRetryStampRequest({ hasPermission: true, requestExists: true, status: "failed", hasActiveRequestForVersion: true }).ok).toBe(false);
  });
});

describe("stamping/rules — validateCancelStampRequest", () => {
  const cancellable: StampRequestStatus[] = ["draft", "pending", "processing"];
  for (const status of cancellable) {
    it(`accepts cancel from "${status}"`, () => {
      expect(validateCancelStampRequest({ hasPermission: true, requestExists: true, status }).ok).toBe(true);
    });
  }

  it("rejects cancel from completed, with an explicit message", () => {
    const result = validateCancelStampRequest({ hasPermission: true, requestExists: true, status: "completed" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already completed/i);
  });

  const otherTerminal: StampRequestStatus[] = ["failed", "cancelled", "expired"];
  for (const status of otherTerminal) {
    it(`rejects cancel from "${status}"`, () => {
      expect(validateCancelStampRequest({ hasPermission: true, requestExists: true, status }).ok).toBe(false);
    });
  }

  it("rejects without permission", () => {
    expect(validateCancelStampRequest({ hasPermission: false, requestExists: true, status: "pending" }).ok).toBe(false);
  });

  it("rejects when the request does not exist", () => {
    expect(validateCancelStampRequest({ hasPermission: true, requestExists: false, status: null }).ok).toBe(false);
  });
});
