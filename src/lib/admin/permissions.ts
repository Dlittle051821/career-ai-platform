import type { AdminRole } from "@/types/admin";
import { ADMIN_ROLES } from "@/types/admin";

/**
 * The centralized role-permission mapping the Milestone 7 spec asks for.
 *
 * This is the APPLICATION-LEVEL source of truth — it drives what the admin
 * shell shows/hides (module links, buttons) and what a server action
 * checks before it touches the database. It is deliberately NOT the only
 * enforcement layer: every table this maps to also has its own RLS
 * policies in supabase/migrations/0004_admin_system.sql that enforce the
 * same boundaries independently, keyed on role (not on this permission
 * string list) via current_admin_role()/is_admin_role(). If this file and
 * the RLS policies ever disagree, RLS wins — hiding a button here is a UX
 * nicety, not the security boundary (spec: "Hiding navigation links is not
 * authorization"). See docs/admin-system-guide.md §2 for the full mapping
 * table cross-referencing every permission below to its RLS policy.
 */
export const ADMIN_PERMISSIONS = [
  "dashboard:read",
  "students:read",
  "students:write",
  "universities:read",
  "universities:write",
  "courses:read",
  "courses:write",
  "applications:read",
  "applications:write",
  "leads:read",
  "leads:write",
  "payments:read",
  "payments:write",
  "agreements:read",
  "agreements:write",
  "counsellors:read",
  "counsellors:write",
  "analytics:read",
  "content:read",
  "content:write",
  "audit:read",
  "roles:manage",
  "invoices:read",
  "invoices:write",
  "refunds:read",
  "refunds:write",
  "payment-events:read",
  "billing-settings:read",
  "billing-settings:write",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL_READ: AdminPermission[] = ADMIN_PERMISSIONS.filter((p) => p.endsWith(":read")) as AdminPermission[];

/**
 * super_admin gets every permission, including roles:manage (the only role
 * that can grant/revoke other admins — enforced at the database level too,
 * see admin_roles RLS in 0004_admin_system.sql). Every other role's list
 * below matches the spec's per-role examples directly.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ADMIN_PERMISSIONS,
  admin: [
    "dashboard:read",
    "students:read",
    "students:write",
    "universities:read",
    "universities:write",
    "courses:read",
    "courses:write",
    "applications:read",
    "applications:write",
    "leads:read",
    "leads:write",
    "payments:read",
    "agreements:read",
    "agreements:write",
    "counsellors:read",
    "counsellors:write",
    "analytics:read",
    "content:read",
    "audit:read",
    // Deliberately no "roles:manage" — an admin can manage operational
    // records but cannot grant themselves or anyone else a role. Enforced
    // at the database level regardless: admin_roles has no INSERT/UPDATE
    // policy for anything but super_admin.
    // Milestone 8 (payments/billing) — admin gets full operational access:
    "invoices:read",
    "invoices:write",
    "refunds:read",
    "refunds:write",
    "payment-events:read",
    "billing-settings:read",
    "billing-settings:write",
  ],
  counsellor: [
    "dashboard:read",
    "students:read",
    "leads:read",
    "leads:write",
    "applications:read",
    "applications:write",
    "agreements:read",
    // M8: counsellors can see (their own scoped) invoices for context when
    // helping a student, but never create/void invoices or touch refunds.
    "invoices:read",
  ],
  finance: [
    "dashboard:read",
    "payments:read",
    "payments:write",
    "applications:read",
    "analytics:read",
    // M8: finance is the primary operational role for the new billing
    // system — same invoice/refund/billing-settings access as admin, on
    // top of its existing legacy payments:read/write.
    "invoices:read",
    "invoices:write",
    "refunds:read",
    "refunds:write",
    "payment-events:read",
    "billing-settings:read",
    "billing-settings:write",
  ],
  content_editor: ["dashboard:read", "content:read", "content:write"],
  analyst: [
    "dashboard:read",
    "students:read",
    "leads:read",
    "applications:read",
    "payments:read",
    "analytics:read",
    "agreements:read",
    // M8: analyst is read-only across the board, including the new
    // billing model.
    "invoices:read",
    "refunds:read",
  ],
};

export function hasPermission(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: AdminRole | null | undefined, permissions: AdminPermission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** True for any real admin role — used for reference-data reads every module needs regardless of specific permission (mirrors is_any_admin() in SQL). */
export function isKnownAdminRole(value: string | null | undefined): value is AdminRole {
  return !!value && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Every permission a role does NOT have — used by admin-shell nav to decide which module links to render at all. */
export function permittedReadModules(role: AdminRole | null | undefined): AdminPermission[] {
  return ALL_READ.filter((p) => hasPermission(role, p));
}
