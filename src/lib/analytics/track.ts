/**
 * Milestone 9 — pure event validation/shaping. Nothing in this file talks
 * to Supabase (that lives in src/lib/supabase/analytics/, the I/O layer
 * that wraps this) — same "pure, framework-free src/lib/<domain> vs I/O
 * src/lib/supabase/<domain>" convention as src/lib/pricing/ vs
 * src/lib/supabase/pricing/, src/lib/admin/ vs src/lib/supabase/admin/,
 * etc. This is what src/lib/analytics/**\/*.test.ts actually exercises.
 */

import { isImplementedEventName, type ImplementedEventName } from "./events";

const MAX_STRING_FIELD_LENGTH = 128;
const MAX_PATH_LENGTH = 512;
const MAX_PROPERTY_STRING_LENGTH = 300;
const MAX_PROPERTY_KEYS = 20;
const MAX_PROPERTIES_JSON_LENGTH = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Property KEY names that look like they might carry something this
 * table must never hold (spec: no passwords, tokens, full addresses,
 * payment credentials, private notes, or unnecessary free text). Matched
 * case-insensitively against the key, not the value — a value can't be
 * meaningfully sanitized without knowing what it is, so the safer rule is
 * "don't even accept a key shaped like this one". Any matching key is
 * dropped from `properties` before the event is ever built, never
 * transmitted.
 */
const DENYLISTED_PROPERTY_KEY_PATTERN =
  /password|token|secret|ssn|ssn_|aadhaar|passport|credit[_-]?card|card[_-]?number|cvv|address|note(s)?$|ip_address|auth/i;

export interface TrackEventUtm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}

export interface TrackEventInput {
  eventName: ImplementedEventName;
  sessionId?: string | null;
  /**
   * Pre-login/anonymous session identifier. Documented-but-not-yet-wired:
   * no page in this codebase currently generates one (see
   * docs/M9_IMPLEMENTATION.md) — every call site today either passes
   * `null` or omits it, relying on the database trigger to stamp `user_id`
   * from auth.uid() (null for a genuinely anonymous visitor). The column
   * and this field exist so a future session-identifier convention (e.g.
   * one modeled on pricing_analytics_events' `session_ref`, if that ever
   * gets wired up beyond its own table) can be plugged in without a schema
   * or type change.
   */
  anonymousId?: string | null;
  source?: string | null;
  path?: string | null;
  feature?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  properties?: Record<string, unknown>;
  utm?: TrackEventUtm;
}

/** The exact snake_case shape written to product_events — everything except event_name/session_id/anonymous_id/entity_type/entity_id/properties/utm_* is server-stamped by the database trigger (user_id, occurred_at) or defaulted (created_at), so this insert shape never includes them. */
export interface ProductEventInsert {
  event_name: string;
  session_id: string | null;
  anonymous_id: string | null;
  source: string | null;
  path: string | null;
  feature: string | null;
  entity_type: string | null;
  entity_id: string | null;
  properties: Record<string, unknown>;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

export type BuildEventResult = { ok: true; insert: ProductEventInsert; warnings: string[] } | { ok: false; reason: string };

function clampString(value: string | null | undefined, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Sanitizes an event's `properties` bag. This never rejects the whole
 * event over bad properties — an analytics client bug should never be the
 * reason a real event silently vanishes. Instead: malformed input becomes
 * `{}`, denylisted keys are dropped, oversized string values are
 * truncated, and if the object still exceeds the overall size cap after
 * all of that it is replaced with `{}` and a warning is recorded. See
 * track.test.ts for the exact cases this covers.
 */
function sanitizeProperties(input: unknown, warnings: string[]): Record<string, unknown> {
  if (input === undefined) return {};
  if (!isPlainObject(input)) {
    warnings.push("properties was not a plain object — dropped");
    return {};
  }

  const entries = Object.entries(input);
  const sanitized: Record<string, unknown> = {};
  let kept = 0;
  for (const [key, value] of entries) {
    if (kept >= MAX_PROPERTY_KEYS) {
      warnings.push(`properties had more than ${MAX_PROPERTY_KEYS} keys — extra keys dropped`);
      break;
    }
    if (DENYLISTED_PROPERTY_KEY_PATTERN.test(key)) {
      warnings.push(`properties key "${key}" looked sensitive — dropped`);
      continue;
    }
    if (typeof value === "string") {
      sanitized[key] = value.length > MAX_PROPERTY_STRING_LENGTH ? value.slice(0, MAX_PROPERTY_STRING_LENGTH) : value;
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      // Only keep arrays of primitives — never nested objects/arrays,
      // which could otherwise be used to smuggle arbitrary free text past
      // the key-name denylist above.
      sanitized[key] = value.filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean").slice(0, 20);
    } else {
      warnings.push(`properties key "${key}" had an unsupported value type — dropped`);
      continue;
    }
    kept += 1;
  }

  let json: string;
  try {
    json = JSON.stringify(sanitized);
  } catch {
    warnings.push("properties could not be serialized — dropped");
    return {};
  }
  if (json.length > MAX_PROPERTIES_JSON_LENGTH) {
    warnings.push(`properties exceeded ${MAX_PROPERTIES_JSON_LENGTH} bytes even after sanitization — dropped`);
    return {};
  }
  return sanitized;
}

function sanitizeEntityId(value: string | null | undefined, warnings: string[]): string | null {
  if (!value) return null;
  if (!UUID_RE.test(value)) {
    warnings.push("entityId was not a valid uuid — dropped");
    return null;
  }
  return value;
}

/**
 * Validates and shapes one event into the exact snake_case row
 * product_events expects. Returns `{ ok: false }` ONLY when `eventName`
 * itself is not a currently-implemented event (see events.ts) — that is
 * the one thing this function actually refuses to build an insert for,
 * since firing an unknown/reserved event name is always a bug at the call
 * site, never something worth silently proceeding past. Every other
 * problem (bad properties, a malformed entityId, an overlong string
 * field) is sanitized instead of rejected, so a single bad field never
 * takes down an otherwise-valid event — see sanitizeProperties() above.
 */
export function buildEventInsert(input: TrackEventInput): BuildEventResult {
  if (!input || typeof input.eventName !== "string" || !isImplementedEventName(input.eventName)) {
    return { ok: false, reason: `"${input?.eventName}" is not a currently-implemented event name (see src/lib/analytics/events.ts)` };
  }

  const warnings: string[] = [];
  const properties = sanitizeProperties(input.properties, warnings);
  const entityId = sanitizeEntityId(input.entityId, warnings);
  const utm = input.utm ?? {};

  const insert: ProductEventInsert = {
    event_name: input.eventName,
    session_id: clampString(input.sessionId, MAX_STRING_FIELD_LENGTH),
    anonymous_id: clampString(input.anonymousId, MAX_STRING_FIELD_LENGTH),
    source: clampString(input.source, 64),
    path: clampString(input.path, MAX_PATH_LENGTH),
    feature: clampString(input.feature, 64),
    entity_type: clampString(input.entityType, 64),
    entity_id: entityId,
    properties,
    utm_source: clampString(utm.source, MAX_STRING_FIELD_LENGTH),
    utm_medium: clampString(utm.medium, MAX_STRING_FIELD_LENGTH),
    utm_campaign: clampString(utm.campaign, MAX_STRING_FIELD_LENGTH),
    utm_content: clampString(utm.content, MAX_STRING_FIELD_LENGTH),
    utm_term: clampString(utm.term, MAX_STRING_FIELD_LENGTH),
  };

  return { ok: true, insert, warnings };
}
