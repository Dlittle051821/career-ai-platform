import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { CourseCard } from "@/components/sections/education/CourseCard";
import { CourseFilterBar } from "@/components/sections/education/CourseFilterBar";
import { TrustedExternalSearchCard } from "@/components/sections/education/TrustedExternalSearchCard";
import { Pagination } from "@/components/sections/education/Pagination";
import { CompareProvider, CompareBar } from "@/components/sections/education/CompareTray";
import { searchCourses } from "@/lib/supabase/education/courses";
import { listActiveCountries } from "@/lib/supabase/education/countries";
import { getTrustedSearchResults, recordMappingGapEventForPrimaryResult } from "@/lib/supabase/education/external-search";
import { parseMinorUnitsParam } from "@/lib/education/search";
import { resolveSubject, resolveDegreeLevel, CANONICAL_DEGREE_LEVELS, CANONICAL_DEGREE_TO_EDUCATION_LEVELS, type CanonicalDegreeLevel } from "@/lib/education/external-search/taxonomy";
import type { CourseDurationUnit } from "@/types/education";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse and search a starter dataset of university courses worldwide — subjects, tuition, intakes, and verified detail pages.",
};

function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

const VALID_DURATION_UNITS: readonly string[] = ["years", "months", "weeks"];

interface CoursesPageProps {
  searchParams: Promise<{
    q?: string;
    country?: string | string[];
    universityId?: string;
    subjectArea?: string | string[];
    qualificationLevel?: string | string[];
    studyMode?: string | string[];
    teachingLanguage?: string | string[];
    currency?: string;
    minTuition?: string;
    maxTuition?: string;
    durationUnit?: string;
    intakePeriod?: string;
    scholarshipsAvailable?: string;
    page?: string;
    destination?: string;
    subject?: string;
    degree?: string;
  }>;
}

/**
 * Public Course Explorer (Milestone 9). Not in `PROTECTED_PATHS` — anyone
 * can browse it, same convention as `/universities` and `/careers`.
 * Server-side paginated via searchCourses(); never loads the full catalog
 * into the browser. `universityId` supports the University detail page's
 * "View courses" link (`/courses?universityId=<id>`) — see
 * src/app/(site)/universities/[slug]/page.tsx.
 */
export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const countryIds = toStringArray(params.country);
  const universityId = params.universityId?.trim() ?? "";
  const subjectAreas = toStringArray(params.subjectArea);
  const qualificationLevels = toStringArray(params.qualificationLevel);
  const studyModes = toStringArray(params.studyMode);
  const teachingLanguages = toStringArray(params.teachingLanguage);
  const currency = params.currency?.trim().toUpperCase() ?? "";
  const minTuition = params.minTuition?.trim() ?? "";
  const maxTuition = params.maxTuition?.trim() ?? "";
  const durationUnitRaw = params.durationUnit?.trim() ?? "";
  const durationUnit = VALID_DURATION_UNITS.includes(durationUnitRaw) ? (durationUnitRaw as CourseDurationUnit) : undefined;
  const intakePeriod = params.intakePeriod?.trim() ?? "";
  const scholarshipsAvailable = params.scholarshipsAvailable === "true";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // Trusted Global Course Search — destination/subject/degree. `subject`
  // and `degree` are normalized through the hand-curated taxonomy
  // (src/lib/education/external-search/taxonomy.ts): an exact-alias or
  // known-misspelling match resolves to a stable canonical id/label; an
  // unrecognized term simply has no exact match (never a guessed one) and
  // still flows into the internal keyword search as free text below.
  const destinationCode = params.destination?.trim().toUpperCase() ?? "";
  const subjectRaw = params.subject?.trim() ?? "";
  const degreeRaw = params.degree?.trim() ?? "";
  const subjectResolution = resolveSubject(subjectRaw);
  const canonicalDegree: CanonicalDegreeLevel | null = (CANONICAL_DEGREE_LEVELS as readonly string[]).includes(degreeRaw)
    ? (degreeRaw as CanonicalDegreeLevel)
    : resolveDegreeLevel(degreeRaw).canonicalLevel;

  // Additive-only augmentation of the EXISTING internal search filters —
  // never replaces query/subjectArea/qualificationLevel, only supplements
  // them, so the pre-existing filter fields keep working exactly as
  // before. The canonical subject label (when an exact match was found)
  // is folded into the free-text keyword search; the canonical degree
  // level is mapped onto the real courses.education_level values it
  // corresponds to.
  const mergedQuery = [query, subjectResolution.exactMatch?.canonicalLabel ?? (subjectResolution.exactMatch ? "" : subjectRaw)].filter(Boolean).join(" ") || undefined;
  const mergedQualificationLevels = Array.from(
    new Set([...qualificationLevels, ...(canonicalDegree ? CANONICAL_DEGREE_TO_EDUCATION_LEVELS[canonicalDegree] : [])]),
  );

  const [countries, results, trustedSearch] = await Promise.all([
    listActiveCountries(),
    searchCourses({
      q: mergedQuery,
      countryIds: countryIds.length > 0 ? countryIds : undefined,
      universityId: universityId || undefined,
      subjectAreas: subjectAreas.length > 0 ? subjectAreas : undefined,
      qualificationLevels: mergedQualificationLevels.length > 0 ? mergedQualificationLevels : undefined,
      studyModes: studyModes.length > 0 ? studyModes : undefined,
      teachingLanguages: teachingLanguages.length > 0 ? teachingLanguages : undefined,
      currency: currency || undefined,
      minTuitionMinorUnits: parseMinorUnitsParam(minTuition),
      maxTuitionMinorUnits: parseMinorUnitsParam(maxTuition),
      durationUnit,
      intakePeriod: intakePeriod || undefined,
      scholarshipsAvailable: scholarshipsAvailable || undefined,
      page,
    }),
    getTrustedSearchResults({
      destinationCountryCode: destinationCode || null,
      canonicalSubjectId: subjectResolution.exactMatch?.id ?? null,
      canonicalSubjectLabel: subjectResolution.exactMatch?.canonicalLabel ?? null,
      degreeLevel: canonicalDegree,
    }),
  ]);

  // Fire-and-forget search-gap recording — never blocks the render, never
  // throws (see recordMappingGapEventForPrimaryResult's own docblock).
  if (destinationCode) {
    void recordMappingGapEventForPrimaryResult(trustedSearch, {
      destinationCountryCode: destinationCode || null,
      canonicalSubjectId: subjectResolution.exactMatch?.id ?? null,
      canonicalSubjectLabel: subjectResolution.exactMatch?.canonicalLabel ?? null,
      degreeLevel: canonicalDegree,
    });
  }

  const activeFiltersForPagination: Record<string, string | string[]> = {};
  if (query) activeFiltersForPagination.q = query;
  if (countryIds.length > 0) activeFiltersForPagination.country = countryIds;
  if (universityId) activeFiltersForPagination.universityId = universityId;
  if (subjectAreas.length > 0) activeFiltersForPagination.subjectArea = subjectAreas;
  if (qualificationLevels.length > 0) activeFiltersForPagination.qualificationLevel = qualificationLevels;
  if (studyModes.length > 0) activeFiltersForPagination.studyMode = studyModes;
  if (teachingLanguages.length > 0) activeFiltersForPagination.teachingLanguage = teachingLanguages;
  if (currency) activeFiltersForPagination.currency = currency;
  if (minTuition) activeFiltersForPagination.minTuition = minTuition;
  if (maxTuition) activeFiltersForPagination.maxTuition = maxTuition;
  if (durationUnit) activeFiltersForPagination.durationUnit = durationUnit;
  if (intakePeriod) activeFiltersForPagination.intakePeriod = intakePeriod;
  if (scholarshipsAvailable) activeFiltersForPagination.scholarshipsAvailable = "true";
  if (destinationCode) activeFiltersForPagination.destination = destinationCode;
  if (subjectRaw) activeFiltersForPagination.subject = subjectRaw;
  if (degreeRaw) activeFiltersForPagination.degree = degreeRaw;

  const hasActiveFilters =
    query ||
    countryIds.length > 0 ||
    universityId ||
    subjectAreas.length > 0 ||
    qualificationLevels.length > 0 ||
    studyModes.length > 0 ||
    teachingLanguages.length > 0 ||
    currency ||
    minTuition ||
    maxTuition ||
    durationUnit ||
    intakePeriod ||
    scholarshipsAvailable ||
    destinationCode ||
    subjectRaw ||
    degreeRaw;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Course Explorer</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Browse courses</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Search and filter a starter dataset of university courses — subject, qualification level, study mode,
          tuition, and intakes — with a link through to each course&apos;s own detail page. Select up to four to
          compare them side by side.
        </p>
      </div>

      <Card className="mb-8">
        <CourseFilterBar
          query={query}
          countryIds={countryIds}
          universityId={universityId}
          subjectArea={subjectAreas[0] ?? ""}
          qualificationLevel={qualificationLevels[0] ?? ""}
          studyModes={studyModes}
          teachingLanguage={teachingLanguages[0] ?? ""}
          currency={currency}
          minTuition={minTuition}
          maxTuition={maxTuition}
          durationUnit={durationUnit ?? ""}
          intakePeriod={intakePeriod}
          scholarshipsAvailable={scholarshipsAvailable}
          countries={countries}
          destination={destinationCode}
          subject={subjectRaw}
          degree={degreeRaw}
        />
      </Card>

      {subjectRaw ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          {subjectResolution.exactMatch ? (
            <>
              <span className="text-muted">Exact subject:</span>
              <Badge tone="accent">{subjectResolution.exactMatch.canonicalLabel}</Badge>
              {subjectResolution.matchSource === "misspelling_correction" ? (
                <span className="text-xs text-muted">(corrected from &ldquo;{subjectRaw}&rdquo;)</span>
              ) : null}
              {subjectResolution.relatedSubjects.length > 0 ? (
                <>
                  <span className="ml-2 text-muted">Related subjects:</span>
                  {subjectResolution.relatedSubjects.map((s) => (
                    <Badge key={s.id} tone="neutral">
                      {s.canonicalLabel}
                    </Badge>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <span className="text-muted">
              &ldquo;{subjectRaw}&rdquo; isn&apos;t in our curated subject list yet — searching it as free text instead.
            </span>
          )}
        </div>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold text-primary">NextWise verified results</h2>
      {results.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <SearchX aria-hidden="true" className="h-10 w-10 text-muted" />
          <p className="max-w-sm text-sm text-muted">
            {hasActiveFilters
              ? "We do not currently hold verified programme records for this search. Continue on the trusted official portal below."
              : "The course dataset couldn't be loaded right now. Please try again in a moment."}
          </p>
          {hasActiveFilters ? (
            <Link href="/courses" className="text-sm font-semibold text-secondary-dark hover:text-primary">
              Clear all filters
            </Link>
          ) : null}
        </Card>
      ) : (
        <CompareProvider>
          <p className="mb-4 text-sm text-muted">
            {results.total} course{results.total === 1 ? "" : "s"} found
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          <Pagination page={results.page} pageSize={results.pageSize} total={results.total} basePath="/courses" searchParams={activeFiltersForPagination} />
          <CompareBar />
        </CompareProvider>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-primary">Trusted external search</h2>
        {trustedSearch.results.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {trustedSearch.results.map((result) => (
              <TrustedExternalSearchCard key={result.providerId} result={result} />
            ))}
          </div>
        ) : (
          <Card className="text-sm text-muted">
            {destinationCode
              ? "No trusted official portal is currently activated for this destination in our system yet."
              : "Choose a destination country above to see a link to that country's trusted official course-search portal."}
          </Card>
        )}
      </div>

      <GuidanceNotice className="mt-8">
        This is a representative starter dataset, not an exhaustive worldwide database — new courses are added over
        time, and coverage varies by institution and country. Each result shows when it was last verified; always
        confirm current fees, deadlines, and admission requirements directly with the institution before you act on
        them.
      </GuidanceNotice>
    </Section>
  );
}
