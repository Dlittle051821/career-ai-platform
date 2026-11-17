/**
 * University Discovery V3 — directory vocabulary and filter parsing (pure; no I/O).
 *
 * Every filter maps to a real column of public.universities. Values arriving
 * from the URL are checked against these closed lists before they reach a
 * query, so a crafted link can never widen a search or inject a value.
 */

export const INSTITUTION_CATEGORIES = [
  { value: "university", label: "University", short: "University" },
  { value: "university_of_applied_sciences", label: "University of Applied Sciences (Hochschule)", short: "Hochschule / UAS" },
  { value: "art_music_university", label: "Art or Music University", short: "Art & Music" },
  { value: "dual_university", label: "Dual University", short: "Dual University" },
  { value: "public_service_university", label: "Public-Service University", short: "Public Service" },
] as const;
export type InstitutionCategory = (typeof INSTITUTION_CATEGORIES)[number]["value"];

export const STUDY_AREAS = [
  { value: "engineering", label: "Engineering" },
  { value: "computer_science", label: "Computer Science & Data" },
  { value: "natural_sciences", label: "Natural Sciences" },
  { value: "mathematics", label: "Mathematics" },
  { value: "medicine_health", label: "Medicine & Health" },
  { value: "life_sciences", label: "Life Sciences" },
  { value: "business_economics", label: "Business & Economics" },
  { value: "social_sciences", label: "Social Sciences" },
  { value: "humanities", label: "Humanities" },
  { value: "law_public_administration", label: "Law & Public Administration" },
  { value: "education", label: "Education" },
  { value: "arts_design_media", label: "Arts, Design & Media" },
  { value: "music_performing_arts", label: "Music & Performing Arts" },
  { value: "architecture_built_environment", label: "Architecture & Built Environment" },
  { value: "agriculture_environment", label: "Agriculture & Environment" },
] as const;
export type StudyArea = (typeof STUDY_AREAS)[number]["value"];

export const OWNERSHIP_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
] as const;
export type OwnershipFilter = (typeof OWNERSHIP_OPTIONS)[number]["value"];

export const DIRECTORY_SORTS = [
  { value: "verified", label: "Verified first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "city", label: "City (A–Z)" },
  { value: "recent", label: "Recently checked" },
] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number]["value"];

export const DIRECTORY_PAGE_SIZE = 12;
const MAX_TEXT = 80;

export function categoryLabel(value: string | null | undefined, form: "label" | "short" = "label"): string | null {
  const match = INSTITUTION_CATEGORIES.find((entry) => entry.value === value);
  return match ? match[form] : null;
}

export function studyAreaLabel(value: string): string | null {
  return STUDY_AREAS.find((entry) => entry.value === value)?.label ?? null;
}

export function ownershipLabel(value: string | null | undefined): string | null {
  if (value === "public") return "Public";
  if (value === "private") return "Private";
  return null;
}

export interface DirectoryFilters {
  q: string;
  country: string;
  state: string;
  city: string;
  category: InstitutionCategory | "";
  ownership: OwnershipFilter | "";
  area: StudyArea | "";
  sort: DirectorySort;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  // Control characters are stripped so they never reach a query or the page.
  return (raw ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_TEXT);
}

function oneOf<T extends string>(value: string, allowed: readonly { value: T }[]): T | "" {
  return allowed.some((entry) => entry.value === value) ? (value as T) : "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turns untrusted URL parameters into a bounded, validated filter set. Unknown values become "no filter". */
export function parseDirectoryFilters(params: RawParams): DirectoryFilters {
  const page = Number.parseInt(first(params.page), 10);
  const country = first(params.country);
  return {
    q: first(params.q),
    country: UUID.test(country) ? country : "",
    state: first(params.state),
    city: first(params.city),
    category: oneOf(first(params.category), INSTITUTION_CATEGORIES),
    ownership: oneOf(first(params.ownership), OWNERSHIP_OPTIONS),
    area: oneOf(first(params.area), STUDY_AREAS),
    sort: oneOf(first(params.sort), DIRECTORY_SORTS) || "verified",
    page: Number.isInteger(page) && page > 0 && page < 10000 ? page : 1,
  };
}

export function hasActiveDirectoryFilters(filters: DirectoryFilters): boolean {
  return Boolean(filters.q || filters.country || filters.state || filters.city || filters.category || filters.ownership || filters.area);
}

/** Query string for a directory link; `overrides` replace individual filters (use "" to clear one). Page resets unless given. */
export function directoryHref(filters: DirectoryFilters, overrides: Partial<Record<keyof DirectoryFilters, string | number>> = {}): string {
  const merged: Record<string, string> = {};
  const source: Record<string, string | number> = { ...filters, page: 1, ...overrides };
  for (const [key, value] of Object.entries(source)) {
    const text = String(value ?? "");
    if (!text) continue;
    if (key === "page" && text === "1") continue;
    if (key === "sort" && text === "verified") continue;
    merged[key] = text;
  }
  const qs = new URLSearchParams(merged).toString();
  return qs ? `/universities?${qs}` : "/universities";
}

export interface UniversityHighlight {
  text: string;
  sourceName: string;
  sourceUrl: string;
  asOf: string | null;
}

/** Keeps only highlights that carry a source. An unsourced claim is never shown. */
export function parseHighlights(raw: unknown): UniversityHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: UniversityHighlight[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const text = typeof e.text === "string" ? e.text.trim() : "";
    const sourceUrl = typeof e.source_url === "string" ? e.source_url.trim() : "";
    const sourceName = typeof e.source_name === "string" ? e.source_name.trim() : "";
    if (!text || !sourceName || !/^https:\/\//.test(sourceUrl)) continue;
    out.push({ text, sourceName, sourceUrl, asOf: typeof e.as_of === "string" ? e.as_of : null });
  }
  return out.slice(0, 8);
}

export interface UniversityRanking {
  provider: string;
  year: number;
  rank: string;
  category: string | null;
  scope: "overall" | "subject";
  sourceUrl: string | null;
}

/** Keeps only rankings with a provider, a year and a rank. Scope defaults to "subject" when a category is present. */
export function parseRankings(raw: unknown): UniversityRanking[] {
  if (!Array.isArray(raw)) return [];
  const out: UniversityRanking[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const provider = typeof e.provider === "string" ? e.provider.trim() : "";
    const year = typeof e.year === "number" ? e.year : Number.parseInt(String(e.year ?? ""), 10);
    const rank = e.rank === undefined || e.rank === null ? "" : String(e.rank).trim();
    if (!provider || !Number.isInteger(year) || year < 1990 || year > 2100 || !rank) continue;
    const category = typeof e.category === "string" && e.category.trim() ? e.category.trim() : null;
    const scope = e.scope === "overall" || e.scope === "subject" ? e.scope : category ? "subject" : "overall";
    const sourceUrl = typeof e.source_url === "string" && /^https:\/\//.test(e.source_url) ? e.source_url : null;
    out.push({ provider, year, rank, category, scope, sourceUrl });
  }
  return out.slice(0, 20);
}
