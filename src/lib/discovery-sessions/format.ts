/**
 * NW01 Part G "Discovery Session & Appointment Truth".
 *
 * Confirmed defect: every place in this product that rendered a Discovery
 * Session's real `scheduledAt`/`createdAt`/`updatedAt` timestamp did so via
 * a bare `new Date(iso).toLocaleString("en-IN", {...})` (or
 * `toLocaleDateString("en-IN")`) call with no `timeZone` option set at all.
 * Without an explicit `timeZone`, `Intl`/`Date.prototype.toLocaleString`
 * formats using the RUNTIME's own default timezone — which, for a
 * server-rendered Next.js page, is whatever timezone the hosting
 * environment happens to run in (commonly UTC), not India time, and
 * certainly not whatever timezone the viewer is actually in. The "en-IN"
 * locale only ever affected number/date PUNCTUATION (comma placement,
 * month abbreviation style) — it has never actually meant "interpret this
 * in Indian time" on its own. Nothing in this product labelled the
 * resulting string with a zone either, so a time that happened to be
 * correct was indistinguishable from one that wasn't.
 *
 * This matters specifically because of this milestone's India + Europe
 * launch scope (Germany, Ireland, Netherlands, France, Sweden, Denmark) —
 * NextWise's counsellors operate on India time, so a European student
 * reading an unlabelled time has no way to know whether it's already been
 * converted for them or not.
 *
 * The fix: every Discovery Session date/time this product shows is always
 * explicitly formatted in `Asia/Kolkata` (the one timezone every
 * counsellor and the booking system itself actually operates in) and is
 * always suffixed with an explicit "IST" label — correct and unambiguous
 * for every viewer, in India or in the European launch countries, without
 * needing per-viewer timezone detection (which this product does not do
 * anywhere and is out of this repair-only milestone's scope to add).
 */

const IST_TIME_ZONE = "Asia/Kolkata";

/** e.g. "Mon, 15 Jan, 10:00 am IST" — for a real scheduled/completed Discovery Session moment. */
export function formatDiscoverySessionDateTime(iso: string): string {
  const formatted = new Date(iso).toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatted} IST`;
}

/** e.g. "15 Jan 2026 IST" — for a lower-stakes "requested on" / "last updated" date, still never ambiguous about which zone's calendar day it is. */
export function formatDiscoverySessionDate(iso: string): string {
  const formatted = new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatted} IST`;
}
