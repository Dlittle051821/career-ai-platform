/**
 * Small dependency-free client-side validation helpers shared by the
 * Contact and Book Counselling forms. All validation here is frontend-only
 * — no data leaves the browser in Milestone 1.
 */

export type FieldErrors = Record<string, string>;

export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Accepts common Indian mobile formats: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9. */
export function isValidIndianPhone(value: string): boolean {
  const digitsOnly = value.replace(/[\s-]/g, "");
  return /^(\+91|91|0)?[6-9]\d{9}$/.test(digitsOnly);
}

export function minLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

/**
 * Minimum viable password policy for Milestone 2: at least 8 characters,
 * containing both a letter and a number. Intentionally not more
 * demanding than that — Supabase Auth itself enforces its own minimum
 * length server-side, and overly strict client rules mostly just
 * frustrate students without meaningfully improving security.
 */
export function isValidPassword(value: string): boolean {
  return value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value);
}

// ---------------------------------------------------------------------------
// Milestone 3 — Student Digital Profile validation.
//
// These run BOTH in the browser (instant feedback in the onboarding wizard)
// and again inside each Server Action before writing to Supabase — never
// trust that client-side validation actually ran, since a Server Action can
// be invoked directly. Ranges mirror the CHECK constraints in
// supabase/migrations/0002_student_profile.sql, so a value that passes here
// will never be rejected by the database for a range reason.
// ---------------------------------------------------------------------------

/** 1–5 Likert/strength rating used throughout the profile (subjects, interests, work preferences, priorities). */
export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Birth date must be a real date and cannot be in the future. */
export function isValidPastDate(value: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

const YEAR_MIN = 1990;
const YEAR_MAX = 2100;

export function isValidYear(value: number): boolean {
  return Number.isInteger(value) && value >= YEAR_MIN && value <= YEAR_MAX;
}

const SCORE_RANGE_BY_TYPE: Record<string, { min: number; max: number } | null> = {
  percentage: { min: 0, max: 100 },
  cgpa_10: { min: 0, max: 10 },
  cgpa_4: { min: 0, max: 4 },
  grade: null,
  other: null,
};

/** Grade/Other have no numeric range to check; percentage/CGPA do. */
export function isValidScoreForType(scoreType: string, value: number): boolean {
  const range = SCORE_RANGE_BY_TYPE[scoreType];
  if (range === undefined) return false; // unknown score type
  if (range === null) return true; // grade/other — no numeric bound
  return value >= range.min && value <= range.max;
}

export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Generic "is this key one of the allowed option keys" check, for enum-style fields. */
export function isOneOf(value: string, allowedKeys: readonly string[]): boolean {
  return allowedKeys.includes(value);
}
