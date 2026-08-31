import { describe, expect, it } from "vitest";
import { validateSendForSignature, validateResendSignatureRequest, validateCancelSignatureRequest, type SendForSignatureInput } from "./rules";
import type { SignatureRequestStatus } from "@/types/signatures";

function baseSend(overrides: Partial<SendForSignatureInput> = {}): SendForSignatureInput {
  return {
    hasPermission: true,
    agreementExists: true,
    agreementStatus: "draft",
    agreementSignatureStatus: "not_started",
    version: { status: "draft" },
    signerName: "Asha Verma",
    signerEmail: "asha@example.com",
    hasActiveRequestForVersion: false,
    ...overrides,
  };
}

describe("signatures/rules — validateSendForSignature", () => {
  it("accepts a fully valid input", () => {
    expect(validateSendForSignature(baseSend())).toEqual({ ok: true });
  });

  it("rejects without permission", () => {
    const result = validateSendForSignature(baseSend({ hasPermission: false }));
    expect(result.ok).toBe(false);
  });

  it("rejects when the agreement does not exist", () => {
    const result = validateSendForSignature(baseSend({ agreementExists: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not found/i);
  });

  it("rejects when the agreement is already signed", () => {
    const result = validateSendForSignature(baseSend({ agreementSignatureStatus: "signed" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already signed/i);
  });

  it("rejects when the agreement is cancelled", () => {
    const result = validateSendForSignature(baseSend({ agreementStatus: "cancelled" }));
    expect(result.ok).toBe(false);
  });

  it("rejects when there is no version (null)", () => {
    const result = validateSendForSignature(baseSend({ version: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/version/i);
  });

  it("rejects when the version is not draft (e.g. locked)", () => {
    const result = validateSendForSignature(baseSend({ version: { status: "locked" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/locked/i);
  });

  it("rejects a missing signer name", () => {
    expect(validateSendForSignature(baseSend({ signerName: "" })).ok).toBe(false);
    expect(validateSendForSignature(baseSend({ signerName: "   " })).ok).toBe(false);
    expect(validateSendForSignature(baseSend({ signerName: null })).ok).toBe(false);
    expect(validateSendForSignature(baseSend({ signerName: undefined })).ok).toBe(false);
  });

  it("rejects a missing or invalid signer email", () => {
    expect(validateSendForSignature(baseSend({ signerEmail: "" })).ok).toBe(false);
    expect(validateSendForSignature(baseSend({ signerEmail: "not-an-email" })).ok).toBe(false);
    expect(validateSendForSignature(baseSend({ signerEmail: "missing-at.example.com" })).ok).toBe(false);
    expect(validateSendForSignature(baseSend({ signerEmail: null })).ok).toBe(false);
  });

  it("accepts a valid email with a plus tag and subdomain", () => {
    expect(validateSendForSignature(baseSend({ signerEmail: "a.b+tag@mail.example.co.in" })).ok).toBe(true);
  });

  it("rejects a duplicate active request for the same version", () => {
    const result = validateSendForSignature(baseSend({ hasActiveRequestForVersion: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already has an active/i);
  });

  it("checks permission before agreement existence (fails fast on the first violated precondition)", () => {
    const result = validateSendForSignature(baseSend({ hasPermission: false, agreementExists: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/permission/i);
  });
});

describe("signatures/rules — validateResendSignatureRequest", () => {
  it("accepts sent and viewed", () => {
    expect(validateResendSignatureRequest({ hasPermission: true, requestExists: true, status: "sent" }).ok).toBe(true);
    expect(validateResendSignatureRequest({ hasPermission: true, requestExists: true, status: "viewed" }).ok).toBe(true);
  });

  it("rejects without permission", () => {
    expect(validateResendSignatureRequest({ hasPermission: false, requestExists: true, status: "sent" }).ok).toBe(false);
  });

  it("rejects when the request does not exist", () => {
    expect(validateResendSignatureRequest({ hasPermission: true, requestExists: false, status: null }).ok).toBe(false);
  });

  const terminalOrPreSend: SignatureRequestStatus[] = ["draft", "pending", "signed", "declined", "cancelled", "expired", "failed"];
  for (const status of terminalOrPreSend) {
    it(`rejects resend from "${status}"`, () => {
      const result = validateResendSignatureRequest({ hasPermission: true, requestExists: true, status });
      expect(result.ok).toBe(false);
    });
  }
});

describe("signatures/rules — validateCancelSignatureRequest", () => {
  const cancellable: SignatureRequestStatus[] = ["draft", "pending", "sent", "viewed"];
  for (const status of cancellable) {
    it(`accepts cancel from "${status}"`, () => {
      expect(validateCancelSignatureRequest({ hasPermission: true, requestExists: true, status }).ok).toBe(true);
    });
  }

  it("rejects cancel from signed, with an explicit message", () => {
    const result = validateCancelSignatureRequest({ hasPermission: true, requestExists: true, status: "signed" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already been signed/i);
  });

  const otherTerminal: SignatureRequestStatus[] = ["declined", "cancelled", "expired", "failed"];
  for (const status of otherTerminal) {
    it(`rejects cancel from "${status}"`, () => {
      expect(validateCancelSignatureRequest({ hasPermission: true, requestExists: true, status }).ok).toBe(false);
    });
  }

  it("rejects without permission", () => {
    expect(validateCancelSignatureRequest({ hasPermission: false, requestExists: true, status: "sent" }).ok).toBe(false);
  });

  it("rejects when the request does not exist", () => {
    expect(validateCancelSignatureRequest({ hasPermission: true, requestExists: false, status: null }).ok).toBe(false);
  });
});
