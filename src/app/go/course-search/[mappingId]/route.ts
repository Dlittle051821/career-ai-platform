import { NextResponse } from "next/server";
import { getMappingWithProviderById, recordExternalSearchClick } from "@/lib/supabase/education/external-search";
import { validateExternalUrl } from "@/lib/education/external-search/url-validation";
import { renderGoErrorPage } from "../../_shared";

/**
 * Secure server-controlled outbound redirect for a specific trusted-search
 * MAPPING. The ONLY input this route accepts is the internal `mappingId`
 * path segment — there is deliberately no `?url=` (or any other
 * client-suppliable URL) parameter anywhere on this route, which is what
 * makes it safe from open-redirect abuse (spec: "Do not implement an
 * unrestricted route such as /out?url=<anything>").
 *
 * Every step below is spelled out explicitly, matching the spec's own
 * numbered list, even where an earlier layer (RLS) already enforces part
 * of it — "never trust, always re-derive server-side", the same
 * discipline the pricing checkout RPC follows (see
 * supabase/migrations/0007_nextwise_pricing_offers.sql PART 7's own
 * header comment).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ mappingId: string }> }): Promise<NextResponse> {
  const { mappingId } = await params;

  // 1. Basic shape check before even querying — a mappingId must look like
  //    a uuid. Not itself a security boundary (the DB query below is the
  //    real check), just a fast, honest rejection of garbage input.
  if (!mappingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mappingId)) {
    return renderGoErrorPage("The link you followed is not a valid trusted-portal link.");
  }

  // 2. Load the mapping (and its parent provider) from Supabase. RLS
  //    already restricts an anon/authenticated non-admin caller to
  //    mapping_status='active' rows whose provider is active=true — an
  //    inactive mapping or an inactive provider's mapping simply comes
  //    back as `null` here.
  const loaded = await getMappingWithProviderById(mappingId);
  if (!loaded) {
    return renderGoErrorPage("This trusted-portal link could not be found — it may have been deactivated or never existed.");
  }
  const { mapping, provider } = loaded;

  // 3. Confirm the mapping is active (defense in depth on top of RLS).
  if (mapping.mappingStatus !== "active") {
    return renderGoErrorPage("This trusted-portal link is not currently active.");
  }

  // 4. Confirm the provider is active (defense in depth on top of RLS).
  if (!provider.active) {
    return renderGoErrorPage("This trusted-portal link's provider is not currently active.");
  }

  // 5. Re-validate the final hostname against the provider's stored
  //    official-domain allow-list — even though this URL is already
  //    stored and was validated when the admin saved it, it is
  //    re-validated here, right before use, exactly as the spec requires.
  //    Falls back to the provider's own base URL, then its fallback URL,
  //    if the stored deep link ever fails this re-check.
  let target: string | null = null;
  if (mapping.verifiedUrl) {
    const check = validateExternalUrl(mapping.verifiedUrl, provider.officialDomain);
    if (check.valid) target = mapping.verifiedUrl;
  }
  if (!target) {
    const baseCheck = validateExternalUrl(provider.baseUrl, provider.officialDomain);
    if (baseCheck.valid) target = provider.baseUrl;
  }
  if (!target && provider.fallbackUrl) {
    const fallbackCheck = validateExternalUrl(provider.fallbackUrl, provider.officialDomain);
    if (fallbackCheck.valid) target = provider.fallbackUrl;
  }
  if (!target) {
    return renderGoErrorPage("This trusted-portal link's destination could not be safely verified right now.");
  }

  // 6. Record a privacy-conscious outbound click — server-side, from the
  //    already-validated provider/mapping ids only. user_id/occurred_at
  //    are server-stamped by the database trigger regardless of anything
  //    sent here (see stamp_external_search_click() in
  //    0009_trusted_course_search.sql).
  await recordExternalSearchClick({
    providerId: provider.id,
    mappingId: mapping.id,
    canonicalSubjectId: mapping.canonicalSubjectId,
    degreeLevel: mapping.degreeLevel,
    destinationCountryCode: mapping.destinationCountryCode,
    sourcePage: "courses_search",
  });

  // 7. Redirect to the validated URL.
  return NextResponse.redirect(target);
}
