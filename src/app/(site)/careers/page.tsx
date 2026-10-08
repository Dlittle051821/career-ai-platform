import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { CareerCard } from "@/components/sections/careers/CareerCard";
import { CareerFilterBar } from "@/components/sections/careers/CareerFilterBar";
import { Pagination } from "@/components/sections/careers/Pagination";
import { searchCareers, getCareerFamilies, getIndustries, getCareerTags } from "@/lib/supabase/careers";
import { resolveListEmptyState } from "@/lib/ui/list-state";
import { BRAND_NAME } from "@/config/site";
import { GeometricBackdrop } from "@/components/graphics/GeometricBackdrop";
import { FADE_UP_CLASSES } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

// M17A Step 5 — canonical is deliberately static and points at the clean
// list URL regardless of any q/family/industry/tag/page query params this
// page reads from `searchParams`. Every filtered/sorted/paginated variant
// of this page canonicalizes back to `/careers`; see M17A_STEP5_REPORT.md.
export const metadata: Metadata = {
  title: "Career Explorer",
  description: `Browse and search the ${BRAND_NAME} career library — structured profiles for careers relevant to Indian students.`,
  alternates: { canonical: "/careers" },
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

  // UX07/UX08 shared-infrastructure fix — see the matching change in
  // src/app/(site)/universities/page.tsx for why this replaces the old
  // collapsed "couldn't be loaded" message. searchCareers() already set
  // `error: true` on a genuine failure (src/lib/supabase/careers.ts); this
  // page just wasn't reading it yet.
  const emptyState = resolveListEmptyState({ itemCount: results.careers.length, hasActiveFilters: Boolean(hasActiveFilters), error: results.error });

  return (
    <Section tone="muted" className="relative overflow-hidden pt-10 sm:pt-14">
      {/* UX09 Part B — a faint geometric texture only (no color wash and
          no illustration here) for page identity, matching the same
          restrained treatment on /courses and /universities. */}
      <GeometricBackdrop variant="grid" />
      <div className={cn("mb-6", FADE_UP_CLASSES)}>
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

      {emptyState !== "has_results" ? (
        <EmptyState
          tone={emptyState === "error" ? "error" : emptyState === "filtered_empty" ? "filtered" : "empty"}
          title={
            emptyState === "error"
              ? "We couldn't load careers right now"
              : emptyState === "filtered_empty"
                ? "No careers match these filters"
                : "We're still expanding this career library"
          }
          description={
            emptyState === "error"
              ? "Something went wrong loading the career library. Please try again in a moment."
              : emptyState === "filtered_empty"
                ? "Try a broader search term, or clear a filter — the library covers around a hundred careers across engineering, technology, business, healthcare, and more."
                : "New careers are added over time — check back soon."
          }
          action={
            emptyState === "filtered_empty" ? (
              <Link href="/careers" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear all filters
              </Link>
            ) : undefined
          }
        />
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
