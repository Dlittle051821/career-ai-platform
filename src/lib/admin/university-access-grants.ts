/**
 * UNI_V3 — admin-controlled Verified university access: pure input validation.
 * The database function (grant_university_access / revoke_university_access)
 * repeats every check; this module only produces a clear message first.
 */

export const GRANT_REASON_MIN = 5;
export const GRANT_REASON_MAX = 500;
/** A grant may run for at most two years; longer access should be a paid plan or a fresh, deliberate grant. */
export const GRANT_MAX_DAYS = 730;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type GrantInputResult = { ok: true; reason: string; expiresAt: string | null } | { ok: false; error: string };

export function validateReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (reason.length < GRANT_REASON_MIN) return { ok: false, error: `Enter a reason of at least ${GRANT_REASON_MIN} characters. It is kept in the audit trail.` };
  if (reason.length > GRANT_REASON_MAX) return { ok: false, error: `Keep the reason under ${GRANT_REASON_MAX} characters.` };
  return { ok: true, reason };
}

/** `expiresOn` is an optional YYYY-MM-DD date; access ends at the end of that day (UTC). */
export function validateGrantInput(reasonRaw: unknown, expiresOnRaw: unknown, now: Date = new Date()): GrantInputResult {
  const reason = validateReason(reasonRaw);
  if (!reason.ok) return reason;
  const expiresOn = typeof expiresOnRaw === "string" ? expiresOnRaw.trim() : "";
  if (!expiresOn) return { ok: true, reason: reason.reason, expiresAt: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return { ok: false, error: "Enter the expiry as a date." };
  const expiresAt = new Date(`${expiresOn}T23:59:59.000Z`);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.toISOString().slice(0, 10) !== expiresOn) return { ok: false, error: "Enter a real calendar date for the expiry." };
  if (expiresAt.getTime() <= now.getTime()) return { ok: false, error: "The expiry must be in the future." };
  if (expiresAt.getTime() - now.getTime() > GRANT_MAX_DAYS * 86_400_000) return { ok: false, error: "A grant can run for at most two years." };
  return { ok: true, reason: reason.reason, expiresAt: expiresAt.toISOString() };
}

export type GrantStatus = "active" | "expired" | "revoked";

export function grantStatus(grant: { revokedAt: string | null; expiresAt: string | null }, now: Date = new Date()): GrantStatus {
  if (grant.revokedAt) return "revoked";
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= now.getTime()) return "expired";
  return "active";
}
