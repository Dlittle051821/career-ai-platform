import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult, Counsellor, CounsellorWorkload } from "@/types/admin";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/counsellors] ${context}:`, error);
}

function toCounsellor(row: {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  specializations: string[];
  regions: string[];
  is_active: boolean;
  capacity: number | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}): Counsellor {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    specializations: row.specializations ?? [],
    regions: row.regions ?? [],
    isActive: row.is_active,
    capacity: row.capacity,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CounsellorFilters {
  query?: string;
  isActive?: boolean;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listCounsellors(filters: CounsellorFilters = {}): Promise<AdminListResult<Counsellor>> {
  await requireAdminPermission("counsellors:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("counsellors").select("*", { count: "exact" }).order("display_name", { ascending: true });
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`display_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listCounsellors", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data ?? []).map(toCounsellor), total: count ?? 0, page, pageSize };
}

/** Unfiltered, unpaginated id+name list — used by the Students/Leads/Applications assignment pickers, each gated on its own module permission by the caller. Gated here on `requireAdmin()` (any real admin role) rather than a specific permission, since it's shared across modules with different write permissions and carries no sensitive data beyond active counsellor names — RLS (`is_any_admin()`) is the real backstop regardless. */
export async function listCounsellorOptions(): Promise<{ id: string; displayName: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("counsellors").select("id, display_name").eq("is_active", true).order("display_name", { ascending: true });
  if (error) {
    logDbError("listCounsellorOptions", error);
    return [];
  }
  return (data ?? []).map((c) => ({ id: c.id, displayName: c.display_name }));
}

export async function getCounsellorById(id: string): Promise<Counsellor | null> {
  await requireAdminPermission("counsellors:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("counsellors").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getCounsellorById", error);
    return null;
  }
  return data ? toCounsellor(data) : null;
}

/** Active students / open leads / active applications currently assigned to each counsellor — computed in-memory from three count-only queries, no embedded selects. Mirrors src/lib/supabase/admin/dashboard.ts's workload aggregation. */
export async function listCounsellorWorkload(): Promise<CounsellorWorkload[]> {
  await requireAdminPermission("counsellors:read");
  const supabase = await createClient();

  const { data: counsellors, error } = await supabase.from("counsellors").select("*").order("display_name", { ascending: true });
  if (error) {
    logDbError("listCounsellorWorkload", error);
    return [];
  }

  const [studentMeta, leads, applications] = await Promise.all([
    supabase.from("admin_student_meta").select("assigned_counsellor_id").not("assigned_counsellor_id", "is", null),
    supabase.from("leads").select("assigned_counsellor_id").not("assigned_counsellor_id", "is", null).not("stage", "in", "(converted,lost)"),
    supabase
      .from("applications")
      .select("assigned_counsellor_id")
      .not("assigned_counsellor_id", "is", null)
      .not("stage", "in", "(enrolled,rejected,withdrawn)"),
  ]);

  function countBy(rows: { assigned_counsellor_id: string | null }[] | null): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.assigned_counsellor_id) continue;
      counts.set(row.assigned_counsellor_id, (counts.get(row.assigned_counsellor_id) ?? 0) + 1);
    }
    return counts;
  }

  const studentCounts = countBy(studentMeta.data);
  const leadCounts = countBy(leads.data);
  const applicationCounts = countBy(applications.data);

  return (counsellors ?? []).map((row) => ({
    ...toCounsellor(row),
    assignedStudentCount: studentCounts.get(row.id) ?? 0,
    assignedLeadCount: leadCounts.get(row.id) ?? 0,
    assignedApplicationCount: applicationCounts.get(row.id) ?? 0,
  }));
}

interface CounsellorInput {
  displayName: string;
  email: string | null;
  phone: string | null;
  specializations: string[];
  regions: string[];
  isActive: boolean;
  capacity: number | null;
  internalNotes: string | null;
}

function parseCounsellorForm(formData: FormData): CounsellorInput {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new AdminValidationError("Display name is required.");

  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  let capacity: number | null = null;
  if (capacityRaw) {
    const parsed = Number.parseInt(capacityRaw, 10);
    if (!Number.isInteger(parsed) || parsed < 0) throw new AdminValidationError("Capacity must be a non-negative whole number.");
    capacity = parsed;
  }

  const specializationsRaw = String(formData.get("specializations") ?? "").trim();
  const regionsRaw = String(formData.get("regions") ?? "").trim();

  return {
    displayName,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    specializations: specializationsRaw ? specializationsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    regions: regionsRaw ? regionsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    isActive: formData.get("isActive") === "on",
    capacity,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  };
}

/**
 * Deliberately NOT exposed to a "counsellor edits their own record" flow —
 * only super_admin/admin can call this (enforced both here and by RLS,
 * which grants counsellors no self-update policy at all and the table has
 * no `role` column, so this record can never grant privileges regardless
 * of who edits it).
 */
export async function createCounsellor(formData: FormData): Promise<string> {
  await requireAdminPermission("counsellors:write");
  const input = parseCounsellorForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("counsellors")
    .insert({
      user_id: null,
      display_name: input.displayName,
      email: input.email,
      phone: input.phone,
      specializations: input.specializations,
      regions: input.regions,
      is_active: input.isActive,
      capacity: input.capacity,
      internal_notes: input.internalNotes,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createCounsellor", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "counsellor",
    entityId: data.id,
    entityLabel: `counsellor "${input.displayName}"`,
    after: { displayName: input.displayName, isActive: input.isActive },
  });

  return data.id;
}

export async function updateCounsellor(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("counsellors:write");
  const input = parseCounsellorForm(formData);
  const supabase = await createClient();

  const before = await getCounsellorById(id);

  const { error } = await supabase
    .from("counsellors")
    .update({
      display_name: input.displayName,
      email: input.email,
      phone: input.phone,
      specializations: input.specializations,
      regions: input.regions,
      is_active: input.isActive,
      capacity: input.capacity,
      internal_notes: input.internalNotes,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateCounsellor", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (before) {
    if (before.isActive !== input.isActive) fieldChangeSummaries.push(`isActive: ${before.isActive} -> ${input.isActive}`);
    if (before.displayName !== input.displayName) fieldChangeSummaries.push(`displayName: ${before.displayName} -> ${input.displayName}`);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "counsellor",
    entityId: id,
    entityLabel: `counsellor "${input.displayName}"`,
    fieldChangeSummaries,
    before: before ? { displayName: before.displayName, isActive: before.isActive } : undefined,
    after: { displayName: input.displayName, isActive: input.isActive },
  });
}
