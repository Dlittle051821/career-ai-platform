import { describe, expect, it } from "vitest";
import { ADMIN_ROLES } from "@/types/admin";
import { hasAnyPermission, hasPermission, isKnownAdminRole, ROLE_PERMISSIONS } from "./permissions";

describe("ROLE_PERMISSIONS", () => {
  it("gives super_admin every permission, including roles:manage", () => {
    expect(ROLE_PERMISSIONS.super_admin).toContain("roles:manage");
    expect(ROLE_PERMISSIONS.super_admin.length).toBeGreaterThan(ROLE_PERMISSIONS.admin.length);
  });

  it("never gives a non-super_admin role roles:manage — this is the privilege-escalation guardrail", () => {
    for (const role of ADMIN_ROLES) {
      if (role === "super_admin") continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain("roles:manage");
    }
  });

  it("gives every role at least dashboard:read", () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toContain("dashboard:read");
    }
  });

  it("scopes finance to payments/analytics, not students or content", () => {
    expect(ROLE_PERMISSIONS.finance).toContain("payments:write");
    expect(ROLE_PERMISSIONS.finance).not.toContain("students:write");
    expect(ROLE_PERMISSIONS.finance).not.toContain("content:write");
  });

  it("scopes content_editor to content only", () => {
    expect(ROLE_PERMISSIONS.content_editor).toContain("content:write");
    expect(ROLE_PERMISSIONS.content_editor).not.toContain("payments:read");
    expect(ROLE_PERMISSIONS.content_editor).not.toContain("students:write");
  });

  it("gives analyst only read permissions, never a :write permission", () => {
    for (const permission of ROLE_PERMISSIONS.analyst) {
      expect(permission.endsWith(":write")).toBe(false);
    }
  });

  it("Milestone 8 — gives admin and finance full invoice/refund/billing-settings access", () => {
    for (const role of ["admin", "finance"] as const) {
      expect(ROLE_PERMISSIONS[role]).toContain("invoices:write");
      expect(ROLE_PERMISSIONS[role]).toContain("refunds:write");
      expect(ROLE_PERMISSIONS[role]).toContain("payment-events:read");
      expect(ROLE_PERMISSIONS[role]).toContain("billing-settings:write");
    }
  });

  it("Milestone 8 — scopes counsellor to invoices:read only, never refunds or billing-settings", () => {
    expect(ROLE_PERMISSIONS.counsellor).toContain("invoices:read");
    expect(ROLE_PERMISSIONS.counsellor).not.toContain("invoices:write");
    expect(ROLE_PERMISSIONS.counsellor).not.toContain("refunds:read");
    expect(ROLE_PERMISSIONS.counsellor).not.toContain("billing-settings:read");
  });

  it("Milestone 8 — gives analyst read-only invoice/refund access", () => {
    expect(ROLE_PERMISSIONS.analyst).toContain("invoices:read");
    expect(ROLE_PERMISSIONS.analyst).toContain("refunds:read");
    expect(ROLE_PERMISSIONS.analyst).not.toContain("invoices:write");
  });

  it("Milestone 8 — content_editor has no payments/billing access at all", () => {
    for (const permission of ROLE_PERMISSIONS.content_editor) {
      expect(permission.startsWith("invoices:")).toBe(false);
      expect(permission.startsWith("refunds:")).toBe(false);
      expect(permission.startsWith("billing-settings:")).toBe(false);
      expect(permission.startsWith("payment-events:")).toBe(false);
    }
  });

  it("Milestone 8 — super_admin has every new payments permission via the blanket ADMIN_PERMISSIONS assignment", () => {
    for (const permission of ["invoices:read", "invoices:write", "refunds:read", "refunds:write", "payment-events:read", "billing-settings:read", "billing-settings:write"] as const) {
      expect(ROLE_PERMISSIONS.super_admin).toContain(permission);
    }
  });
});

describe("hasPermission", () => {
  it("returns false for a null/undefined role — a student with no admin_roles row has zero access", () => {
    expect(hasPermission(null, "students:read")).toBe(false);
    expect(hasPermission(undefined, "dashboard:read")).toBe(false);
  });

  it("checks the role's own list", () => {
    expect(hasPermission("finance", "payments:write")).toBe(true);
    expect(hasPermission("finance", "students:write")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("is true if any one permission matches", () => {
    expect(hasAnyPermission("counsellor", ["payments:write", "students:read"])).toBe(true);
  });

  it("is false if none match", () => {
    expect(hasAnyPermission("content_editor", ["payments:write", "students:write"])).toBe(false);
  });
});

describe("isKnownAdminRole", () => {
  it("accepts every declared role", () => {
    for (const role of ADMIN_ROLES) {
      expect(isKnownAdminRole(role)).toBe(true);
    }
  });

  it("rejects an arbitrary/forged string — never trust a role claimed by the browser", () => {
    expect(isKnownAdminRole("student")).toBe(false);
    expect(isKnownAdminRole("SUPER_ADMIN")).toBe(false);
    expect(isKnownAdminRole("")).toBe(false);
    expect(isKnownAdminRole(null)).toBe(false);
  });
});
