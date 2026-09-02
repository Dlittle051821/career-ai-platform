import { describe, expect, it } from "vitest";
import {
  validateAssignCounsellor,
  validateBookDiscoverySession,
  validateCancelDiscoverySession,
  validateSaveDiscoverySessionWorkspace,
  validateScheduleDiscoverySession,
} from "./rules";

describe("discovery-sessions/rules", () => {
  describe("validateBookDiscoverySession", () => {
    it("rejects an unauthenticated visitor", () => {
      const result = validateBookDiscoverySession({ isAuthenticated: false, hasActiveSession: false });
      expect(result.ok).toBe(false);
    });

    it("rejects a student who already has an active session", () => {
      const result = validateBookDiscoverySession({ isAuthenticated: true, hasActiveSession: true });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/already have/i);
    });

    it("accepts a signed-in student with no active session", () => {
      expect(validateBookDiscoverySession({ isAuthenticated: true, hasActiveSession: false })).toEqual({ ok: true });
    });
  });

  describe("validateAssignCounsellor", () => {
    it("rejects without permission", () => {
      expect(validateAssignCounsellor({ hasPermission: false, sessionExists: true, status: "requested" }).ok).toBe(false);
    });

    it("rejects a missing session", () => {
      expect(validateAssignCounsellor({ hasPermission: true, sessionExists: false, status: null }).ok).toBe(false);
    });

    it.each(["cancelled", "completed", "no_show"] as const)("rejects assignment when status is %s", (status) => {
      expect(validateAssignCounsellor({ hasPermission: true, sessionExists: true, status }).ok).toBe(false);
    });

    it.each(["requested", "scheduled"] as const)("accepts assignment when status is %s", (status) => {
      expect(validateAssignCounsellor({ hasPermission: true, sessionExists: true, status })).toEqual({ ok: true });
    });
  });

  describe("validateScheduleDiscoverySession", () => {
    const base = {
      hasPermission: true,
      sessionExists: true,
      status: "requested" as const,
      hasAssignedCounsellor: true,
      scheduledAt: "2026-09-10T10:00:00Z",
    };

    it("accepts a fully valid schedule request", () => {
      expect(validateScheduleDiscoverySession(base)).toEqual({ ok: true });
    });

    it("rejects without an assigned counsellor", () => {
      const result = validateScheduleDiscoverySession({ ...base, hasAssignedCounsellor: false });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/assign a counsellor/i);
    });

    it("rejects without a scheduledAt", () => {
      const result = validateScheduleDiscoverySession({ ...base, scheduledAt: null });
      expect(result.ok).toBe(false);
    });

    it.each(["completed", "cancelled", "no_show"] as const)("rejects scheduling when status is already %s", (status) => {
      expect(validateScheduleDiscoverySession({ ...base, status }).ok).toBe(false);
    });
  });

  describe("validateCancelDiscoverySession", () => {
    it("accepts cancelling a requested session", () => {
      expect(validateCancelDiscoverySession({ hasPermission: true, sessionExists: true, status: "requested" })).toEqual({ ok: true });
    });

    it.each(["completed", "cancelled", "no_show"] as const)("rejects cancelling a %s session", (status) => {
      expect(validateCancelDiscoverySession({ hasPermission: true, sessionExists: true, status }).ok).toBe(false);
    });

    it("rejects without permission", () => {
      expect(validateCancelDiscoverySession({ hasPermission: false, sessionExists: true, status: "requested" }).ok).toBe(false);
    });
  });

  describe("validateSaveDiscoverySessionWorkspace", () => {
    it.each(["requested", "scheduled", "completed", "no_show"] as const)("accepts editing when status is %s", (status) => {
      expect(validateSaveDiscoverySessionWorkspace({ hasPermission: true, sessionExists: true, status })).toEqual({ ok: true });
    });

    it("rejects editing a cancelled session's workspace", () => {
      const result = validateSaveDiscoverySessionWorkspace({ hasPermission: true, sessionExists: true, status: "cancelled" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/cancelled/i);
    });

    it("rejects without permission", () => {
      expect(validateSaveDiscoverySessionWorkspace({ hasPermission: false, sessionExists: true, status: "requested" }).ok).toBe(false);
    });

    it("rejects a missing session", () => {
      expect(validateSaveDiscoverySessionWorkspace({ hasPermission: true, sessionExists: false, status: null }).ok).toBe(false);
    });
  });
});
