import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { CareerCard } from "@/components/sections/careers/CareerCard";
import { CareerFilterBar } from "@/components/sections/careers/CareerFilterBar";
import { Pagination } from "@/components/sections/careers/Pagination";
import { searchCareers, getCareerFamilies, getIndustries, getCareerTags } from "@/lib/supabase/careers";

export const metadata: Metadata = {
  title: "Career Explorer",
  description: "Browse and search the CareerPath AI career library — structured profiles for careers relevant to Indian students.",
};

interface CareersPageProps {
  searchParams: Promise<{ q?: string; family?: string; industry?: string; tag?: string; page?: string }>;
}

/**
 * The Career Explorer (Milestone 4 §23). Public — no login required, and
 * deliberately not in `PROTECTED_PATHS` (see middleware.ts) since anyone
 * should be able to browse the career library. This is a browsing/search
 * tool only: no match percentages, no personalised ranking, nothing here
 * reads or compares against a student's Milestone 3 profile.
 */
export default async function CareersPage({ searchParams }: CareersPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const familyKey = params.family ?? "";
  const industryKey = params.industry ?? "";
  const tagKey = params.tag ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [families, industries, tags, results] = await Promise.all([
    getCareerFamilies(),
    getIndustries(),
    getCareerTags(),
    searchCareers({
      query: query || undefined,
      familyKey: familyKey || undefined,
      industryKey: industryKey || undefined,
      tagKey: tagKey || undefined,
      page,
    }),
  ]);

  const activeFiltersForPagination: Record<string, string> = {};
  if (query) activeFiltersForPagination.q = query;
  if (familyKey) activeFiltersForPagination.family = familyKey;
  if (industryKey) activeFiltersForPagination.industry = industryKey;
  if (tagKey) activeFiltersForPagination.tag = tagKey;

  const hasActiveFilters = query || familyKey || industryKey || tagKey;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Career Explorer</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Browse careers</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Search and filter a structured library of careers — what each one involves, the subjects and skills it
          draws on, and common routes in. This is a browsing tool, not a personalised recommendation.
        </p>
      </div>

      <Card className="mb-8">
        <CareerFilterBar query={query} familyKey={familyKey} industryKey={industryKey} tagKey={tagKey} families={families} industries={industries} tags={tags} />
      </Card>

      {results.careers.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <SearchX aria-hidden="true" className="h-10 w-10 text-muted" />
          <h2 className="text-lg font-semibold text-primary">No careers match your filters</h2>
          <p className="max-w-sm text-sm text-muted">
            {hasActiveFilters
              ? "Try a broader search term, or clear a filter — the library covers around a hundred careers across engineering, technology, business, healthcare, and more."
              : "The career library couldn't be loaded right now. Please try again in a moment."}
          </p>
          {hasActiveFilters ? (
            <Link href="/careers" className="text-sm font-semibold text-secondary-dark hover:text-primary">
              Clear all filters
            </Link>
          ) : null}
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {results.total} career{results.total === 1 ? "" : "s"} found
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.careers.map((career) => (
              <CareerCard key={career.id} career={career} />
            ))}
          </div>
          <Pagination page={results.page} pageSize={results.pageSize} total={results.total} searchParams={activeFiltersForPagination} />
        </>
      )}

      <GuidanceNotice className="mt-8">
        Careers shown here are structured profile data — this is a browsing tool, not a personalised ranking. Sign
        in and complete your Student Digital Profile to see personalised, explained matches at{" "}
        <Link href="/recommendations" className="font-medium underline underline-offset-2">/recommendations</Link>.
      </GuidanceNotice>
    </Section>
  );
}
