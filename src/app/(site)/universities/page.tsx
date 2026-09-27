import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { UniversityCard } from "@/components/sections/education/UniversityCard";
import { UniversityFilterBar } from "@/components/sections/education/UniversityFilterBar";
import { Pagination } from "@/components/sections/education/Pagination";
import { TrustedExternalSearchCard } from "@/components/sections/education/TrustedExternalSearchCard";
import { searchUniversities } from "@/lib/supabase/education/universities";
import { listActiveCountries } from "@/lib/supabase/education/countries";
import { getTrustedSearchResults } from "@/lib/supabase/education/external-search";
import { resolveListEmptyState } from "@/lib/ui/list-state";

// M17A Step 5 — canonical is deliberately static and points at the clean
// list URL regardless of the q/country/city/studyMode/page query params
// this page reads from `searchParams`. See M17A_STEP5_REPORT.md.
export const metadata: Metadata = {
  title: "Universities",
  description: "Browse and search a starter dataset of universities worldwide — locations, study levels, and verified detail pages.",
  alternates: { canonical: "/universities" },
};

function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

interface UniversitiesPageProps {
  searchParams: Promise<{ q?: string; country?: string | string[]; city?: string; studyMode?: string | string[]; page?: string }>;
}

/**
 * Public University Explorer (Milestone 9). Not in `PROTECTED_PATHS` —
 * anyone can browse it, same convention as `/careers`
 * (src/app/(site)/careers/page.tsx). Server-side paginated via
 * searchUniversities(); never loads the full catalog into the browser.
 */
export default async function UniversitiesPage({ searchParams }: UniversitiesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const countryIds = toStringArray(params.country);
  const city = params.city?.trim() ?? "";
  const studyModes = toStringArray(params.studyMode);
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [countries, results] = await Promise.all([
    listActiveCountries(),
    searchUniversities({
      q: query || undefined,
      countryIds: countryIds.length > 0 ? countryIds : undefined,
      city: city || undefined,
      studyModes: studyModes.length > 0 ? studyModes : undefined,
      page,
    }),
  ]);

  const activeFiltersForPagination: Record<string, string | string[]> = {};
  if (query) activeFiltersForPagination.q = query;
  if (countryIds.length > 0) activeFiltersForPagination.country = countryIds;
  if (city) activeFiltersForPagination.city = city;
  if (studyModes.length > 0) activeFiltersForPagination.studyMode = studyModes;

  const hasActiveFilters = query || countryIds.length > 0 || city || studyModes.length > 0;

  // UX07 — genuinely distinct empty/filtered/error copy instead of the
  // old collapsed "couldn't be loaded" message for every zero-result case.
  // See src/lib/ui/list-state.ts (UX06G) — already built and tested for
  // exactly this, previously wired into no public list page at all.
  const emptyState = resolveListEmptyState({ itemCount: results.items.length, hasActiveFilters: Boolean(hasActiveFilters), error: results.error });

  // UX07 — when the visitor has narrowed to exactly one country, offer the
  // trusted official source(s) for that country alongside NextWise's own
  // (currently partial) catalogue — reuses the SAME Trusted Global Course
  // Search infrastructure /courses already uses (getTrustedSearchResults,
  // TrustedExternalSearchCard, listActiveProvidersForDestination), keyed by
  // that country's real ISO code. No new provider table, no invented
  // sources: a country with no activated provider simply shows nothing here.
  const singleSelectedCountry = countryIds.length === 1 ? countries.find((c) => c.id === countryIds[0]) ?? null : null;
  const trustedSearch = singleSelectedCountry
    ? await getTrustedSearchResults({ destinationCountryCode: singleSelectedCountry.isoAlpha2, canonicalSubjectId: null, canonicalSubjectLabel: null, degreeLevel: null })
    : null;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">University Explorer</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Browse universities</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Search and filter a starter dataset of universities — location, institution type, study levels and modes,
          and a link through to each university&apos;s own detail page.
        </p>
      </div>

      <Card className="mb-8">
        <UniversityFilterBar query={query} countryIds={countryIds} city={city} studyModes={studyModes} countries={countries} />
      </Card>

      {emptyState !== "has_results" ? (
        <EmptyState
          tone={emptyState === "error" ? "error" : emptyState === "filtered_empty" ? "filtered" : "empty"}
          title={
            emptyState === "error"
              ? "We couldn't load universities right now"
              : emptyState === "filtered_empty"
                ? "No universities match these filters"
                : "We're still expanding this university catalogue"
          }
          description={
            emptyState === "error"
              ? "Something went wrong loading the university dataset. Please try again in a moment."
              : emptyState === "filtered_empty"
                ? "Try a broader search term, or clear a filter — this dataset covers a growing but limited set of institutions, not every university worldwide."
                : "New institutions are added over time. In the meantime, the trusted external sources below (when shown for your selected country) can help you keep exploring."
          }
          action={
            emptyState === "filtered_empty" ? (
              <Link href="/universities" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear all filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {results.total} universit{results.total === 1 ? "y" : "ies"} found
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((university) => (
              <UniversityCard key={university.id} university={university} />
            ))}
          </div>
          <Pagination page={results.page} pageSize={results.pageSize} total={results.total} basePath="/universities" searchParams={activeFiltersForPagination} />
        </>
      )}

      {singleSelectedCountry && trustedSearch && trustedSearch.results.length > 0 ? (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-primary">Trusted official source for {singleSelectedCountry.name}</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            NextWise&apos;s own catalogue for {singleSelectedCountry.name} is a starter dataset, not an exhaustive one. Continue on
            the country&apos;s own official study portal to see options beyond what NextWise has verified so far.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {trustedSearch.results.map((result) => (
              <TrustedExternalSearchCard key={result.providerId} result={result} />
            ))}
          </div>
        </div>
      ) : null}

      <GuidanceNotice className="mt-8">
        This is a representative starter dataset, not an exhaustive worldwide database — new universities are added
        over time, and coverage varies by country. Each result shows when it was last verified; always confirm
        current fees, deadlines, and admission requirements directly with the institution before you act on them.
      </GuidanceNotice>
    </Section>
  );
}
