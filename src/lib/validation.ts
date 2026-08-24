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
