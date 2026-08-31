/**
 * Trusted Global Course Search — pure URL/domain validation and
 * verification-staleness rules. No DB access, no network access: every
 * function here operates only on strings/dates already in hand.
 *
 * This is the ONLY place a URL is ever judged safe or unsafe to hand a
 * student's browser to. It is deliberately conservative: reject first,
 * allow only what is explicitly provable safe. Used by both the adapter
 * (src/lib/education/external-search/adapter.ts) when choosing what to
 * show on a search-results card, and — independently, as defense in depth
 * — by the redirect route (src/app/go/course-search/[mappingId]/route.ts)
 * right before issuing an actual HTTP redirect.
 */

export type UrlRejectionReason =
  | "empty"
  | "unparseable"
  | "not_https"
  | "has_credentials"
  | "javascript_protocol"
  | "host_not_allowlisted";

export interface UrlValidationResult {
  valid: boolean;
  /** Present only when valid is false. */
  reason?: UrlRejectionReason;
  /** The parsed, lowercased hostname — present whenever the URL at least parsed, even if ultimately rejected (useful for admin-facing diagnostics). */
  hostname?: string;
}

/**
 * True if `hostname` is the allow-listed domain itself, or a subdomain of
 * it (e.g. `www2.daad.de` is allowed when the allow-listed domain is
 * `daad.de`, but `daad.de.evil.example` is NOT — the match is anchored on
 * a literal dot boundary, never a bare substring check).
 */
export function hostnameMatchesAllowedDomain(hostname: string, allowedDomain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const allowed = allowedDomain.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
  if (!allowed) return false;
  return host === allowed || host.endsWith(`.${allowed}`);
}

/**
 * Validates a URL against every "Critical rule" the spec lists for
 * link-generation: HTTPS only, no embedded credentials, no javascript:
 * protocol, and the resolved host must be on the provider's own
 * official-domain allow-list. This function does NOT fetch the URL or
 * inspect where it might redirect to — it only inspects the URL string
 * itself, which is exactly the input this system ever needs to trust
 * (every URL passed in is either an admin-entered `verified_url`/
 * `base_url`/`fallback_url`, never student input).
 */
export function validateExternalUrl(rawUrl: string | null | undefined, allowedDomain: string): UrlValidationResult {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return { valid: false, reason: "empty" };

  // Reject obvious script-execution attempts before even attempting to
  // parse as a URL — `new URL("javascript:...")` parses "successfully"
  // with protocol "javascript:", but checking the raw string first means
  // this rule holds even for maliciously-crafted strings a URL parser
  // might normalize in a surprising way.
  if (/^\s*javascript:/i.test(trimmed)) {
    return { valid: false, reason: "javascript_protocol" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "unparseable" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "not_https" };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "has_credentials" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostnameMatchesAllowedDomain(hostname, allowedDomain)) {
    return { valid: false, reason: "host_not_allowlisted", hostname };
  }

  return { valid: true, hostname };
}

// ---------------------------------------------------------------------------
// Verification staleness
// ---------------------------------------------------------------------------

/**
 * "Stale" threshold, documented explicitly per the spec's requirement to
 * "define 'stale' reasonably... make this explicit and documented, not
 * implicit". A verified deep link older than this is no longer trusted as
 * a filtered result and the adapter falls back to the provider's landing
 * page — the exact URL/fee/deadline machinery on the other end of an
 * unmonitored deep link is the single most likely thing to silently
 * change or break over a year.
 */
export const STALE_VERIFICATION_THRESHOLD_MONTHS = 12;

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const dayFraction = (to.getDate() - from.getDate()) / 30;
  return years * 12 + months + dayFraction;
}

/**
 * True when `lastVerifiedAt` (an ISO date/timestamp string) is older than
 * STALE_VERIFICATION_THRESHOLD_MONTHS relative to `now`. A null/unparseable
 * `lastVerifiedAt` is treated as stale (never verified is the same as
 * "cannot currently be trusted as a live deep link" — the safe default).
 */
export function isVerificationStale(
  lastVerifiedAt: string | null | undefined,
  now: Date = new Date(),
  thresholdMonths: number = STALE_VERIFICATION_THRESHOLD_MONTHS,
): boolean {
  if (!lastVerifiedAt) return true;
  const verified = new Date(lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return true;
  if (verified.getTime() > now.getTime()) return false; // a future-dated verification is not stale (clock skew tolerance, mirrors calculateFreshnessBand's convention)
  return monthsBetween(verified, now) > thresholdMonths;
}
