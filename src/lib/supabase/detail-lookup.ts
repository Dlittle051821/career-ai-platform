/**
 * CC-24 — the result of looking up one public detail record (a career,
 * university or course) by its URL slug.
 *
 * Detail pages used to receive `null` for both "there is no such published
 * record" and "the database could not be reached", so they rendered a
 * friendly notice with HTTP 200 in both cases (a soft 404). Keeping the two
 * apart lets a page return a genuine 404 for a missing record while still
 * showing a calm "temporarily unavailable" notice — never a misleading
 * 404 — when the lookup itself failed.
 */
export type DetailLookup<T> = { status: "found"; value: T } | { status: "not_found" } | { status: "unavailable" };

export function lookupValue<T>(lookup: DetailLookup<T>): T | null {
  return lookup.status === "found" ? lookup.value : null;
}
