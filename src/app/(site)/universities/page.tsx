import { Suspense } from "react";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import Link from "next/link";
import { PageHero } from "@/components/sections/PageHero";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { Pagination } from "@/components/sections/education/Pagination";
import { listDirectoryFacets, searchUniversities } from "@/lib/supabase/education/universities";
import { listSavedEntityIds } from "@/lib/supabase/education/saved-items";
import { DIRECTORY_PAGE_SIZE, directoryHref, hasActiveDirectoryFilters, parseDirectoryFilters } from "@/lib/education/university-discovery/directory";
import { UniversityDirectoryCard } from "@/components/sections/university-discovery/UniversityDirectoryCard";
import { DirectoryFilterBar } from "@/components/sections/university-discovery/DirectoryFilterBar";
import { getTrustedSearchResults } from "@/lib/supabase/education/external-search";
import { resolveListEmptyState } from "@/lib/ui/list-state";
import UniversitiesLoading from "./list-skeleton";
import { Building2, CircleAlert, SearchX } from "lucide-react";
import { DirectoryHero } from "@/components/sections/university-discovery/DirectoryHero";
import { getUniversityAccess } from "@/lib/supabase/education/university-access";
import { canUseUniversityDirectory } from "@/lib/education/university-discovery/access";
import { getUniversityDestination } from "@/lib/education/university-discovery/destinations";
import { getVerifiedOffer } from "@/lib/education/university-discovery/offer";
import { FreeDiscovery } from "@/components/sections/university-discovery/FreeDiscovery";
import "@/styles/university-discovery.css";

// M17A Step 5 — canonical is deliberately static and points at the clean
// list URL regardless of the q/country/city/studyMode/page query params
// this page reads from `searchParams`. See M17A_STEP5_REPORT.md.
export const metadata: Metadata = publicPageMetadata(
  "/universities",
  "Explore Universities in India & Abroad",
  "Explore universities by destination and study level. Review available profiles, discover courses and use trusted sources to research your shortlist.",
);

interface UniversitiesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Public University Explorer (Milestone 9). Not in `PROTECTED_PATHS` —
 * anyone can browse it, same convention as `/careers`
 * (src/app/(site)/careers/page.tsx). Server-side paginated via
 * searchUniversities(); never loads the full catalog into the browser.
 */
/**
 * CC-24 — the list skeleton used to be this segment's loading.tsx. A
 * segment-level loading.tsx also wraps every child route
 * (/universities/[...] detail pages) in a Suspense boundary, which sends HTTP
 * 200 before a detail page can answer 404 for an unknown or unpublished
 * record. The same skeleton is now this page's own Suspense fallback, so
 * the list behaves as before and the detail routes can return a real 404.
 */
export default function UniversitiesPage(props: UniversitiesPageProps) {
  return (
    <Suspense fallback={<UniversitiesLoading />}>
      <UniversitiesPageContent {...props} />
    </Suspense>
  );
}

async function UniversitiesPageContent({ searchParams }: UniversitiesPageProps) {
  const params = await searchParams;

  // University Discovery V3 — the access tier is decided on the server, from
  // the session and the live entitlement, before any directory query runs. A
  // visitor without directory access gets the public discovery experience
  // (destinations and official portals) and this function returns before
  // `searchUniversities` is ever called for them.
  const access = await getUniversityAccess();
  if (!canUseUniversityDirectory(access)) {
    const destination = getUniversityDestination(typeof params.destination === "string" ? params.destination : undefined);
    const trusted = destination
      ? await getTrustedSearchResults({ destinationCountryCode: destination.code, canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: null })
      : null;
    return (
      <div className="ud">
        {destination ? null : (
          <PageHero
            size="compact"
            eyebrow="University Explorer"
            title="Explore universities around the world."
            description="Choose your destination and explore trusted official resources to discover higher education opportunities."
          />
        )}
        <div className={destination ? "ud-wrap ud-section pt-28" : "ud-wrap ud-section"}>
          <FreeDiscovery kind="universities" destination={destination} resources={trusted?.results ?? []} accessState={access} offer={getVerifiedOffer()} />
        </div>
      </div>
    );
  }
  const filters = parseDirectoryFilters(params);
  const canSave = access !== "admin";
  const [facets, results, savedIds] = await Promise.all([
    listDirectoryFacets(filters.country || undefined),
    searchUniversities({
      q: filters.q || undefined,
      countryIds: filters.country ? [filters.country] : undefined,
      stateRegion: filters.state || undefined,
      city: filters.city || undefined,
      institutionCategory: filters.category || undefined,
      ownershipType: filters.ownership || undefined,
      studyArea: filters.area || undefined,
      sort: filters.sort,
      page: filters.page,
      pageSize: DIRECTORY_PAGE_SIZE,
    }),
    canSave ? listSavedEntityIds("university") : Promise.resolve([] as string[]),
  ]);
  const saved = new Set(savedIds);
  const filtered = hasActiveDirectoryFilters(filters);
  const emptyState = resolveListEmptyState({ itemCount: results.items.length, hasActiveFilters: filtered, error: results.error });

  const paginationParams: Record<string, string> = {};
  for (const key of ["q", "country", "state", "city", "category", "ownership", "area"] as const) {
    if (filters[key]) paginationParams[key] = filters[key];
  }
  if (filters.sort !== "verified") paginationParams.sort = filters.sort;

  const firstShown = (results.page - 1) * results.pageSize + 1;
  const lastShown = firstShown + results.items.length - 1;

  return (
    <div className="ud">
      <DirectoryHero access={access} canSave={canSave} savedCount={savedIds.length} />

      <div className="ud-wrap ud-section" style={{ paddingTop: 0 }}>
        <DirectoryFilterBar
          key={JSON.stringify(filters)}
          filters={filters}
          countries={facets.countries.map((country) => ({ id: country.id, name: country.name }))}
          states={facets.states}
          enriched={results.enriched}
        />

        {emptyState === "error" ? (
          <div className="ud-state" data-tone="error" role="alert" style={{ marginTop: "1.5rem" }}>
            <i aria-hidden="true"><CircleAlert /></i>
            <h2>We couldn&apos;t load universities right now</h2>
            <p>Something went wrong on our side while loading the directory. Your account and saved universities are not affected.</p>
            <Link href={directoryHref(filters, { page: filters.page })} className="ud-btn" data-variant="navy">Try again</Link>
          </div>
        ) : emptyState === "filtered_empty" ? (
          <div className="ud-state" style={{ marginTop: "1.5rem" }}>
            <i aria-hidden="true"><SearchX /></i>
            <h2>No universities match these filters</h2>
            <p>Try a broader search or remove a filter. The directory covers a growing set of institutions, not every university worldwide.</p>
            <Link href="/universities" className="ud-btn" data-variant="navy">Clear all filters</Link>
          </div>
        ) : emptyState !== "has_results" ? (
          <div className="ud-state" style={{ marginTop: "1.5rem" }}>
            <i aria-hidden="true"><Building2 /></i>
            <h2>The directory is being prepared</h2>
            <p>No universities have been published yet. In the meantime, the official portals for each destination are a reliable place to start.</p>
            <Link href="/courses" className="ud-btn" data-variant="navy">Explore official course portals</Link>
          </div>
        ) : (
          <>
            <p className="ud-count" aria-live="polite">
              <span>
                Showing <b>{firstShown}–{lastShown}</b> of <b>{results.total}</b> universit{results.total === 1 ? "y" : "ies"}
              </span>
              <span>Photographs carry their author and licence. Records not yet verified by Nextwise are marked.</span>
            </p>
            <ul className="ud-uc-grid">
              {results.items.map((university, index) => (
                <li key={university.id}>
                  <UniversityDirectoryCard university={university} saved={saved.has(university.id)} index={index} canSave={canSave} />
                </li>
              ))}
            </ul>
            <Pagination page={results.page} pageSize={results.pageSize} total={results.total} basePath="/universities" searchParams={paginationParams} />
          </>
        )}

        <GuidanceNotice className="mt-8">
          This directory is a growing dataset, not an exhaustive list of every university. Always confirm programmes, fees,
          deadlines and admission requirements on the university&apos;s own website before you decide or apply. Course
          search continues on <Link href="/courses" className="font-semibold underline">official public portals</Link>.
        </GuidanceNotice>
      </div>
    </div>
  );
}
