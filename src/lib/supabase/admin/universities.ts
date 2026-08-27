import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AccreditationStatus, AdminListResult, University } from "@/types/admin";

/**
 * All Supabase <-> app-type mapping for the Milestone 7 University module
 * lives here, mirroring src/lib/supabase/careers.ts's convention: database
 * stays snake_case, the app stays camelCase, and every read fails soft
 * (logs server-side, returns an empty/null result) so a page never has to
 * render a raw database error.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/universities] ${context}:`, error);
}

function toUniversity(row: {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  website: string | null;
  institution_type: string | null;
  summary: string | null;
  accreditation_status: string;
  is_active: boolean;
  is_visible: boolean;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}): University {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    country: row.country,
    city: row.city,
    website: row.website,
    institutionType: row.institution_type,
    summary: row.summary,
    accreditationStatus: row.accreditation_status as AccreditationStatus,
    isActive: row.is_active,
    isVisible: row.is_visible,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UniversityFilters {
  query?: string;
  isActive?: boolean;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listUniversities(filters: UniversityFilters = {}): Promise<AdminListResult<University>> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("universities").select("*", { count: "exact" }).order("name", { ascending: true });
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`);
  }
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listUniversities", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data ?? []).map(toUniversity), total: count ?? 0, page, pageSize };
}

/**
 * Unfiltered, unpaginated name+id list — used by the Courses and
 * Applications forms' university picker. Small table (dozens, not
 * thousands), safe to load whole. Gated on `requireAdmin()` (any real
 * admin role) rather than a specific module permission — a counsellor has
 * `applications:write` but not `courses:read`, and still needs this list to
 * pick a university when logging an application. RLS (`is_any_admin()`)
 * enforces the real boundary regardless of which permission gates the call
 * here.
 */
export async function listUniversityOptions(): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("universities").select("id, name").order("name", { ascending: true });
  if (error) {
    logDbError("listUniversityOptions", error);
    return [];
  }
  return data ?? [];
}

export async function getUniversityById(id: string): Promise<University | null> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("universities").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getUniversityById", error);
    return null;
  }
  return data ? toUniversity(data) : null;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface UniversityInput {
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  website: string | null;
  institutionType: string | null;
  summary: string | null;
  accreditationStatus: AccreditationStatus;
  isActive: boolean;
  isVisible: boolean;
  internalNotes: string | null;
}

function parseUniversityForm(formData: FormData): UniversityInput {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!name) throw new AdminValidationError("Name is required.");
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new AdminValidationError("Slug must be lowercase letters, numbers, and single hyphens only (e.g. delhi-institute-of-technology).");
  }
  const website = String(formData.get("website") ?? "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    throw new AdminValidationError("Website must start with http:// or https://.");
  }

  return {
    name,
    slug,
    country: String(formData.get("country") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    website: website || null,
    institutionType: String(formData.get("institutionType") ?? "").trim() || null,
    summary: String(formData.get("summary") ?? "").trim() || null,
    accreditationStatus: (String(formData.get("accreditationStatus") ?? "unverified") as AccreditationStatus) || "unverified",
    isActive: formData.get("isActive") === "on",
    isVisible: formData.get("isVisible") === "on",
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  };
}

export async function createUniversity(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("universities:write");
  const input = parseUniversityForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("universities")
    .insert({
      name: input.name,
      slug: input.slug,
      country: input.country,
      city: input.city,
      website: input.website,
      institution_type: input.institutionType,
      summary: input.summary,
      accreditation_status: input.accreditationStatus,
      is_active: input.isActive,
      is_visible: input.isVisible,
      internal_notes: input.internalNotes,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createUniversity", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "university",
    entityId: data.id,
    entityLabel: `university "${input.name}"`,
    after: { name: input.name, slug: input.slug, accreditationStatus: input.accreditationStatus, isActive: input.isActive },
  });

  return data.id;
}

export async function updateUniversity(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("universities:write");
  const input = parseUniversityForm(formData);
  const supabase = await createClient();

  const before = await getUniversityById(id);

  const { error } = await supabase
    .from("universities")
    .update({
      name: input.name,
      slug: input.slug,
      country: input.country,
      city: input.city,
      website: input.website,
      institution_type: input.institutionType,
      summary: input.summary,
      accreditation_status: input.accreditationStatus,
      is_active: input.isActive,
      is_visible: input.isVisible,
      internal_notes: input.internalNotes,
      updated_by: admin.userId,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateUniversity", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (before) {
    if (before.isActive !== input.isActive) fieldChangeSummaries.push(`isActive: ${before.isActive} -> ${input.isActive}`);
    if (before.accreditationStatus !== input.accreditationStatus) {
      fieldChangeSummaries.push(`accreditationStatus: ${before.accreditationStatus} -> ${input.accreditationStatus}`);
    }
    if (before.name !== input.name) fieldChangeSummaries.push(`name: ${before.name} -> ${input.name}`);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "university",
    entityId: id,
    entityLabel: `university "${input.name}"`,
    fieldChangeSummaries,
    before: before ? { name: before.name, accreditationStatus: before.accreditationStatus, isActive: before.isActive } : undefined,
    after: { name: input.name, accreditationStatus: input.accreditationStatus, isActive: input.isActive },
  });
}
