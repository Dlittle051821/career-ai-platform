import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { UniversityCard } from "@/components/sections/education/UniversityCard";
import { UniversityFilterBar } from "@/components/sections/education/UniversityFilterBar";
import { Pagination } from "@/components/sections/education/Pagination";
import { searchUniversities } from "@/lib/supabase/education/universities";
import { listActiveCountries } from "@/lib/supabase/education/countries";
import { resolveListEmptyState } from "@/lib/ui/list-state";

export const metadata: Metadata = {
  title: "Universities",
  description: "Browse and search a starter dataset of universities worldwide — locations, study levels, and verified detail pages.",
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

      {(() => {
        const state = resolveListEmptyState({ itemCount: results.items.length, hasActiveFilters: Boolean(hasActiveFilters), error: results.error });
        if (state === "has_results") return null;
        if (state === "error") {
          return (
            <EmptyState
              tone="error"
              title="We couldn't load universities just now"
              description="Something went wrong on our end fetching the university dataset. Please try again in a moment."
            />
          );
        }
        if (state === "dataset_empty") {
          return (
            <EmptyState
              tone="empty"
              title="No universities here yet"
              description="We're still building out this part of the dataset. Check back soon, or browse careers and courses in the meantime."
            />
          );
        }
        return (
          <EmptyState
            tone="filtered"
            title="No universities match your filters"
            description="Try a broader search term, or clear a filter — this dataset covers a growing but limited set of institutions, not every university worldwide."
            action={
              <Link href="/universities" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear all filters
              </Link>
            }
          />
        );
      })()}
      {results.items.length > 0 && (
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

      <GuidanceNotice className="mt-8">
        This is a representative starter dataset, not an exhaustive worldwide database — new universities are added
        over time, and coverage varies by country. Each result shows when it was last verified; always confirm
        current fees, deadlines, and admission requirements directly with the institution before you act on them.
      </GuidanceNotice>
    </Section>
  );
}
