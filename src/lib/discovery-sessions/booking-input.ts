/**
 * CC-24 — server-side shape, allow-list and length checks for a student's
 * Discovery Session request.
 *
 * The booking form only offers fixed choices and a short note, but a Server
 * Action can be called directly with any payload. Before CC-24 the action
 * stored whatever it was sent (CC-23 found a 20,000-character note and a
 * 5,000-character "language" saved verbatim). The database only enforces
 * the contact-method CHECK constraint, so everything else is checked here.
 *
 * Pure and framework-free (no Supabase, no "server-only") so the booking
 * form, the I/O layer and the tests share exactly one definition.
 */

import { DISCOVERY_SESSION_CONTACT_METHODS, type DiscoverySessionContactMethod } from "@/types/discovery-session";

/** The time-of-day choices the booking form offers. */
export const DISCOVERY_SESSION_TIME_RANGES = ["morning", "afternoon", "evening"] as const;
export type DiscoverySessionTimeRange = (typeof DISCOVERY_SESSION_TIME_RANGES)[number];

/** The languages the booking form offers. */
export const DISCOVERY_SESSION_LANGUAGES = ["English", "Odia", "Hindi"] as const;
export type DiscoverySessionLanguage = (typeof DISCOVERY_SESSION_LANGUAGES)[number];

/** Maximum length of the optional note to the counsellor, in characters. */
export const DISCOVERY_SESSION_NOTES_MAX_LENGTH = 1000;

export interface NormalizedBookingInput {
  preferredContactMethod: DiscoverySessionContactMethod | null;
  preferredTimeRange: DiscoverySessionTimeRange | null;
  preferredLanguage: DiscoverySessionLanguage | null;
  studentNotes: string | null;
}

export type BookingInputResult = { ok: true; value: NormalizedBookingInput } | { ok: false; reason: string };

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/** Treats undefined, null and "" as "no preference"; anything else must be a string. */
function optionalString(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  return { ok: true, value };
}

/**
 * Validates and normalizes untrusted booking input. Never throws. Returns a
 * student-safe reason on failure (no field internals, no echo of the input).
 */
export function normalizeBookingInput(input: unknown): BookingInputResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "We couldn't read your request. Please refresh the page and try again." };
  }
  const raw = input as Record<string, unknown>;

  const contact = optionalString(raw.preferredContactMethod);
  if (!contact.ok || (contact.value !== null && !isOneOf(contact.value, DISCOVERY_SESSION_CONTACT_METHODS))) {
    return { ok: false, reason: "Please choose phone, video call or WhatsApp as your contact method." };
  }

  const timeRange = optionalString(raw.preferredTimeRange);
  if (!timeRange.ok || (timeRange.value !== null && !isOneOf(timeRange.value, DISCOVERY_SESSION_TIME_RANGES))) {
    return { ok: false, reason: "Please choose morning, afternoon, evening or no preference for the time." };
  }

  const language = optionalString(raw.preferredLanguage);
  if (!language.ok || (language.value !== null && !isOneOf(language.value, DISCOVERY_SESSION_LANGUAGES))) {
    return { ok: false, reason: "Please choose English, Odia or Hindi as your preferred language." };
  }

  const notes = optionalString(raw.studentNotes);
  if (!notes.ok) return { ok: false, reason: "We couldn't read your note. Please try again." };
  const trimmedNotes = notes.value?.trim() ?? "";
  if (trimmedNotes.length > DISCOVERY_SESSION_NOTES_MAX_LENGTH) {
    return { ok: false, reason: `Please keep your note to ${DISCOVERY_SESSION_NOTES_MAX_LENGTH} characters or fewer.` };
  }

  return {
    ok: true,
    value: {
      preferredContactMethod: contact.value as DiscoverySessionContactMethod | null,
      preferredTimeRange: timeRange.value as DiscoverySessionTimeRange | null,
      preferredLanguage: language.value as DiscoverySessionLanguage | null,
      studentNotes: trimmedNotes || null,
    },
  };
}
