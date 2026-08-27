import "server-only";
import { cache } from "react";
import { createClient } from "./server";
import type { AdminRole, CurrentAdmin } from "@/types/admin";
import { isKnownAdminRole } from "@/lib/admin/permissions";
import { hasPermission, type AdminPermission } from "@/lib/admin/permissions";

/**
 * Server-side "who is this admin" resolution — the one place every admin
 * page, layout, and server action gets the caller's role from. Always
 * re-derives the role from `admin_roles` via the current request's
 * RLS-scoped session; never accepts a role passed as a prop, form field,
 * cookie value, or anything else that ultimately came from the browser
 * (spec: "Never trust a role supplied by the browser").
 *
 * This is deliberately called again inside every server action that
 * mutates data (see src/lib/supabase/admin/*.ts), not just once at the
 * page level — a page-level check alone would still leave a server action
 * reachable directly without a fresh permission check ("recheck
 * permissions inside mutations" — spec requirement).
 */
// Wrapped in React's cache() so repeated calls within the same request
// (the admin layout, the current page, and every requireAdmin*() call a
// data-access function makes) share one result instead of re-querying
// admin_roles/counsellors on every call — a single /admin/students render
// can easily call this half a dozen times across layout + page + several
// permission checks. cache() is per-request only; it never leaks across
// requests/users, since Next.js resets it for every render.
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: roleRow }, { data: counsellorRow }] = await Promise.all([
    supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("counsellors").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!roleRow || !isKnownAdminRole(roleRow.role)) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: roleRow.role,
    counsellorId: counsellorRow?.id ?? null,
  };
});

export class AdminAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

/** Throws AdminAuthorizationError if the caller has no admin role at all. Every admin page/action starts with this (or requireAdminRole/requireAdminPermission below). */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AdminAuthorizationError("You must be signed in with an admin role to do this.");
  return admin;
}

/** Throws unless the caller's role is one of `allowed`. Use when a specific set of roles (not a general permission) is the right check — e.g. role management itself, which is deliberately super_admin-only rather than expressed as a generic permission. */
export async function requireAdminRole(allowed: AdminRole[]): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!allowed.includes(admin.role)) {
    throw new AdminAuthorizationError(`Your role (${admin.role}) does not have access to this.`);
  }
  return admin;
}

/** Throws unless the caller's role grants `permission` per src/lib/admin/permissions.ts. The usual check for module-level read/write actions. */
export async function requireAdminPermission(permission: AdminPermission): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!hasPermission(admin.role, permission)) {
    throw new AdminAuthorizationError(`Your role (${admin.role}) does not have the '${permission}' permission.`);
  }
  return admin;
}
