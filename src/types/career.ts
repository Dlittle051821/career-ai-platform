/**
 * Domain types for the Milestone 4 Career Knowledge Base. These mirror the
 * `career_*` / `industries` tables in `supabase/migrations/0003_career_database.sql`
 * — see that file for column-level constraints (ranges, enums, RLS).
 *
 * Naming convention: camelCase in TypeScript, snake_case in the database —
 * same pattern as `src/types/student-profile.ts`. The mapping from raw
 * Supabase rows lives only in `src/lib/supabase/careers.ts`.
 */

export type DataQualityStatus = "draft" | "reviewed" | "approved";
export type CareerFitRelevance = "primary" | "common" | "alternative";
export type CareerSkillLevel = "beginner" | "intermediate" | "advanced";

export interface CareerFamily {
  id: string;
  familyKey: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
}

/**
 * Curated internal matching heuristics (1-5), not verified market data or
 * a psychometric measurement. Never present these numbers to a student as
 * scientific fact — see docs/career-data-guide.md.
 */
export interface CareerScores {
  internationalMobility: number | null;
  remoteWork: number | null;
  entrepreneurship: number | null;
  salaryPotential: number | null;
  jobSecurity: number | null;
  creativity: number | null;
  socialImpact: number | null;
  leadershipOpportunity: number | null;
  travel: number | null;
  researchIntensity: number | null;
  technicalDepth: number | null;
}

/** Lightweight shape for list/search results — no fit sub-tables joined in. */
export interface CareerSummary {
  id: string;
  careerKey: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string;
  familyKey: string;
  familyName: string;
  isFeatured: boolean;
  industryKeys: string[];
  tagKeys: string[];
}

export interface CareerSubjectFit {
  subjectKey: string;
  importance: number;
  minimumStrength: number | null;
}

export interface CareerInterestFit {
  interestKey: string;
  importance: number;
}

export interface CareerSkillFit {
  skillKey: string;
  importance: number;
  recommendedLevel: CareerSkillLevel;
}

export interface CareerWorkPreferenceFit {
  preferenceKey: string;
  score: number;
}

export interface CareerPriorityFit {
  priorityKey: string;
  score: number;
}

export interface CareerEducationRoute {
  educationLevel: string;
  fieldKey: string;
  specializationKey: string | null;
  relevance: CareerFitRelevance;
  notes: string | null;
}

export interface Industry {
  id: string;
  industryKey: string;
  name: string;
  description: string | null;
}

export interface CareerTag {
  id: string;
  tagKey: string;
  label: string;
}

/**
 * The complete structured profile for one career — everything a future
 * Milestone 5 scoring engine (or the detail page) needs. This is the
 * return shape of `getCompleteCareerProfile` / `getCareerBySlug`.
 */
export interface CareerDetail {
  id: string;
  careerKey: string;
  familyKey: string;
  familyName: string;
  title: string;
  shortTitle: string | null;
  slug: string;
  summary: string;
  whatYouDo: string;
  typicalEnvironment: string;
  careerOutlookSummary: string | null;
  typicalEntryLevel: string;
  minimumEducationKey: string | null;
  scores: CareerScores;
  isFeatured: boolean;
  dataQualityStatus: DataQualityStatus;
  subjects: CareerSubjectFit[];
  interests: CareerInterestFit[];
  skills: CareerSkillFit[];
  workPreferences: CareerWorkPreferenceFit[];
  careerPriorities: CareerPriorityFit[];
  educationRoutes: CareerEducationRoute[];
  industries: Industry[];
  tags: CareerTag[];
  aliases: string[];
}

/** Filters accepted by `searchCareers`. All optional; an empty object returns the first page of everything approved. */
export interface CareerSearchFilters {
  query?: string;
  familyKey?: string;
  industryKey?: string;
  tagKey?: string;
  page?: number;
  pageSize?: number;
}

export interface CareerSearchResult {
  careers: CareerSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Milestone 5: the subset of a career's full profile the recommendation
 * engine needs to score it against a student profile. A trimmed sibling of
 * `CareerDetail` — it omits `aliases` (search-only, irrelevant to scoring)
 * and returns industries/tags as bare key lists rather than joined
 * `Industry[]` / `CareerTag[]` objects, since the engine only ever compares
 * keys. Returned in bulk by `getCareersForMatching()` in
 * `src/lib/supabase/careers.ts` — never fetch this shape one career at a
 * time (see that function's docblock for why).
 */
export interface CareerMatchProfile {
  id: string;
  careerKey: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string;
  familyKey: string;
  familyName: string;
  isFeatured: boolean;
  minimumEducationKey: string | null;
  scores: CareerScores;
  subjects: CareerSubjectFit[];
  interests: CareerInterestFit[];
  skills: CareerSkillFit[];
  workPreferences: CareerWorkPreferenceFit[];
  careerPriorities: CareerPriorityFit[];
  educationRoutes: CareerEducationRoute[];
  industryKeys: string[];
  tagKeys: string[];
}
