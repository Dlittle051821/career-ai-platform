import "server-only";
import { createClient } from "./server";
import type {
  CareerFamily,
  CareerDetail,
  CareerSummary,
  CareerScores,
  Industry,
  CareerTag,
  CareerSearchFilters,
  CareerSearchResult,
  CareerSkillLevel,
  CareerFitRelevance,
  DataQualityStatus,
  CareerMatchProfile,
} from "@/types/career";

/**
 * All Supabase <-> app-type mapping for the Milestone 4 Career Knowledge
 * Base lives here — nothing else in the app should read raw `career_*` /
 * `industries` rows directly. Same convention as
 * `src/lib/supabase/student-profile.ts`: database stays snake_case, the
 * app stays camelCase, and this file is the one place that translates.
 *
 * Every function here is read-only. There is deliberately no `createCareer`
 * / `updateCareer` / `deleteCareer` — Row Level Security has no write
 * policy for `anon`/`authenticated` on any career table (see
 * 0003_career_database.sql), so a write from this layer would fail anyway.
 * Master data is maintained through migrations/seeds or the Supabase
 * dashboard (see docs/career-data-guide.md), never through the app.
 *
 * Every exported function fails soft: a Supabase error is logged
 * server-side and the function returns an empty/null result rather than
 * throwing, so the UI never has to render a raw database error (Milestone
 * 4 §33) — callers only need to handle "found" vs "not found"/"empty".
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_RELATED_LIMIT = 6;

// ---------------------------------------------------------------------------
// Small shared lookups (career_families / industries / career_tags are all
// tiny, rarely-changing tables — fetching them in full and joining in
// memory avoids relying on PostgREST embedded-resource type inference,
// which isn't reliable here because every table in Database["public"] uses
// `Relationships: []` — see src/types/database.ts for why.)
// ---------------------------------------------------------------------------

function logCareerDbError(context: string, error: unknown) {
  // Server-side only — never surfaced to the student. See module docblock.
  console.error(`[careers] ${context}:`, error);
}

export async function getCareerFamilies(): Promise<CareerFamily[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("career_families")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    logCareerDbError("getCareerFamilies", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    familyKey: row.family_key,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    isActive: row.is_active,
  }));
}

export async function getIndustries(): Promise<Industry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    logCareerDbError("getIndustries", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    industryKey: row.industry_key,
    name: row.name,
    description: row.description,
  }));
}

export async function getCareerTags(): Promise<CareerTag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("career_tags").select("*").order("label", { ascending: true });

  if (error) {
    logCareerDbError("getCareerTags", error);
    return [];
  }

  return (data ?? []).map((row) => ({ id: row.id, tagKey: row.tag_key, label: row.label }));
}

/** Strips characters that have special meaning inside a PostgREST filter string (`,()%`), so a search box can never break or hijack the query. */
function sanitizeSearchTerm(raw: string): string | null {
  const cleaned = raw.replace(/[,()%]/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Narrows a running "eligible career id" allow-list to its intersection
 * with a newly-computed id list. `null` means "no restriction yet".
 *
 * Deliberately a standalone pure function rather than a closure that
 * mutates an outer `let` — a self-referential reassignment like
 * `x = x === null ? ids : x.filter(...)` triggers a control-flow-analysis
 * bug in this project's TypeScript 6.0.3 that spuriously narrows the
 * variable to `never` at later read sites. Routing the ternary through a
 * function call (`x = intersectIds(x, ids)`) sidesteps it entirely.
 */
function intersectIds(current: string[] | null, ids: string[]): string[] {
  return current === null ? ids : current.filter((id) => ids.includes(id));
}

// ---------------------------------------------------------------------------
// searchCareers — the Career Explorer's main query. Supports free-text
// search (title / short title / aliases), and filtering by family,
// industry, and tag. Always paginated; never loads the whole table.
// ---------------------------------------------------------------------------
export async function searchCareers(filters: CareerSearchFilters = {}): Promise<CareerSearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const empty: CareerSearchResult = { careers: [], total: 0, page, pageSize };

  const supabase = await createClient();

  // Resolve family/industry/tag filters to a list of eligible career ids
  // up front — flat queries only, never a nested PostgREST embed filter
  // (unreliable to type-check given Relationships: [] — see module docblock).
  let restrictToCareerIds: string[] | null = null;

  if (filters.familyKey) {
    const { data: family, error } = await supabase
      .from("career_families")
      .select("id")
      .eq("family_key", filters.familyKey)
      .maybeSingle();
    if (error) {
      logCareerDbError("searchCareers (family lookup)", error);
      return empty;
    }
    if (!family) return empty;

    const { data: careersInFamily, error: careersErr } = await supabase
      .from("careers")
      .select("id")
      .eq("family_id", family.id);
    if (careersErr) {
      logCareerDbError("searchCareers (family careers)", careersErr);
      return empty;
    }
    restrictToCareerIds = intersectIds(restrictToCareerIds, (careersInFamily ?? []).map((r) => r.id));
  }

  if (filters.industryKey) {
    const { data: industry, error } = await supabase
      .from("industries")
      .select("id")
      .eq("industry_key", filters.industryKey)
      .maybeSingle();
    if (error) {
      logCareerDbError("searchCareers (industry lookup)", error);
      return empty;
    }
    if (!industry) return empty;

    const { data: links, error: linksErr } = await supabase
      .from("career_industries")
      .select("career_id")
      .eq("industry_id", industry.id);
    if (linksErr) {
      logCareerDbError("searchCareers (industry links)", linksErr);
      return empty;
    }
    restrictToCareerIds = intersectIds(restrictToCareerIds, (links ?? []).map((r) => r.career_id));
  }

  if (filters.tagKey) {
    const { data: tag, error } = await supabase.from("career_tags").select("id").eq("tag_key", filters.tagKey).maybeSingle();
    if (error) {
      logCareerDbError("searchCareers (tag lookup)", error);
      return empty;
    }
    if (!tag) return empty;

    const { data: links, error: linksErr } = await supabase.from("career_tag_map").select("career_id").eq("tag_id", tag.id);
    if (linksErr) {
      logCareerDbError("searchCareers (tag links)", linksErr);
      return empty;
    }
    restrictToCareerIds = intersectIds(restrictToCareerIds, (links ?? []).map((r) => r.career_id));
  }

  if (restrictToCareerIds !== null && restrictToCareerIds.length === 0) {
    // A filter matched zero careers — short-circuit instead of issuing a
    // main query with an empty id list.
    return empty;
  }

  const searchTerm = filters.query ? sanitizeSearchTerm(filters.query) : null;
  if (searchTerm) {
    const { data: aliasMatches, error: aliasErr } = await supabase
      .from("career_aliases")
      .select("career_id")
      .ilike("alias", `%${searchTerm}%`);
    if (aliasErr) {
      logCareerDbError("searchCareers (alias lookup)", aliasErr);
    }
    const aliasCareerIds = new Set((aliasMatches ?? []).map((r) => r.career_id));

    // Title/short-title match, unioned with alias match, is expressed as an
    // id allow-list plus the ilike clauses so it composes cleanly with any
    // family/industry/tag restriction already computed above.
    const { data: titleMatches, error: titleErr } = await supabase
      .from("careers")
      .select("id")
      .or(`title.ilike.%${searchTerm}%,short_title.ilike.%${searchTerm}%`);
    if (titleErr) {
      logCareerDbError("searchCareers (title match)", titleErr);
      return empty;
    }

    const textMatchIds = new Set<string>([...(titleMatches ?? []).map((r) => r.id), ...aliasCareerIds]);
    restrictToCareerIds = intersectIds(restrictToCareerIds, [...textMatchIds]);

    if (restrictToCareerIds !== null && restrictToCareerIds.length === 0) {
      return empty;
    }
  }

  let query = supabase
    .from("careers")
    .select("id, career_key, family_id, title, short_title, slug, summary, is_featured", { count: "exact" });

  if (restrictToCareerIds !== null) {
    query = query.in("id", restrictToCareerIds);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("is_featured", { ascending: false })
    .order("title", { ascending: true })
    .range(from, to);

  if (error) {
    logCareerDbError("searchCareers (main query)", error);
    return empty;
  }
  if (!data || data.length === 0) {
    return { careers: [], total: count ?? 0, page, pageSize };
  }

  const careers = await hydrateCareerSummaries(supabase, data);
  return { careers, total: count ?? 0, page, pageSize };
}

/** Attaches familyKey/familyName + industryKeys/tagKeys to a page of bare career rows — flat lookups only (see module docblock). */
async function hydrateCareerSummaries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { id: string; career_key: string; family_id: string; title: string; short_title: string | null; slug: string; summary: string; is_featured: boolean }[]
): Promise<CareerSummary[]> {
  const careerIds = rows.map((r) => r.id);
  const familyIds = [...new Set(rows.map((r) => r.family_id))];

  const [familiesRes, industryLinksRes, tagLinksRes] = await Promise.all([
    supabase.from("career_families").select("id, family_key, name").in("id", familyIds),
    supabase.from("career_industries").select("career_id, industry_id").in("career_id", careerIds),
    supabase.from("career_tag_map").select("career_id, tag_id").in("career_id", careerIds),
  ]);

  const familyById = new Map((familiesRes.data ?? []).map((f) => [f.id, { key: f.family_key, name: f.name }]));

  const industryIds = [...new Set((industryLinksRes.data ?? []).map((r) => r.industry_id))];
  const tagIds = [...new Set((tagLinksRes.data ?? []).map((r) => r.tag_id))];

  const [industriesRes, tagsRes] = await Promise.all([
    industryIds.length > 0
      ? supabase.from("industries").select("id, industry_key").in("id", industryIds)
      : Promise.resolve({ data: [] as { id: string; industry_key: string }[] }),
    tagIds.length > 0
      ? supabase.from("career_tags").select("id, tag_key").in("id", tagIds)
      : Promise.resolve({ data: [] as { id: string; tag_key: string }[] }),
  ]);

  const industryKeyById = new Map((industriesRes.data ?? []).map((i) => [i.id, i.industry_key]));
  const tagKeyById = new Map((tagsRes.data ?? []).map((t) => [t.id, t.tag_key]));

  const industriesByCareer = new Map<string, string[]>();
  for (const link of industryLinksRes.data ?? []) {
    const key = industryKeyById.get(link.industry_id);
    if (!key) continue;
    const list = industriesByCareer.get(link.career_id) ?? [];
    list.push(key);
    industriesByCareer.set(link.career_id, list);
  }

  const tagsByCareer = new Map<string, string[]>();
  for (const link of tagLinksRes.data ?? []) {
    const key = tagKeyById.get(link.tag_id);
    if (!key) continue;
    const list = tagsByCareer.get(link.career_id) ?? [];
    list.push(key);
    tagsByCareer.set(link.career_id, list);
  }

  return rows.map((row) => {
    const family = familyById.get(row.family_id);
    return {
      id: row.id,
      careerKey: row.career_key,
      slug: row.slug,
      title: row.title,
      shortTitle: row.short_title,
      summary: row.summary,
      familyKey: family?.key ?? "",
      familyName: family?.name ?? "",
      isFeatured: row.is_featured,
      industryKeys: industriesByCareer.get(row.id) ?? [],
      tagKeys: tagsByCareer.get(row.id) ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// getCareerBySlug / getCompleteCareerProfile
//
// getCompleteCareerProfile is the most important function for Milestone 5:
// it returns one clean structured object with every scoring dimension for
// a career (subjects, interests, skills, work preferences, career
// priorities, education routes, industries, tags) so a future
// recommendation engine can compare it against a student's Milestone 3
// profile without touching this file again.
// ---------------------------------------------------------------------------

export async function getCareerBySlug(slug: string): Promise<CareerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("careers").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    logCareerDbError("getCareerBySlug (slug lookup)", error);
    return null;
  }
  if (!data) return null; // not found, inactive, or not-yet-approved — RLS already filtered it out

  return getCompleteCareerProfile(data.id);
}

export async function getCompleteCareerProfile(careerId: string): Promise<CareerDetail | null> {
  const supabase = await createClient();

  const { data: career, error: careerErr } = await supabase.from("careers").select("*").eq("id", careerId).maybeSingle();
  if (careerErr) {
    logCareerDbError("getCompleteCareerProfile (career)", careerErr);
    return null;
  }
  if (!career) return null;

  const [
    familyRes,
    subjectsRes,
    interestsRes,
    skillsRes,
    workPrefsRes,
    prioritiesRes,
    routesRes,
    industryLinksRes,
    tagLinksRes,
    aliasesRes,
  ] = await Promise.all([
    supabase.from("career_families").select("family_key, name").eq("id", career.family_id).maybeSingle(),
    supabase.from("career_subject_requirements").select("*").eq("career_id", careerId),
    supabase.from("career_interest_requirements").select("*").eq("career_id", careerId),
    supabase.from("career_skill_requirements").select("*").eq("career_id", careerId),
    supabase.from("career_work_preference_profile").select("*").eq("career_id", careerId),
    supabase.from("career_priority_profile").select("*").eq("career_id", careerId),
    supabase.from("career_education_routes").select("*").eq("career_id", careerId),
    supabase.from("career_industries").select("industry_id").eq("career_id", careerId),
    supabase.from("career_tag_map").select("tag_id").eq("career_id", careerId),
    supabase.from("career_aliases").select("alias").eq("career_id", careerId),
  ]);

  const industryIds = (industryLinksRes.data ?? []).map((r) => r.industry_id);
  const tagIds = (tagLinksRes.data ?? []).map((r) => r.tag_id);

  const [industriesRes, tagsRes] = await Promise.all([
    industryIds.length > 0
      ? supabase.from("industries").select("*").in("id", industryIds)
      : Promise.resolve({ data: [] as { id: string; industry_key: string; name: string; description: string | null }[] }),
    tagIds.length > 0
      ? supabase.from("career_tags").select("*").in("id", tagIds)
      : Promise.resolve({ data: [] as { id: string; tag_key: string; label: string }[] }),
  ]);

  const scores: CareerScores = {
    internationalMobility: career.international_mobility_score,
    remoteWork: career.remote_work_score,
    entrepreneurship: career.entrepreneurship_score,
    salaryPotential: career.salary_potential_score,
    jobSecurity: career.job_security_score,
    creativity: career.creativity_score,
    socialImpact: career.social_impact_score,
    leadershipOpportunity: career.leadership_opportunity_score,
    travel: career.travel_score,
    researchIntensity: career.research_intensity_score,
    technicalDepth: career.technical_depth_score,
  };

  const industriesData = (industriesRes.data ?? []) as { id: string; industry_key: string; name: string; description: string | null }[];
  const tagsData = (tagsRes.data ?? []) as { id: string; tag_key: string; label: string }[];

  const detail: CareerDetail = {
    id: career.id,
    careerKey: career.career_key,
    familyKey: familyRes.data?.family_key ?? "",
    familyName: familyRes.data?.name ?? "",
    title: career.title,
    shortTitle: career.short_title,
    slug: career.slug,
    summary: career.summary,
    whatYouDo: career.what_you_do,
    typicalEnvironment: career.typical_environment,
    careerOutlookSummary: career.career_outlook_summary,
    typicalEntryLevel: career.typical_entry_level,
    minimumEducationKey: career.minimum_education_key,
    scores,
    isFeatured: career.is_featured,
    dataQualityStatus: career.data_quality_status as DataQualityStatus,
    subjects: (subjectsRes.data ?? []).map((r) => ({
      subjectKey: r.subject_key,
      importance: r.importance,
      minimumStrength: r.minimum_strength,
    })),
    interests: (interestsRes.data ?? []).map((r) => ({ interestKey: r.interest_key, importance: r.importance })),
    skills: (skillsRes.data ?? []).map((r) => ({
      skillKey: r.skill_key,
      importance: r.importance,
      recommendedLevel: r.recommended_level as CareerSkillLevel,
    })),
    workPreferences: (workPrefsRes.data ?? []).map((r) => ({ preferenceKey: r.preference_key, score: r.score })),
    careerPriorities: (prioritiesRes.data ?? []).map((r) => ({ priorityKey: r.priority_key, score: r.score })),
    educationRoutes: (routesRes.data ?? []).map((r) => ({
      educationLevel: r.education_level,
      fieldKey: r.field_key,
      specializationKey: r.specialization_key,
      relevance: r.relevance as CareerFitRelevance,
      notes: r.notes,
    })),
    industries: industriesData.map((r) => ({ id: r.id, industryKey: r.industry_key, name: r.name, description: r.description })),
    tags: tagsData.map((r) => ({ id: r.id, tagKey: r.tag_key, label: r.label })),
    aliases: (aliasesRes.data ?? []).map((r) => r.alias),
  };

  return detail;
}

// ---------------------------------------------------------------------------
// getRelatedCareers — manual curation (career_related) first, topped up
// with same-family careers if the curated list is short. No algorithm/
// scoring — purely family overlap, per Milestone 4 §25.
// ---------------------------------------------------------------------------
export async function getRelatedCareers(careerId: string, limit: number = DEFAULT_RELATED_LIMIT): Promise<CareerSummary[]> {
  const supabase = await createClient();

  const { data: manualLinks, error: manualErr } = await supabase
    .from("career_related")
    .select("related_career_id")
    .eq("career_id", careerId)
    .order("display_order", { ascending: true });

  if (manualErr) {
    logCareerDbError("getRelatedCareers (manual links)", manualErr);
  }

  const orderedIds: string[] = (manualLinks ?? []).map((r) => r.related_career_id);

  if (orderedIds.length < limit) {
    const { data: self, error: selfErr } = await supabase.from("careers").select("family_id").eq("id", careerId).maybeSingle();
    if (selfErr) {
      logCareerDbError("getRelatedCareers (self lookup)", selfErr);
    }
    if (self) {
      const { data: sameFamilyRows, error: familyErr } = await supabase
        .from("careers")
        .select("id")
        .eq("family_id", self.family_id)
        .neq("id", careerId)
        .order("is_featured", { ascending: false })
        .limit(limit + orderedIds.length);
      if (familyErr) {
        logCareerDbError("getRelatedCareers (family fallback)", familyErr);
      }
      for (const row of sameFamilyRows ?? []) {
        if (orderedIds.length >= limit) break;
        if (!orderedIds.includes(row.id)) orderedIds.push(row.id);
      }
    }
  }

  const finalIds = orderedIds.slice(0, limit);
  if (finalIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("careers")
    .select("id, career_key, family_id, title, short_title, slug, summary, is_featured")
    .in("id", finalIds);

  if (error) {
    logCareerDbError("getRelatedCareers (hydrate)", error);
    return [];
  }

  const summaries = await hydrateCareerSummaries(supabase, rows ?? []);
  // Preserve curated/derived order rather than whatever order the `in` query returned.
  const bySummaryId = new Map(summaries.map((s) => [s.id, s]));
  return finalIds.map((id) => bySummaryId.get(id)).filter((s): s is CareerSummary => s !== undefined);
}

// ---------------------------------------------------------------------------
// getCareersForMatching — Milestone 5's bulk data-access entry point for the
// recommendation engine.
//
// `getCompleteCareerProfile` above is deliberately per-career: it's what
// the career-detail page needs, and one career per page load is fine.
// The recommendation engine is the opposite shape — it needs EVERY
// eligible career's full profile on one page load, and calling
// `getCompleteCareerProfile` once per career (~100 careers x ~10 queries
// each) would mean roughly a thousand round trips for a single
// `/recommendations` render. This function does the same join in a fixed
// number of bulk queries (one per table, each filtered with `.in(...)`)
// regardless of how many careers exist, so cost stays flat as the catalogue
// grows. RLS still applies — `careers` only returns rows that are
// `is_active = true AND data_quality_status = 'approved'`, exactly as
// every other read in this file.
// ---------------------------------------------------------------------------
export async function getCareersForMatching(): Promise<CareerMatchProfile[]> {
  const supabase = await createClient();

  // Column list kept as one literal (not built via string concatenation) —
  // Supabase's TypeScript client infers each selected column's type by
  // parsing this string as a literal at compile time; a concatenated
  // string is just `string` to the type checker, which collapses the
  // whole result to an untyped error shape (`GenericStringError`).
  const { data: careerRows, error: careersErr } = await supabase
    .from("careers")
    .select(
      "id, career_key, family_id, title, short_title, slug, summary, is_featured, minimum_education_key, international_mobility_score, remote_work_score, entrepreneurship_score, salary_potential_score, job_security_score, creativity_score, social_impact_score, leadership_opportunity_score, travel_score, research_intensity_score, technical_depth_score"
    );

  if (careersErr) {
    logCareerDbError("getCareersForMatching (careers)", careersErr);
    return [];
  }
  if (!careerRows || careerRows.length === 0) return [];

  const careerIds = careerRows.map((c) => c.id);

  const [
    familiesRes,
    subjectsRes,
    interestsRes,
    skillsRes,
    workPrefsRes,
    prioritiesRes,
    routesRes,
    industryLinksRes,
    tagLinksRes,
    industriesRes,
    tagsRes,
  ] = await Promise.all([
    supabase.from("career_families").select("id, family_key, name"),
    supabase.from("career_subject_requirements").select("*").in("career_id", careerIds),
    supabase.from("career_interest_requirements").select("*").in("career_id", careerIds),
    supabase.from("career_skill_requirements").select("*").in("career_id", careerIds),
    supabase.from("career_work_preference_profile").select("*").in("career_id", careerIds),
    supabase.from("career_priority_profile").select("*").in("career_id", careerIds),
    supabase.from("career_education_routes").select("*").in("career_id", careerIds),
    supabase.from("career_industries").select("career_id, industry_id").in("career_id", careerIds),
    supabase.from("career_tag_map").select("career_id, tag_id").in("career_id", careerIds),
    supabase.from("industries").select("id, industry_key"),
    supabase.from("career_tags").select("id, tag_key"),
  ]);

  const familyById = new Map((familiesRes.data ?? []).map((f) => [f.id, { key: f.family_key, name: f.name }]));
  const industryKeyById = new Map((industriesRes.data ?? []).map((i) => [i.id, i.industry_key]));
  const tagKeyById = new Map((tagsRes.data ?? []).map((t) => [t.id, t.tag_key]));

  const groupByCareer = <T extends { career_id: string }>(rows: T[] | null): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const list = map.get(row.career_id) ?? [];
      list.push(row);
      map.set(row.career_id, list);
    }
    return map;
  };

  const subjectsByCareer = groupByCareer(subjectsRes.data);
  const interestsByCareer = groupByCareer(interestsRes.data);
  const skillsByCareer = groupByCareer(skillsRes.data);
  const workPrefsByCareer = groupByCareer(workPrefsRes.data);
  const prioritiesByCareer = groupByCareer(prioritiesRes.data);
  const routesByCareer = groupByCareer(routesRes.data);
  const industryLinksByCareer = groupByCareer(industryLinksRes.data);
  const tagLinksByCareer = groupByCareer(tagLinksRes.data);

  return careerRows.map((career): CareerMatchProfile => {
    const family = familyById.get(career.family_id);
    const scores: CareerScores = {
      internationalMobility: career.international_mobility_score,
      remoteWork: career.remote_work_score,
      entrepreneurship: career.entrepreneurship_score,
      salaryPotential: career.salary_potential_score,
      jobSecurity: career.job_security_score,
      creativity: career.creativity_score,
      socialImpact: career.social_impact_score,
      leadershipOpportunity: career.leadership_opportunity_score,
      travel: career.travel_score,
      researchIntensity: career.research_intensity_score,
      technicalDepth: career.technical_depth_score,
    };

    return {
      id: career.id,
      careerKey: career.career_key,
      slug: career.slug,
      title: career.title,
      shortTitle: career.short_title,
      summary: career.summary,
      familyKey: family?.key ?? "",
      familyName: family?.name ?? "",
      isFeatured: career.is_featured,
      minimumEducationKey: career.minimum_education_key,
      scores,
      subjects: (subjectsByCareer.get(career.id) ?? []).map((r) => ({
        subjectKey: r.subject_key,
        importance: r.importance,
        minimumStrength: r.minimum_strength,
      })),
      interests: (interestsByCareer.get(career.id) ?? []).map((r) => ({ interestKey: r.interest_key, importance: r.importance })),
      skills: (skillsByCareer.get(career.id) ?? []).map((r) => ({
        skillKey: r.skill_key,
        importance: r.importance,
        recommendedLevel: r.recommended_level as CareerSkillLevel,
      })),
      workPreferences: (workPrefsByCareer.get(career.id) ?? []).map((r) => ({ preferenceKey: r.preference_key, score: r.score })),
      careerPriorities: (prioritiesByCareer.get(career.id) ?? []).map((r) => ({ priorityKey: r.priority_key, score: r.score })),
      educationRoutes: (routesByCareer.get(career.id) ?? []).map((r) => ({
        educationLevel: r.education_level,
        fieldKey: r.field_key,
        specializationKey: r.specialization_key,
        relevance: r.relevance as CareerFitRelevance,
        notes: r.notes,
      })),
      industryKeys: (industryLinksByCareer.get(career.id) ?? [])
        .map((r) => industryKeyById.get(r.industry_id))
        .filter((k): k is string => Boolean(k)),
      tagKeys: (tagLinksByCareer.get(career.id) ?? [])
        .map((r) => tagKeyById.get(r.tag_id))
        .filter((k): k is string => Boolean(k)),
    };
  });
}
