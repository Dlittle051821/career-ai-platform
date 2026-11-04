/**
 * PostgREST returns a Postgres function's result in two shapes:
 *   - `returns setof …` / `returns table (…)`  → a JSON ARRAY of rows
 *   - `returns public.some_table` (one row)     → a single JSON OBJECT
 * Reading a single-row result as `data[0]` silently yields undefined even
 * though the call succeeded and its row was written (the NW07/NW09
 * "draft could not be created" bug). Use this helper for any RPC whose id is
 * needed; it accepts either shape so a later change from `returns <table>`
 * to `returns setof` cannot break the caller.
 */
export function rpcRowId(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "id" in row) {
    const id = (row as { id: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  }
  return null;
}
