import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import type { Campus } from "@/types/education";

/**
 * Milestone 9 — Campuses (new table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 3).
 * Gated on the existing "universities:write"/"universities:read"
 * permissions — a campus is a sub-record of a university, not its own
 * module, mirroring how the admin nav groups it under Universities (see
 * docs/global-education-data-guide.md).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-campuses] ${context}:`, error);
}

interface CampusRow {
  id: string;
  university_id: string;
  name: string;
  country_id: string | null;
  state_region: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_main: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function toCampus(row: CampusRow, universityNameById: Map<string, string>, countryNameById: Map<string, string>): Campus {
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: universityNameById.get(row.university_id) ?? null,
    name: row.name,
    countryId: row.country_id,
    countryName: row.country_id ? (countryNameById.get(row.country_id) ?? null) : null,
    stateRegion: row.state_region,
    city: row.city,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    isMain: row.is_main,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCampusesForUniversity(universityId: string): Promise<Campus[]> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campuses")
    .select("*")
    .eq("university_id", universityId)
    .order("is_main", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    logDbError("listCampusesForUniversity", error);
    return [];
  }
  const rows = (data ?? []) as CampusRow[];
  const universityNameById = new Map<string, string>();
  const countryIds = Array.from(new Set(rows.map((r) => r.country_id).filter((id): id is string => !!id)));
  const countryNameById = new Map<string, string>();
  if (countryIds.length > 0) {
    const { data: countries } = await supabase.from("countries").select("id, name").in("id", countryIds);
    for (const c of countries ?? []) countryNameById.set(c.id, c.name);
  }
  return rows.map((r) => toCampus(r, universityNameById, countryNameById));
}

/** Unfiltered, unpaginated id+name(+university) list — used by the Courses form's campus picker. Gated on `requireAdmin()`, same reasoning as listUniversityOptions. */
export async function listCampusOptionsForUniversity(universityId: string): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name")
    .eq("university_id", universityId)
    .order("name", { ascending: true });
  if (error) {
    logDbError("listCampusOptionsForUniversity", error);
    return [];
  }
  return data ?? [];
}

export async function getCampusById(id: string): Promise<Campus | null> {
  await requireAdminPermission("universities:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("campuses").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getCampusById", error);
    return null;
  }
  if (!data) return null;
  const row = data as CampusRow;
  const universityNameById = new Map<string, string>();
  const { data: uni } = await supabase.from("universities").select("id, name").eq("id", row.university_id).maybeSingle();
  if (uni) universityNameById.set(uni.id, uni.name);
  const countryNameById = new Map<string, string>();
  if (row.country_id) {
    const { data: country } = await supabase.from("countries").select("id, name").eq("id", row.country_id).maybeSingle();
    if (country) countryNameById.set(country.id, country.name);
  }
  return toCampus(row, universityNameById, countryNameById);
}

interface CampusInput {
  universityId: string;
  name: string;
  countryId: string | null;
  stateRegion: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isMain: boolean;
  isActive: boolean;
}

function parseCoordinate(formData: FormData, key: string, min: number, max: number, label: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AdminValidationError(`${label} must be a number between ${min} and ${max}.`);
  }
  return parsed;
}

function parseCampusForm(formData: FormData): CampusInput {
  const universityId = String(formData.get("universityId") ?? "").trim();
  if (!universityId) throw new AdminValidationError("A university must be selected.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new AdminValidationError("Campus name is required.");

  return {
    universityId,
    name,
    countryId: String(formData.get("countryId") ?? "").trim() || null,
    stateRegion: String(formData.get("stateRegion") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    latitude: parseCoordinate(formData, "latitude", -90, 90, "Latitude"),
    longitude: parseCoordinate(formData, "longitude", -180, 180, "Longitude"),
    isMain: formData.get("isMain") === "on",
    isActive: formData.get("isActive") !== "off",
  };
}

export async function createCampus(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("universities:write");
  const input = parseCampusForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campuses")
    .insert({
      university_id: input.universityId,
      name: input.name,
      country_id: input.countryId,
      state_region: input.stateRegion,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      is_main: input.isMain,
      is_active: input.isActive,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createCampus", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "campus",
    entityId: data.id,
    entityLabel: `campus "${input.name}"`,
    after: { name: input.name, universityId: input.universityId, isMain: input.isMain },
  });

  return data.id;
}

export async function updateCampus(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("universities:write");
  const input = parseCampusForm(formData);
  const supabase = await createClient();
  const before = await getCampusById(id);

  const { error } = await supabase
    .from("campuses")
    .update({
      name: input.name,
      country_id: input.countryId,
      state_region: input.stateRegion,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      is_main: input.isMain,
      is_active: input.isActive,
      updated_by: admin.userId,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateCampus", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "campus",
    entityId: id,
    entityLabel: `campus "${input.name}"`,
    before: before ? { name: before.name, isMain: before.isMain, isActive: before.isActive } : undefined,
    after: { name: input.name, isMain: input.isMain, isActive: input.isActive },
  });
}
