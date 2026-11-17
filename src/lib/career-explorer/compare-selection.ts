/**
 * Career Explorer V5 — the free comparison selection (the floating tray).
 *
 * Pure functions over a list of career slugs. The selection lives in the
 * visitor's own browser (localStorage) so anyone can compare without an
 * account; the comparison page itself reads the slugs from the URL.
 */
import { MAX_COMPARE_CAREERS, MIN_COMPARE_CAREERS } from "@/lib/careers/compare";

export const COMPARE_STORAGE_KEY = "nw:career-compare:v1";
export const COMPARE_PARAM_KEYS = ["a", "b", "c", "d"] as const;

export interface CompareEntry {
  slug: string;
  title: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCareerSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length <= 80 && SLUG_PATTERN.test(slug);
}

/** Drops anything malformed or repeated and caps the list at the comparison limit. */
export function sanitizeCompareEntries(value: unknown): CompareEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CompareEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { slug, title } = item as { slug?: unknown; title?: unknown };
    if (!isValidCareerSlug(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, title: typeof title === "string" ? title.slice(0, 120) : slug });
    if (out.length === MAX_COMPARE_CAREERS) break;
  }
  return out;
}

export type ToggleResult = { entries: CompareEntry[]; status: "added" | "removed" | "full" };

/** Adds the career, or removes it if already selected. A full selection is left unchanged. */
export function toggleCompareEntry(entries: readonly CompareEntry[], entry: CompareEntry): ToggleResult {
  if (entries.some((e) => e.slug === entry.slug)) {
    return { entries: entries.filter((e) => e.slug !== entry.slug), status: "removed" };
  }
  if (entries.length >= MAX_COMPARE_CAREERS) return { entries: [...entries], status: "full" };
  return { entries: [...entries, entry], status: "added" };
}

export function canCompare(entries: readonly CompareEntry[]): boolean {
  return entries.length >= MIN_COMPARE_CAREERS;
}

/** /compare?a=…&b=… for the given slugs (invalid and repeated slugs are skipped). */
export function buildCompareHref(slugs: readonly string[]): string {
  const unique = [...new Set(slugs.filter(isValidCareerSlug))].slice(0, MAX_COMPARE_CAREERS);
  const params = new URLSearchParams();
  unique.forEach((slug, i) => params.set(COMPARE_PARAM_KEYS[i], slug));
  const query = params.toString();
  return query ? `/compare?${query}` : "/compare";
}

/** Reads the selected slugs from /compare's search params, in a–d order. */
export function readCompareSlugs(params: Partial<Record<(typeof COMPARE_PARAM_KEYS)[number], string | undefined>>): string[] {
  const raw = COMPARE_PARAM_KEYS.map((key) => params[key]?.trim()).filter(isValidCareerSlug);
  return [...new Set(raw)].slice(0, MAX_COMPARE_CAREERS);
}
