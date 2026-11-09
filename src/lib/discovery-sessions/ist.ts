/**
 * CC-22B — Discovery Session scheduling is always entered and shown in India
 * Standard Time, whatever timezone the server or the staff member's browser
 * runs in. IST is a fixed UTC+05:30 offset (India has no daylight saving),
 * so the conversion is exact arithmetic — no runtime timezone database and
 * no `new Date("YYYY-MM-DDTHH:mm")` (which silently uses the host's zone).
 *
 * Before this, the admin action parsed the staff-entered "IST" value with the
 * server's timezone: on a UTC host 10:00 IST was stored as 10:00Z and every
 * student saw 3:30 pm IST.
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export class InvalidIstDateTimeError extends Error {}

/**
 * "2026-11-18T10:00" (a datetime-local value meaning IST) -> "2026-11-18T04:30:00.000Z".
 * Throws InvalidIstDateTimeError for anything that isn't a real calendar date/time.
 */
export function istDateTimeLocalToUtcIso(value: string): string {
  const match = DATETIME_LOCAL.exec(value.trim());
  if (!match) throw new InvalidIstDateTimeError("Enter the scheduled date and time in the format shown.");
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y), month = Number(mo), day = Number(d), hour = Number(h), minute = Number(mi), second = Number(s ?? "0");
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MINUTES * 60_000;
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day ||
    check.getUTCHours() !== hour || check.getUTCMinutes() !== minute || second > 59
  ) {
    throw new InvalidIstDateTimeError("That date or time doesn't exist. Please check it and try again.");
  }
  return new Date(utcMs).toISOString();
}

/** Stored ISO instant -> the IST datetime-local value staff see in the form, e.g. "2026-11-18T10:00". */
export function utcIsoToIstDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const ist = new Date(ms + IST_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}
