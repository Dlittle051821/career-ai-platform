/**
 * M20A — Trusted Source Attribution.
 *
 * Pure, framework-free text helpers: no DB access, no side effects, same
 * convention as every other module in this directory. This is the ONE
 * shared place that decides the user-facing wording used to attribute an
 * external authoritative source — the same "one shared helper, not three
 * separate ternaries" discipline UX09's accessible-graphic.ts
 * (getGraphicAriaProps()) already established for this codebase.
 *
 * IMPORTANT SOURCE RULE (this milestone's own spec): these are EXTERNAL
 * AUTHORITIES. Nextwise must never imply partnership, endorsement,
 * affiliation, official representation, or data ownership unless such a
 * relationship actually exists — none does today. Every string this
 * module produces is built ONLY from the attribution/badge labels and the
 * source's own real name; it never says "our partner", "Nextwise official
 * partner", or "verified by Nextwise" (that last phrase already has no
 * precise internal meaning in this codebase — grep confirms it is not an
 * existing defined term — so it is treated as forbidden, per the spec's
 * own "unless that term already has a precise internal meaning" carve-
 * out). This mirrors the wording already shipped in
 * src/components/sections/education/TrustedExternalSearchCard.tsx
 * ("{provider} is not part of NextWise — availability and content on
 * that site are managed entirely by {provider}") — this module does not
 * replace that existing card (out of scope for M20A; it already does the
 * right thing), it exists for the country-fallback messaging M20B/M20C
 * will build next, so that messaging starts from the same discipline.
 */

export const TRUSTED_SOURCE_ATTRIBUTION_LABEL = "Official study source";

export const TRUSTED_NATIONAL_SOURCE_LABEL = "Trusted national source";

export const EXTERNAL_LINK_BADGE_LABEL = "External website";

export const CONTINUE_ON_OFFICIAL_SOURCE_LABEL = "Continue on the official source";

export interface TrustedSourceAttribution {
  /** e.g. "Official study source" — the heading/eyebrow label above the source's own name. */
  label: string;
  /** The source's own real name/authority, verbatim — never rewritten to sound like a Nextwise product. */
  sourceName: string;
  /** e.g. "External website" — the badge/affordance text marking this as leaving Nextwise. */
  badge: string;
}

/** Builds the consistent {label, sourceName, badge} triple for one trusted external source, from its own display name alone. Pure — never fetches or infers anything about the source. */
export function buildTrustedSourceAttribution(sourceDisplayName: string): TrustedSourceAttribution {
  return {
    label: TRUSTED_SOURCE_ATTRIBUTION_LABEL,
    sourceName: sourceDisplayName,
    badge: EXTERNAL_LINK_BADGE_LABEL,
  };
}

/**
 * Phrases that would imply a partnership/endorsement/affiliation/
 * ownership relationship this codebase has never established with any
 * external source. Lowercase, for case-insensitive matching by
 * `containsUnsupportedPartnershipLanguage`. Deliberately a short,
 * explicit, hand-reviewed list (same "auditable, not fuzzy-matched"
 * discipline as taxonomy.ts's SUBJECT_TAXONOMY) rather than a generic
 * sentiment/NLP check.
 */
export const UNSUPPORTED_PARTNERSHIP_PHRASES: readonly string[] = [
  "our partner",
  "our partners",
  "nextwise official partner",
  "official partner of nextwise",
  "official nextwise partner",
  "verified by nextwise",
  "partnered with nextwise",
  "nextwise partnership",
  "in partnership with nextwise",
  "endorsed by nextwise",
  "nextwise-endorsed",
  "affiliated with nextwise",
  "nextwise-affiliated",
];

/** True if `text` contains any phrase from UNSUPPORTED_PARTNERSHIP_PHRASES (case-insensitive, substring match). Use this to guard any new country-source copy — including this registry's own `authority`/`purpose` strings, see attribution.test.ts. */
export function containsUnsupportedPartnershipLanguage(text: string | null | undefined): boolean {
  if (!text) return false;
  const lowered = text.toLowerCase();
  return UNSUPPORTED_PARTNERSHIP_PHRASES.some((phrase) => lowered.includes(phrase));
}
