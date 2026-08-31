import "server-only";
import { createClient } from "../server";
import type { Country } from "@/types/education";

/**
 * Milestone 9 — public read access to the `countries` reference table.
 * RLS ("Anyone can read active countries") already scopes this to active
 * rows for anon/authenticated alike, so no explicit `.eq("is_active", true)`
 * filter is strictly required — it's kept anyway so this function's
 * contract doesn't silently depend on RLS alone, matching the fail-soft,
 * read-only convention of src/lib/supabase/careers.ts.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/countries] ${context}:`, error);
}

function toCountry(row: {
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
}): Country {
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

/** Every active country, alphabetical — used to populate public filter dropdowns. Small/rarely-changing table, safe to fetch in full. */
export async function listActiveCountries(): Promise<Country[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("countries").select("*").eq("is_active", true).order("name", { ascending: true });
  if (error) {
    logDbError("listActiveCountries", error);
    return [];
  }
  return (data ?? []).map(toCountry);
}
