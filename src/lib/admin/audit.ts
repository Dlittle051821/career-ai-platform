/**
 * Pure audit-log helpers — building a safe `changes` payload and a
 * human-readable summary. The actual database write
 * (supabase.rpc("record_admin_audit_log", ...)) lives in
 * src/lib/supabase/admin/audit.ts, matching this project's convention of
 * keeping pure logic (tested here, in src/lib/) separate from
 * Supabase-touching code (src/lib/supabase/).
 */

/**
 * Fields that must never appear in an audit log entry, no matter what a
 * caller passes in — checked case-insensitively against both top-level and
 * nested object keys. This is a deliberate second layer under "callers
 * should just not pass secrets in" (spec: never record passwords, tokens,
 * full payment credentials, or other secrets) — a caller that accidentally
 * includes one of these keys gets it stripped rather than persisted.
 */
const REDACTED_KEY_PATTERN = /password|token|secret|api[_-]?key|credential|card[_-]?number|cvv|cvc|ssn|service[_-]?role/i;

const REDACTED_PLACEHOLDER = "[redacted]";

/** Deep-redacts any object key matching REDACTED_KEY_PATTERN, recursing into plain objects and arrays. Non-object inputs pass through unchanged. */
export function redactSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitiveFields(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => {
      if (REDACTED_KEY_PATTERN.test(key)) return [key, REDACTED_PLACEHOLDER] as const;
      return [key, redactSensitiveFields(val)] as const;
    });
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export interface ChangeSet {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Builds the redacted `changes` jsonb payload for an audit entry from a before/after pair — both sides go through redactSensitiveFields independently. */
export function buildChangeSet(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined): ChangeSet {
  const result: ChangeSet = {};
  if (before) result.before = redactSensitiveFields(before);
  if (after) result.after = redactSensitiveFields(after);
  return result;
}

/**
 * A short, human-readable summary sentence for a field-level change —
 * e.g. summarizeFieldChange("status", "pending", "paid") -> "status:
 * pending -> paid". Falsy/undefined values render as "(none)" rather than
 * being silently omitted, since "unset" is meaningful information for an
 * audit trail.
 */
export function summarizeFieldChange(field: string, from: unknown, to: unknown): string {
  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "(none)" : String(v));
  return `${field}: ${fmt(from)} -> ${fmt(to)}`;
}

/** Joins several field-change summaries into one audit `summary` string, capped so a bulk change never produces an unreadable wall of text. */
export function buildAuditSummary(action: string, entityLabel: string, fieldChanges: string[]): string {
  const MAX_FIELD_CHANGES_SHOWN = 5;
  const shown = fieldChanges.slice(0, MAX_FIELD_CHANGES_SHOWN);
  const suffix = fieldChanges.length > MAX_FIELD_CHANGES_SHOWN ? ` (+${fieldChanges.length - MAX_FIELD_CHANGES_SHOWN} more)` : "";
  const changeText = shown.length > 0 ? ` — ${shown.join(", ")}${suffix}` : "";
  return `${action} ${entityLabel}${changeText}`;
}
