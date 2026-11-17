import "server-only";
import { createClient } from "./server";
import { trackEvent } from "./analytics/track";
import type { CareerFitRelevance } from "@/types/career";

/**
 * Career Explorer V5 — the extra reads and the saved-career writes the V5
 * catalogue needs on top of src/lib/supabase/careers.ts.
 *
 * Reads are public career data (the same RLS-visible rows the catalogue
 * already shows). Saved careers are fully student-owned: every function
 * resolves "who is asking" from the session, never from a parameter, and the
 * table's RLS policies scope each row to auth.uid() (see
 * supabase/migrations-proposed/CE_V5_career_saved_items.sql). Saving is free:
 * it needs an account, never a paid plan.
 *
 * Saved careers use their own table (career_saved_items). The saved
 * universities/courses table (education_saved_items) is not read, written or
 * altered here.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[career-explorer] ${context}:`, error);
}

// ---------------------------------------------------------------------------
// Card extras: top skills and the primary education route for a page of careers
// ---------------------------------------------------------------------------
export interface CareerCardExtras {
  /** Skill keys, most important first. */
  skillKeys: string[];
  /** The route marked "primary" (or, failing that, the first "common" one). */
  typicalRoute: { educationLevel: string; fieldKey: string } | null;
}

const MAX_CARD_SKILLS = 3;
const RELEVANCE_RANK: Record<CareerFitRelevance, number> = { primary: 0, common: 1, alternative: 2 };

/** Two flat queries for the whole page — never one query per card. Fails soft: a career simply shows no extras. */
export async function getCareerCardExtras(careerIds: string[]): Promise<Map<string, CareerCardExtras>> {
  const out = new Map<string, CareerCardExtras>();
  const ids = [...new Set(careerIds)];
  if (ids.length === 0) return out;
  const supabase = await createClient();
  const [skillsRes, routesRes] = await Promise.all([
    supabase.from("career_skill_requirements").select("career_id, skill_key, importance").in("career_id", ids),
    supabase.from("career_education_routes").select("career_id, education_level, field_key, relevance").in("career_id", ids),
  ]);
  if (skillsRes.error) logDbError("getCareerCardExtras (skills)", skillsRes.error);
  if (routesRes.error) logDbError("getCareerCardExtras (routes)", routesRes.error);

  for (const id of ids) out.set(id, { skillKeys: [], typicalRoute: null });

  const skills = [...(skillsRes.data ?? [])].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
  for (const row of skills) {
    const entry = out.get(row.career_id);
    if (entry && entry.skillKeys.length < MAX_CARD_SKILLS) entry.skillKeys.push(row.skill_key);
  }

  const routes = [...(routesRes.data ?? [])].sort(
    (a, b) => (RELEVANCE_RANK[a.relevance as CareerFitRelevance] ?? 9) - (RELEVANCE_RANK[b.relevance as CareerFitRelevance] ?? 9)
  );
  for (const row of routes) {
    const entry = out.get(row.career_id);
    if (entry && !entry.typicalRoute && row.relevance !== "alternative") {
      entry.typicalRoute = { educationLevel: row.education_level, fieldKey: row.field_key };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Category cards: how many careers each family holds
// ---------------------------------------------------------------------------
/** Career count per family id, from one query. Empty map on failure (cards then show no count). */
export async function getFamilyCareerCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("careers").select("family_id");
  if (error) {
    logDbError("getFamilyCareerCounts", error);
    return counts;
  }
  for (const row of data ?? []) counts.set(row.family_id, (counts.get(row.family_id) ?? 0) + 1);
  return counts;
}

// ---------------------------------------------------------------------------
// Saved careers
// ---------------------------------------------------------------------------
export type SaveCareerStatus = "saved" | "removed" | "sign_in_required" | "unavailable";

export interface SaveCareerResult {
  status: SaveCareerStatus;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST/Postgres codes for "this table does not exist (yet)". */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Career ids the signed-in student has saved, newest first. Empty when signed out or when the table is not there yet. */
export async function listSavedCareerIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("career_saved_items")
    .select("career_id, created_at")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingTable(error)) logDbError("listSavedCareerIds", error);
    return [];
  }
  return (data ?? []).map((r) => r.career_id);
}

/**
 * Saves or removes one career for the signed-in student. Idempotent both
 * ways. A signed-out caller gets "sign_in_required" (the UI then offers
 * log in / sign up — never a paid upgrade).
 */
export async function setCareerSaved(careerId: string, saved: boolean): Promise<SaveCareerResult> {
  if (!UUID_PATTERN.test(careerId)) return { status: "unavailable" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "sign_in_required" };

  if (!saved) {
    const { error } = await supabase.from("career_saved_items").delete().eq("student_user_id", user.id).eq("career_id", careerId);
    if (error) {
      logDbError("setCareerSaved (remove)", error);
      return { status: "unavailable" };
    }
    return { status: "removed" };
  }

  const { error } = await supabase.from("career_saved_items").insert({ student_user_id: user.id, career_id: careerId });
  if (error && error.code !== "23505") {
    logDbError("setCareerSaved (save)", error);
    return { status: "unavailable" };
  }
  if (!error) {
    void trackEvent({ eventName: "career_saved", source: "career_explorer", feature: "career_explorer", entityType: "career", entityId: careerId });
  }
  return { status: "saved" };
}

// ---------------------------------------------------------------------------
// Hero cards: resolve a few named careers to ids (order preserved)
// ---------------------------------------------------------------------------
export async function getCareerIdsBySlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("careers").select("id, slug").in("slug", slugs);
  if (error) {
    logDbError("getCareerIdsBySlugs", error);
    return [];
  }
  const bySlug = new Map((data ?? []).map((r) => [r.slug, r.id]));
  return slugs.map((s) => bySlug.get(s)).filter((id): id is string => typeof id === "string");
}
