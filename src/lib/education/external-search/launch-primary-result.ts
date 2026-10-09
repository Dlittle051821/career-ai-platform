/**
 * M20B — Trusted Country Source Operational Integration.
 *
 * Pure, framework-free glue between M20A's launch-country registry
 * (launch-country-sources.ts) and the EXISTING Trusted Global Course
 * Search result shape (AdapterResult, from
 * src/lib/education/external-search/adapter.ts). No DB access, no side
 * effects — same convention as every other module in this directory.
 *
 * WHY THIS FILE EXISTS, RATHER THAN FOLDING ITS LOGIC INTO
 * getTrustedSearchResults DIRECTLY: `src/lib/supabase/education/
 * external-search.ts` (getTrustedSearchResults) talks to Supabase, so — by
 * this codebase's own long-standing convention (documented repeatedly
 * throughout vitest.config.mts) — it is never unit-tested directly. The
 * actual DECISION logic this milestone needed ("is this result the
 * launch-country primary?", "in what order should results appear?") is
 * pulled out into this small, pure, directly-testable module, and
 * `external-search.ts` only gets a one-line integration (see its own
 * comment at the call site) — never a wholesale rewrite.
 *
 * PRIMARY SOURCE SELECTION RULE (reused, not reinvented): this module
 * answers "is this result the launch-primary for its destination
 * country?" ENTIRELY by delegating to M20A's own
 * `getLaunchCountryPrimarySource()` — it never infers primary status
 * from provider display order, provider type, or any other signal, and
 * it never hardcodes a second country→provider mapping. M20A's registry
 * remains the single source of truth.
 */

import { getLaunchCountryPrimarySource } from "./launch-country-sources";
import type { AdapterResult } from "./provider-types";

/**
 * True if `result` is the launch-country primary source for
 * `destinationCountryCode` — i.e. `result.providerSlug` matches the
 * `providerSlug` M20A's registry designates as that country's one
 * primary. False for every other result, including a perfectly valid
 * UX07 specialist provider for the same country (UCAS/NCES/EduCanada/
 * CRICOS/CAO) — those remain valid, coexisting results; they are simply
 * never the launch-primary one. False (never throws) for a
 * `destinationCountryCode` that isn't a Tier 1 launch country at all —
 * an invalid/unsupported country code is never silently treated as
 * having a primary source.
 */
export function isLaunchPrimaryResult(
  result: Pick<AdapterResult, "providerSlug">,
  destinationCountryCode: string | null | undefined,
): boolean {
  const primary = getLaunchCountryPrimarySource(destinationCountryCode);
  if (!primary) return false;
  return result.providerSlug === primary.providerSlug;
}

/**
 * The full, intentional ordering for a destination's trusted-search
 * results: a genuine, active, non-stale FILTERED deep link always comes
 * first (this is the pre-existing, already-shipped UX07 rule — never
 * changed by M20B), and — ONLY as a tie-break among results of equal
 * filtered-ness — the launch-country primary source comes before any
 * other (non-primary/specialist) result. Every other relative ordering
 * (e.g. between two non-primary specialist providers) is left exactly as
 * `Array.prototype.sort`'s guaranteed stability preserves it — this
 * function never reorders two results it has no opinion about.
 *
 * This is the ONLY place "how should trusted-search results be ordered"
 * is decided — `getTrustedSearchResults` calls this directly rather than
 * sorting inline, so the full rule (not just the isFiltered half of it)
 * is unit-testable here without a DB.
 */
export function compareTrustedSearchResults(
  a: AdapterResult,
  b: AdapterResult,
  destinationCountryCode: string | null | undefined,
): number {
  const filteredDiff = Number(b.isFiltered) - Number(a.isFiltered);
  if (filteredDiff !== 0) return filteredDiff;

  const primaryDiff = Number(isLaunchPrimaryResult(b, destinationCountryCode)) - Number(isLaunchPrimaryResult(a, destinationCountryCode));
  return primaryDiff;
}
