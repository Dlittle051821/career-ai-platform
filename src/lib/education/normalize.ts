/**
 * Milestone 9 — pure normalization helpers used by both the CSV import
 * pipeline (src/lib/education/csv.ts) and duplicate-detection scoring
 * (src/lib/education/duplicates.ts). No DB access, no side effects — every
 * function here is a plain string/value transform so it can be unit tested
 * in isolation and reused identically on the client (preview) and server
 * (actual import).
 *
 * IMPORTANT: normalization is for MATCHING/COMPARISON only. The original,
 * source-supplied value is always preserved verbatim in the imported record
 * (see education_import_rows.raw_data) — normalization never overwrites the
 * value an admin or CSV file actually provided, per the spec's "preserve
 * source values for audit" requirement.
 */

/** Collapses runs of whitespace (including newlines/tabs) to a single space and trims the ends. Never mutates in place — always returns a new string. */
export function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes a URL for comparison purposes: lowercases the scheme+host,
 * strips a trailing slash, strips a default port, and drops a leading
 * "www.". Returns null for empty/unparseable input rather than throwing —
 * callers should keep the original raw string for display/storage and use
 * this only for duplicate-matching or validation.
 */
export function normalizeUrlForMatching(value: string | null | undefined): string | null {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Extracts just the registrable-ish host (lowercased, no "www.") from a URL string, for domain-based duplicate matching. Null if unparseable. */
export function extractDomain(value: string | null | undefined): string | null {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Upper-cases and trims a currency code; does NOT validate against ISO 4217 (that's a caller-level check so a clear "unrecognized currency" warning can be shown instead of a silent null). */
export function normalizeCurrencyCode(value: string | null | undefined): string {
  return normalizeWhitespace(value).toUpperCase();
}

const CURRENCY_CODE_RE = /^[A-Z]{3}$/;
/** True if the string is a syntactically valid ISO 4217 alpha code (three uppercase letters). Does not check it against a known-currency list — new/rare currencies should not be silently rejected. */
export function isValidCurrencyCodeFormat(value: string | null | undefined): boolean {
  return CURRENCY_CODE_RE.test(normalizeCurrencyCode(value));
}

/** Upper-cases and trims an ISO 3166-1 alpha-2 country code. */
export function normalizeCountryCode(value: string | null | undefined): string {
  return normalizeWhitespace(value).toUpperCase();
}

const ALPHA2_RE = /^[A-Z]{2}$/;
const ALPHA3_RE = /^[A-Z]{3}$/;
export function isValidAlpha2(value: string | null | undefined): boolean {
  return ALPHA2_RE.test(normalizeCountryCode(value));
}
export function isValidAlpha3(value: string | null | undefined): boolean {
  return ALPHA3_RE.test(normalizeCountryCode(value));
}

/**
 * Normalizes a free-text qualification/level string into one of a small
 * set of canonical buckets for duplicate matching and filtering. Returns
 * the lowercased, whitespace-normalized original when nothing recognizable
 * matches — this is a best-effort bucketing, not a lossy overwrite of the
 * stored value.
 */
const QUALIFICATION_LEVEL_PATTERNS: Array<{ bucket: string; pattern: RegExp }> = [
  { bucket: "certificate", pattern: /\bcertificate\b/i },
  { bucket: "diploma", pattern: /\bdiploma\b/i },
  { bucket: "foundation", pattern: /\bfoundation\b/i },
  { bucket: "undergraduate", pattern: /\b(bachelor|undergraduate|b\.?a\.?|b\.?sc\.?|b\.?eng\.?|b\.?tech\.?)\b/i },
  { bucket: "postgraduate", pattern: /\b(master|postgraduate|graduate|m\.?a\.?|m\.?sc\.?|m\.?eng\.?|m\.?tech\.?|mba)\b/i },
  { bucket: "doctorate", pattern: /\b(doctorate|phd|ph\.?d\.?|doctoral)\b/i },
];
export function normalizeQualificationLevel(value: string | null | undefined): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  for (const { bucket, pattern } of QUALIFICATION_LEVEL_PATTERNS) {
    if (pattern.test(trimmed)) return bucket;
  }
  return trimmed.toLowerCase();
}

/** Lowercases, strips diacritics, collapses whitespace, and removes common punctuation — used for fuzzy-but-deterministic name comparison in duplicate detection. Never used for display. */
export function normalizeNameForMatching(value: string | null | undefined): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  return trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,''""()&/\\-]/g, " ")
    .replace(/\b(university|college|institute|school|of|the|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Slug-safe normalization: lowercase, ASCII letters/digits/hyphens only, single hyphens, no leading/trailing hyphen. Mirrors the project's existing slug validation regex ^[a-z0-9]+(-[a-z0-9]+)*$. */
export function normalizeSlug(value: string | null | undefined): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  return trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function isValidSlug(value: string | null | undefined): boolean {
  return !!value && SLUG_RE.test(value);
}
