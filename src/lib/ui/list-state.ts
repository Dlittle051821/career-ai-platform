/**
 * UX06G — shared, pure resolver for the three states a filterable list page
 * can be in, used by /courses, /universities, /careers (and any future
 * filterable list) to render honest, distinct copy instead of the
 * conflated "couldn't be loaded" message the pages previously showed for
 * every zero-result case.
 *
 * Before this module, searchCourses()/searchUniversities()/searchCareers()
 * (src/lib/supabase/education/courses.ts, .../universities.ts,
 * src/lib/supabase/careers.ts) all swallowed a genuine Supabase query error
 * into the exact same `{ items: [], total: 0, ... }` shape used for a
 * legitimate zero-row success, and the pages could only tell "filtered to
 * zero" apart from "collapsed empty/error" via a client-computed
 * `hasActiveFilters` flag — so a dataset that is simply empty (no filters
 * applied, no rows exist yet) was wrongly told "The course dataset
 * couldn't be loaded right now." That is misleading: nothing failed.
 *
 * The three source list functions now set `error: true` on their result
 * only when the underlying Supabase call itself returned a Postgres error
 * (see each function's own `if (error) { ...; return { ...empty, error:
 * true }; }` branch) — never on a legitimate filter-driven zero-result
 * short-circuit (e.g. "no published university matches this country
 * filter" is a real, honest zero, not a failure). This resolver turns that
 * one boolean plus the already-existing `hasActiveFilters` flag into one
 * of four mutually exclusive, student-friendly states.
 */
export type ListEmptyState = "has_results" | "error" | "filtered_empty" | "dataset_empty";

export interface ResolveListEmptyStateInput {
  itemCount: number;
  hasActiveFilters: boolean;
  /** True only when the underlying query genuinely failed — never set for a legitimate zero-row result. */
  error?: boolean;
}

/**
 * Resolves which of the four states a list page is in. Order matters: a
 * real query error always wins (it is true regardless of filters), then a
 * filtered-to-zero result, then a genuinely empty dataset — `hasResults`
 * only when at least one row came back.
 */
export function resolveListEmptyState({ itemCount, hasActiveFilters, error }: ResolveListEmptyStateInput): ListEmptyState {
  if (itemCount > 0) return "has_results";
  if (error) return "error";
  if (hasActiveFilters) return "filtered_empty";
  return "dataset_empty";
}
