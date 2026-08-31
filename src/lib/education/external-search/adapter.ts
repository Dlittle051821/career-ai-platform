/**
 * Trusted Global Course Search — provider-adapter resolution logic.
 *
 * Pure, framework-free: takes a ProviderRecord and (optionally) one
 * MappingRecord already selected for it, and returns exactly what the
 * spec's "Link-generation rules" section requires an adapter to return.
 * No DB access, no network access, no knowledge of Next.js/Supabase — the
 * data-access layer (src/lib/supabase/education/external-search.ts) is
 * responsible for finding the right provider/mapping rows and handing
 * them to this module; this module is responsible for deciding, from
 * those rows alone, what is SAFE and CORRECT to show a student.
 *
 * CRITICAL RULES enforced here as code (see the spec's own list):
 *   - Never construct a URL from undocumented numeric filter IDs — this
 *     module NEVER builds a URL by concatenating provider_subject_code/
 *     provider_degree_code into a query string itself. It only ever uses
 *     a `verifiedUrl` string that an admin already typed in and verified
 *     end-to-end (see MappingRecord.verifiedUrl). provider_subject_code/
 *     provider_degree_code are stored purely for admin-facing display
 *     ("this mapping corresponds to DAAD's fos[0]=96") — never fed back
 *     into a URL-building function.
 *   - Only allow-listed HTTPS domains — every URL this module returns has
 *     already passed validateExternalUrl() against the provider's own
 *     official_domain.
 *   - If a stored deep link fails validation OR its verification is
 *     stale, fall back to the provider's official landing page.
 *   - A provider whose supportedDegreeLevels excludes the requested
 *     degree level is never offered at all (Erasmus Mundus / Bachelor's
 *     gating).
 */

import type { AdapterOutcome, AdapterResult, AppliedFilter, MappingRecord, ProviderRecord } from "./provider-types";
import { DEGREE_LEVEL_LABELS, type CanonicalDegreeLevel } from "./taxonomy";
import { isVerificationStale, validateExternalUrl } from "./url-validation";

export interface AdapterQuery {
  canonicalSubjectId: string | null;
  canonicalSubjectLabel: string | null;
  degreeLevel: CanonicalDegreeLevel | null;
}

/** Is `provider`'s warning currently meant to be shown, given its own effective/review dates? A null effectiveAt means "always effective once set". `warningReviewAt` is a REVIEW reminder for admins (surfaced in the admin queue), not an automatic expiry — a temporary notice does not silently vanish from the public page the moment its review date passes; an admin must explicitly review and either extend or remove it. This is what "make this warning editable... with effective and expiry/review dates. Do not permanently hard-code a temporary notice without a review mechanism" means here: the review MECHANISM is the admin queue (src/lib/supabase/admin/external-search.ts's listStaleAndReviewDue), not a silent auto-hide. */
export function isWarningCurrentlyEffective(provider: Pick<ProviderRecord, "warningText" | "warningEffectiveAt">, now: Date = new Date()): boolean {
  if (!provider.warningText) return false;
  if (!provider.warningEffectiveAt) return true;
  const effective = new Date(provider.warningEffectiveAt);
  if (Number.isNaN(effective.getTime())) return true;
  return effective.getTime() <= now.getTime();
}

function buildAppliedFilters(query: AdapterQuery): AppliedFilter[] {
  const filters: AppliedFilter[] = [];
  if (query.degreeLevel) filters.push({ label: "Degree level", value: DEGREE_LEVEL_LABELS[query.degreeLevel] });
  if (query.canonicalSubjectLabel) filters.push({ label: "Subject", value: query.canonicalSubjectLabel });
  return filters;
}

function buildDefaultInstructions(provider: ProviderRecord, query: AdapterQuery): string {
  const parts: string[] = [`Open ${provider.displayName}`];
  if (query.canonicalSubjectLabel) {
    parts.push(`and search for '${query.canonicalSubjectLabel}'`);
  } else {
    parts.push("and use its own search");
  }
  if (query.degreeLevel) {
    parts.push(`; select ${DEGREE_LEVEL_LABELS[query.degreeLevel]} as the course level`);
  }
  return `${parts.join(" ")}.`;
}

/**
 * Resolves one provider + (optional) mapping into the single result the
 * search UI/admin "test link" affordance should use. Returns
 * `{ available: false, reason }` when this provider must not be offered
 * at all for this query (inactive, or degree level not supported) —
 * callers should simply omit it from the results list in that case, not
 * render an error card.
 */
export function buildProviderSearchResult(provider: ProviderRecord, mapping: MappingRecord | null, query: AdapterQuery, now: Date = new Date()): AdapterOutcome {
  if (!provider.active) {
    return { available: false, reason: "provider_inactive", providerId: provider.id };
  }

  if (query.degreeLevel && provider.supportedDegreeLevels.length > 0 && !provider.supportedDegreeLevels.includes(query.degreeLevel)) {
    return { available: false, reason: "degree_level_not_supported", providerId: provider.id };
  }

  const warningText = isWarningCurrentlyEffective(provider, now) ? provider.warningText : null;
  const appliedFilters = buildAppliedFilters(query);

  // --- Attempt 1: a genuine, active, verified, non-stale deep link. -------
  if (mapping && mapping.providerId === provider.id && mapping.mappingStatus === "active" && mapping.verifiedUrl) {
    const validation = validateExternalUrl(mapping.verifiedUrl, provider.officialDomain);
    const stale = isVerificationStale(mapping.lastVerifiedAt, now);
    if (validation.valid && !stale) {
      return {
        available: true,
        providerId: provider.id,
        providerSlug: provider.slug,
        providerDisplayName: provider.displayName,
        officialDomain: provider.officialDomain,
        region: provider.region,
        countryCode: provider.countryCode,
        url: mapping.verifiedUrl,
        canonicalSubjectId: query.canonicalSubjectId,
        canonicalSubjectLabel: query.canonicalSubjectLabel,
        degreeLevel: query.degreeLevel,
        degreeLevelLabel: query.degreeLevel ? DEGREE_LEVEL_LABELS[query.degreeLevel] : null,
        appliedFilters,
        isFiltered: true,
        requiresManualSearch: false,
        instructions: null,
        warningText,
        linkVerificationDate: mapping.lastVerifiedAt,
        strategyUsed: provider.strategy === "query_parameter_search" ? "query_parameter_search" : "verified_deep_link",
        mappingId: mapping.id,
        isStale: false,
      };
    }
    // Falls through deliberately — an invalid or stale deep link is never
    // surfaced, even partially; the student sees the landing-page fallback
    // below instead, exactly as the spec's "safe fallback when a mapping
    // is inactive" / "safe fallback when verification is stale" tests
    // require.
  }

  // --- Attempt 2: manual search instructions from the mapping, if any. ---
  const manualInstructions = mapping && mapping.providerId === provider.id ? mapping.manualInstructions : null;

  // --- Attempt 3: landing page / fallback URL. -----------------------------
  const landingCandidates: Array<{ url: string | null; source: "base" | "fallback" }> = [
    { url: provider.baseUrl, source: "base" },
    { url: provider.fallbackUrl, source: "fallback" },
  ];

  for (const candidate of landingCandidates) {
    const validation = validateExternalUrl(candidate.url, provider.officialDomain);
    if (!validation.valid) continue;

    const providerStale = isVerificationStale(provider.lastVerifiedAt, now);
    const instructions = manualInstructions ?? buildDefaultInstructions(provider, query);

    return {
      available: true,
      providerId: provider.id,
      providerSlug: provider.slug,
      providerDisplayName: provider.displayName,
      officialDomain: provider.officialDomain,
      region: provider.region,
      countryCode: provider.countryCode,
      url: candidate.url as string,
      canonicalSubjectId: query.canonicalSubjectId,
      canonicalSubjectLabel: query.canonicalSubjectLabel,
      degreeLevel: query.degreeLevel,
      degreeLevelLabel: query.degreeLevel ? DEGREE_LEVEL_LABELS[query.degreeLevel] : null,
      appliedFilters,
      isFiltered: false,
      requiresManualSearch: true,
      instructions,
      warningText,
      linkVerificationDate: provider.lastVerifiedAt,
      strategyUsed: manualInstructions ? "manual_search_instructions" : provider.strategy === "manual_search_instructions" ? "manual_search_instructions" : "official_landing_page",
      mappingId: null,
      isStale: providerStale,
    };
  }

  // Neither the base URL nor the fallback URL passed validation — this
  // provider genuinely cannot be offered right now (e.g. a domain typo an
  // admin has not yet corrected). Fail closed, never half-render a broken
  // link.
  return { available: false, reason: "no_valid_url_available", providerId: provider.id };
}

/** True when this outcome represents a genuine, filtered deep link the student can click straight through on. */
export function isFilteredDeepLink(outcome: AdapterOutcome): outcome is AdapterResult {
  return outcome.available && outcome.isFiltered;
}

/**
 * True when this (provider, query) combination should be recorded as a
 * "mapping needed" search-gap event — i.e. the provider IS offered, but
 * only via a landing page / manual instructions, never a filtered deep
 * link. Mirrors the spec's "When no verified deep-link mapping exists...
 * Record an anonymized 'mapping needed' event."
 */
export function needsMappingGapEvent(outcome: AdapterOutcome): boolean {
  return outcome.available && !outcome.isFiltered;
}
