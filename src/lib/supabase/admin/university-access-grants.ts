import "server-only";
import { createClient } from "../server";
import { AdminAuthorizationError, requireAdminRole } from "../admin-auth";
import { AdminValidationError } from "@/lib/admin/form-state";
import { grantStatus, isUuid, validateGrantInput, validateReason, type GrantStatus } from "@/lib/admin/university-access-grants";

/**
 * UNI_V3 — admin-controlled Verified university access.
 *
 * Authorisation happens three times, and the last one is the one that counts:
 *   1. here, with requireAdminRole (super_admin / admin only);
 *   2. inside the database functions grant_university_access() and
 *      revoke_university_access(), which re-check the caller's admin role from
 *      auth.uid() and refuse everyone else;
 *   3. the table itself has no insert/update/delete policy or privilege, so
 *      nothing but those two functions can change it.
 * The caller's identity always comes from the session. The student id is the
 * only caller-supplied identifier, and it selects who RECEIVES access, never
 * who is acting. Both functions write the audit entry themselves.
 */

const GRANT_ROLES = ["super_admin", "admin"] as const;

export interface UniversityAccessGrant {
  id: string;
  reason: string;
  grantedAt: string;
  grantedByName: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
  revokeReason: string | null;
  status: GrantStatus;
}

export interface StudentGrantOverview {
  /** False when the grants table does not exist yet (migration UNI_V3/0001 not applied). */
  available: boolean;
  grants: UniversityAccessGrant[];
  hasPaidAccess: boolean;
}

interface GrantRow {
  id: string;
  reason: string;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export async function getStudentGrantOverview(studentUserId: string): Promise<StudentGrantOverview> {
  await requireAdminRole([...GRANT_ROLES]);
  if (!isUuid(studentUserId)) return { available: true, grants: [], hasPaidAccess: false };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("university_access_grants" as never)
    .select("id, reason, granted_at, granted_by, expires_at, revoked_at, revoked_by, revoke_reason")
    .eq("student_user_id", studentUserId)
    .eq("scope", "university_directory")
    .order("granted_at", { ascending: false })
    .limit(50);
  if (error) {
    const missing = ["42P01", "PGRST205", "PGRST204"].includes((error as { code?: string }).code ?? "");
    if (!missing) console.error("[admin/university-access-grants] list:", error);
    return { available: !missing, grants: [], hasPaidAccess: false };
  }
  const rows = (data ?? []) as unknown as GrantRow[];

  const actorIds = Array.from(new Set(rows.flatMap((row) => [row.granted_by, row.revoked_by]).filter((id): id is string => Boolean(id))));
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    for (const profile of profiles ?? []) names.set(profile.id as string, (profile.full_name as string | null) ?? "Admin");
  }

  const { data: purchases } = await supabase
    .from("pricing_purchases")
    .select("invoice_id, pricing_plans ( slug ), invoices ( status )")
    .eq("student_user_id", studentUserId);
  const hasPaidAccess = (purchases ?? []).some((raw) => {
    const row = raw as unknown as { pricing_plans: { slug: string } | null; invoices: { status: string } | null };
    return ["nextwise-verified", "nextwise-essential"].includes(row.pricing_plans?.slug ?? "") && row.invoices?.status === "paid";
  });

  return {
    available: true,
    hasPaidAccess,
    grants: rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      grantedAt: row.granted_at,
      grantedByName: row.granted_by ? names.get(row.granted_by) ?? "Admin" : null,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      revokedByName: row.revoked_by ? names.get(row.revoked_by) ?? "Admin" : null,
      revokeReason: row.revoke_reason,
      status: grantStatus({ revokedAt: row.revoked_at, expiresAt: row.expires_at }),
    })),
  };
}

function mapRpcError(error: { code?: string; message?: string }): Error {
  switch (error.code) {
    case "42501":
      return new AdminAuthorizationError("Only a Super Admin or Admin can change university access.");
    case "23505":
      return new AdminValidationError("This student already has an active grant. Revoke it first if you need to change it.");
    case "P0002":
      return new AdminValidationError("That student or grant could not be found. Refresh the page and try again.");
    case "22023":
      return new AdminValidationError(error.message ?? "Please check the form and try again.");
    case "PGRST202":
    case "42883":
      return new AdminValidationError("Access grants are not set up on this database yet (migration UNI_V3/0001 has not been applied).");
    default:
      console.error("[admin/university-access-grants] rpc:", error);
      return new Error("The change could not be saved. Nothing was changed.");
  }
}

export async function grantUniversityAccess(studentUserId: string, formData: FormData): Promise<void> {
  await requireAdminRole([...GRANT_ROLES]);
  if (!isUuid(studentUserId)) throw new AdminValidationError("That student could not be found.");
  // An explicit confirmation of WHICH student, so a grant can never be issued from a stale or mistaken page.
  if (String(formData.get("confirmStudentId") ?? "") !== studentUserId) throw new AdminValidationError("Confirm the student before granting access.");
  const input = validateGrantInput(formData.get("reason"), formData.get("expiresOn"));
  if (!input.ok) throw new AdminValidationError(input.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_university_access" as never, { p_student_user_id: studentUserId, p_reason: input.reason, p_expires_at: input.expiresAt } as never);
  if (error) throw mapRpcError(error);
}

export async function revokeUniversityAccess(grantId: string, formData: FormData): Promise<void> {
  await requireAdminRole([...GRANT_ROLES]);
  if (!isUuid(grantId)) throw new AdminValidationError("That grant could not be found.");
  const reason = validateReason(formData.get("revokeReason"));
  if (!reason.ok) throw new AdminValidationError(reason.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_university_access" as never, { p_grant_id: grantId, p_reason: reason.reason } as never);
  if (error) throw mapRpcError(error);
}
