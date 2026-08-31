import { NextResponse } from "next/server";
import { getProviderById, recordExternalSearchClick } from "@/lib/supabase/education/external-search";
import { validateExternalUrl } from "@/lib/education/external-search/url-validation";
import { renderGoErrorPage } from "../../../_shared";

/**
 * Secure server-controlled outbound redirect for a PROVIDER'S landing page
 * with no specific subject/degree mapping — used by the "Open official
 * course search" button on a landing-page-only provider card (no active
 * mapping exists for the student's exact search, so there is nothing to
 * point src/app/go/course-search/[mappingId] at). Same "only an internal
 * id, never a URL, in the request" design as the mapping-scoped route —
 * see that route's own docblock for the full rationale.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ providerId: string }> }): Promise<NextResponse> {
  const { providerId } = await params;

  if (!providerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerId)) {
    return renderGoErrorPage("The link you followed is not a valid trusted-portal link.");
  }

  const provider = await getProviderById(providerId);
  if (!provider) {
    return renderGoErrorPage("This trusted-portal link could not be found — it may have been deactivated or never existed.");
  }
  if (!provider.active) {
    return renderGoErrorPage("This trusted-portal link's provider is not currently active.");
  }

  let target: string | null = null;
  const baseCheck = validateExternalUrl(provider.baseUrl, provider.officialDomain);
  if (baseCheck.valid) target = provider.baseUrl;
  if (!target && provider.fallbackUrl) {
    const fallbackCheck = validateExternalUrl(provider.fallbackUrl, provider.officialDomain);
    if (fallbackCheck.valid) target = provider.fallbackUrl;
  }
  if (!target) {
    return renderGoErrorPage("This trusted-portal link's destination could not be safely verified right now.");
  }

  await recordExternalSearchClick({
    providerId: provider.id,
    mappingId: null,
    canonicalSubjectId: null,
    degreeLevel: null,
    destinationCountryCode: provider.countryCode,
    sourcePage: "courses_search",
  });

  return NextResponse.redirect(target);
}
