import "server-only";
import { createClient } from "../server";
import { requireAdmin, requireAdminRole } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { isValidAlpha2, isValidAlpha3, isValidCurrencyCodeFormat } from "@/lib/education/normalize";
import type { Country } from "@/types/education";

/**
 * Milestone 9 — Countries (new table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 1).
 * The spec requires the schema to support additional countries without
 * migration changes — this module is the data-side extension point: any
 * admin can read the list (used as a dropdown across the universities,
 * campuses, and admission-requirements forms), while adding a new country
 * row is restricted to super_admin/admin, matching the migration's own
 * "super_admin/admin can write/update countries" RLS policies.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-countries] ${context}:`, error);
}

interface CountryRow {
  id: string;
  iso_alpha2: string;
  iso_alpha3: string;
  name: string;
  region: string | null;
  subregion: string | null;
  currency_code: string | null;
  default_language: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toCountry(row: CountryRow): Country {
  return {
    id: row.id,
    isoAlpha2: row.iso_alpha2,
    isoAlpha3: row.iso_alpha3,
    name: row.name,
    region: row.region,
    subregion: row.subregion,
    currencyCode: row.currency_code,
    defaultLanguage: row.default_language,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every country row (active and inactive), for the admin data-quality/management views. Any signed-in admin may read. */
export async function listCountriesForAdmin(): Promise<Country[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("countries").select("*").order("name", { ascending: true });
  if (error) {
    logDbError("listCountriesForAdmin", error);
    return [];
  }
  return (data ?? []).map(toCountry);
}

/** Unfiltered, unpaginated id+name list of ACTIVE countries — used by the University/Campus/Admission-requirement form pickers. */
export async function listCountryOptions(): Promise<{ id: string; name: string; isoAlpha2: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("countries")
    .select("id, name, iso_alpha2")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    logDbError("listCountryOptions", error);
    return [];
  }
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, isoAlpha2: row.iso_alpha2 }));
}

export async function getCountryById(id: string): Promise<Country | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("countries").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getCountryById", error);
    return null;
  }
  return data ? toCountry(data as CountryRow) : null;
}

interface CountryInput {
  isoAlpha2: string;
  isoAlpha3: string;
  name: string;
  region: string | null;
  subregion: string | null;
  currencyCode: string | null;
  defaultLanguage: string | null;
  isActive: boolean;
}

function parseCountryForm(formData: FormData): CountryInput {
  const isoAlpha2 = String(formData.get("isoAlpha2") ?? "").trim().toUpperCase();
  if (!isValidAlpha2(isoAlpha2)) throw new AdminValidationError("ISO alpha-2 code must be 2 letters (e.g. \"DE\").");
  const isoAlpha3 = String(formData.get("isoAlpha3") ?? "").trim().toUpperCase();
  if (!isValidAlpha3(isoAlpha3)) throw new AdminValidationError("ISO alpha-3 code must be 3 letters (e.g. \"DEU\").");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new AdminValidationError("Country name is required.");

  const currencyCodeRaw = String(formData.get("currencyCode") ?? "").trim().toUpperCase();
  const currencyCode = currencyCodeRaw || null;
  if (currencyCode && !isValidCurrencyCodeFormat(currencyCode)) {
    throw new AdminValidationError("Currency must be a 3-letter ISO 4217 code (e.g. EUR).");
  }

  return {
    isoAlpha2,
    isoAlpha3,
    name,
    region: String(formData.get("region") ?? "").trim() || null,
    subregion: String(formData.get("subregion") ?? "").trim() || null,
    currencyCode,
    defaultLanguage: String(formData.get("defaultLanguage") ?? "").trim() || null,
    isActive: formData.get("isActive") !== "off",
  };
}

/**
 * Adds a new country row. This is the spec's "additional countries can be
 * added without schema changes" extension point — restricted to
 * super_admin/admin (matches the migration's write policy), since it is a
 * platform-wide reference-data change rather than a per-record edit.
 */
export async function createCountry(formData: FormData): Promise<string> {
  await requireAdminRole(["super_admin", "admin"]);
  const input = parseCountryForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("countries")
    .insert({
      iso_alpha2: input.isoAlpha2,
      iso_alpha3: input.isoAlpha3,
      name: input.name,
      region: input.region,
      subregion: input.subregion,
      currency_code: input.currencyCode,
      default_language: input.defaultLanguage,
      is_active: input.isActive,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createCountry", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "country",
    entityId: data.id,
    entityLabel: `country "${input.name}"`,
    after: { name: input.name, isoAlpha2: input.isoAlpha2 },
  });

  return data.id;
}

export async function updateCountry(id: string, formData: FormData): Promise<void> {
  await requireAdminRole(["super_admin", "admin"]);
  const input = parseCountryForm(formData);
  const supabase = await createClient();
  const before = await getCountryById(id);

  const { error } = await supabase
    .from("countries")
    .update({
      iso_alpha2: input.isoAlpha2,
      iso_alpha3: input.isoAlpha3,
      name: input.name,
      region: input.region,
      subregion: input.subregion,
      currency_code: input.currencyCode,
      default_language: input.defaultLanguage,
      is_active: input.isActive,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateCountry", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "country",
    entityId: id,
    entityLabel: `country "${input.name}"`,
    before: before ? { name: before.name, isActive: before.isActive } : undefined,
    after: { name: input.name, isActive: input.isActive },
  });
}
