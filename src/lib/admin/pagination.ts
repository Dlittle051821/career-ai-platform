/**
 * Shared pagination/filter-parsing for every admin list page. Mirrors the
 * inline pattern already used by the Career Explorer
 * (src/app/(site)/careers/page.tsx) — page number from a URL search param,
 * clamped and defaulted — generalized here so all eleven admin modules
 * parse it identically instead of re-deriving the same three lines per
 * page.
 */

export const DEFAULT_ADMIN_PAGE_SIZE = 20;
export const MAX_ADMIN_PAGE_SIZE = 100;

/** Parses a `?page=` search param into a valid 1-based page number — never 0, negative, or NaN. */
export function parsePageParam(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function clampPageSize(raw: number | undefined, fallback = DEFAULT_ADMIN_PAGE_SIZE): number {
  const value = raw ?? fallback;
  return Math.min(MAX_ADMIN_PAGE_SIZE, Math.max(1, value));
}

export interface RangeResult {
  from: number;
  to: number;
}

/** Converts a (page, pageSize) pair into the zero-based inclusive [from, to] range Supabase's `.range()` expects. */
export function pageToRange(page: number, pageSize: number): RangeResult {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Strips empty/whitespace-only search param values — a filter bar that submits `?stage=` for "no filter selected" should behave identically to the param being absent. */
export function cleanFilterParam(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
