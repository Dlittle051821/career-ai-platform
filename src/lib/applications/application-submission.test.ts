import { describe, expect, it } from "vitest";
import {
  APPLICATION_SUBMISSION_METHODS,
  APPLICATION_SUBMISSION_METHOD_LABELS,
  isApplicationSubmissionMethod,
  isValidApplicationSubmissionUrl,
  getApplicationSubmissionReadiness,
  type ApplicationSubmissionReadinessInput,
} from "./application-submission";
import type { ApplicationReadiness } from "./application-readiness";

const READY_M18: ApplicationReadiness = { isReady: true, blockers: [] };
const NOT_READY_M18: ApplicationReadiness = {
  isReady: false,
  blockers: [{ reason: "documents_missing", message: "1 required document still missing." }],
};

function baseInput(overrides: Partial<ApplicationSubmissionReadinessInput> = {}): ApplicationSubmissionReadinessInput {
  return {
    stage: "ready_to_submit",
    applicationReadiness: READY_M18,
    hasExistingSubmission: false,
    ...overrides,
  };
}

describe("APPLICATION_SUBMISSION_METHODS / labels", () => {
  it("is the fixed five-value vocabulary the migration's own CHECK constraint hardcodes", () => {
    expect(APPLICATION_SUBMISSION_METHODS).toEqual(["university_portal", "centralized_platform", "email", "agent_partner", "other"]);
  });

  it("has a label for every method, with no extras", () => {
    for (const method of APPLICATION_SUBMISSION_METHODS) {
      expect(APPLICATION_SUBMISSION_METHOD_LABELS[method]).toBeTruthy();
    }
    expect(Object.keys(APPLICATION_SUBMISSION_METHOD_LABELS)).toHaveLength(APPLICATION_SUBMISSION_METHODS.length);
  });

  it("isApplicationSubmissionMethod() rejects an arbitrary/forged string", () => {
    expect(isApplicationSubmissionMethod("university_portal")).toBe(true);
    expect(isApplicationSubmissionMethod("agent_commission_engine")).toBe(false);
    expect(isApplicationSubmissionMethod("")).toBe(false);
  });
});

describe("isValidApplicationSubmissionUrl()", () => {
  it("accepts a plausible http(s) URL", () => {
    expect(isValidApplicationSubmissionUrl("https://apply.example.edu/status/123")).toBe(true);
    expect(isValidApplicationSubmissionUrl("http://portal.example.com")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidApplicationSubmissionUrl("")).toBe(false);
  });

  it("rejects a URL with no recognized scheme", () => {
    expect(isValidApplicationSubmissionUrl("apply.example.edu/status/123")).toBe(false);
    expect(isValidApplicationSubmissionUrl("javascript:alert(1)")).toBe(false);
    expect(isValidApplicationSubmissionUrl("ftp://example.com")).toBe(false);
  });

  it("rejects a URL longer than 500 characters", () => {
    expect(isValidApplicationSubmissionUrl(`https://example.com/${"a".repeat(490)}`)).toBe(false);
  });
});

describe("getApplicationSubmissionReadiness() — the M19 final gate", () => {
  it("is ready when the stage is ready_to_submit, M18 readiness passes, and no submission exists yet", () => {
    const result = getApplicationSubmissionReadiness(baseInput());
    expect(result.isReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks on stage_not_ready_to_submit for a stage M18 itself would call 'ready' (e.g. 'preparing') — this is the deliberate M19 narrowing beyond M18's own broader appropriate-stage set", () => {
    const result = getApplicationSubmissionReadiness(baseInput({ stage: "preparing" }));
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("stage_not_ready_to_submit");
  });

  it("blocks on stage_not_ready_to_submit for every non-'ready_to_submit' stage, including 'submitted' itself", () => {
    for (const stage of ["inquiry", "preparing", "submitted", "under_review", "withdrawn"] as const) {
      const result = getApplicationSubmissionReadiness(baseInput({ stage }));
      expect(result.blockers.map((b) => b.reason)).toContain("stage_not_ready_to_submit");
    }
  });

  it("composes (never duplicates) M18's own readiness result — a caller-supplied isReady:false always blocks, regardless of what its own blockers say", () => {
    const result = getApplicationSubmissionReadiness(baseInput({ applicationReadiness: NOT_READY_M18 }));
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("operational_readiness_incomplete");
  });

  it("blocks on already_submitted once a submission has been recorded, even when every other signal is satisfied", () => {
    const result = getApplicationSubmissionReadiness(baseInput({ hasExistingSubmission: true }));
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.reason)).toContain("already_submitted");
  });

  it("can report multiple blockers simultaneously — never hides one behind another", () => {
    const result = getApplicationSubmissionReadiness({ stage: "preparing", applicationReadiness: NOT_READY_M18, hasExistingSubmission: true });
    expect(result.blockers.map((b) => b.reason).sort()).toEqual(["already_submitted", "operational_readiness_incomplete", "stage_not_ready_to_submit"]);
  });

  it("is a pure function — same input always yields the same output", () => {
    const input = baseInput();
    expect(getApplicationSubmissionReadiness(input)).toEqual(getApplicationSubmissionReadiness(input));
  });
});
