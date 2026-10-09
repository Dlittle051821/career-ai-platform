import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { isLaunchCountryCode, getLaunchCountryName, type LaunchCountryCode } from "@/lib/education/external-search/launch-countries";
import { LaunchCountryDiscovery } from "@/components/sections/education/LaunchCountryDiscovery";
import { resolveListEmptyState } from "@/lib/ui/list-state";
import type { CourseDurationUnit } from "@/types/education";
import { GeometricBackdrop } from "@/components/graphics/GeometricBackdrop";
import { FADE_UP_CLASSES } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

// M17A Step 5 — canonical is deliberately static and points at the clean
// list URL regardless of the many filter/search/sort/pagination query
// params this page reads from `searchParams` (q, country, universityId,
// subjectArea, qualificationLevel, studyMode, teachingLanguage, currency,
// minTuition, maxTuition, durationUnit, intakePeriod, page, ...). Every
// variant canonicalizes back to `/courses`; see M17A_STEP5_REPORT.md.
export const metadata: Metadata = {
  title: "Courses",
  description: "Browse and search a starter dataset of university courses worldwide — subjects, tuition, intakes, and verified detail pages.",
  alternates: { canonical: "/courses" },
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

  // M20C — every other active filter, keyed exactly as the query params
  // already read above, built BEFORE the data fetch below (it depends on
  // none of it) so LaunchCountryDiscovery's buildHref can use it near the
  // top of the page without duplicating this record a second time.
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

  // M20C — LaunchCountryDiscovery's quick-select strip for the six Tier 1
  // launch countries. Reuses the page's EXISTING `destination` param
  // (already independent of the internal `country` checkbox filter, see
  // the comment on CourseFilterBar's own `destination` prop above) —
  // selecting a chip never touches query/subjectArea/qualificationLevel/
  // etc, and never changes the internal course results, exactly like
  // typing a destination into the "Find a trusted official portal"
  // fieldset already does today. `selectedLaunchCode` is null both when no
  // destination is set AND when the destination is a valid-but-non-launch
  // country — never re-derives launch-country membership, only asks M20A's
  // own `isLaunchCountryCode`.
  const selectedLaunchCode: LaunchCountryCode | null = isLaunchCountryCode(destinationCode) ? destinationCode : null;
  function buildDestinationHref(code: LaunchCountryCode | null): string {
    const next: Record<string, string | string[]> = { ...activeFiltersForPagination };
    if (code) next.destination = code;
    else delete next.destination;
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
      else qs.set(key, value);
    }
    return qs.toString() ? `/courses?${qs.toString()}` : "/courses";
  }

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

  // UX07 — see the matching change in src/app/(site)/universities/page.tsx
  // for why this replaces the old collapsed "couldn't be loaded" message.
  const emptyState = resolveListEmptyState({ itemCount: results.items.length, hasActiveFilters: Boolean(hasActiveFilters), error: results.error });

  // M20C — an honest display name for the "Trusted external search"
  // heading/empty-state copy: prefer the real public.countries row's own
  // name (works for ANY destination, launch country or not — this
  // generalizes a pre-existing UX07 capability, it doesn't special-case
  // launch countries), falling back to M20A's own launch-country name for
  // a launch code with no matching countries row, then the raw typed/
  // selected code itself so an unrecognized value is never silently blanked.
  const destinationCountryRow = destinationCode ? countries.find((c) => c.isoAlpha2 === destinationCode) ?? null : null;
  const destinationDisplayName = destinationCode ? destinationCountryRow?.name ?? getLaunchCountryName(destinationCode) ?? destinationCode : null;
  // Only ever claim an internal-catalogue count FOR this destination when
  // the internal `country` checkbox filter is unambiguously set to that
  // exact same country — `destination` and `country` are deliberately
  // independent params on this page (see CourseFilterBar's own docblock),
  // so without this check the number shown could belong to a completely
  // different filter combination. Never fabricated, never shown unless
  // genuinely known.
  const destinationInternalCountMatches = Boolean(destinationCountryRow && countryIds.length === 1 && countryIds[0] === destinationCountryRow.id);

  return (
    <Section tone="muted" className="relative overflow-hidden pt-10 sm:pt-14">
      <GeometricBackdrop variant="grid" />
      <div className={cn("mb-6", FADE_UP_CLASSES)}>
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Course Explorer</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Browse courses</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Search and filter a starter dataset of university courses — subject, qualification level, study mode,
          tuition, and intakes — with a link through to each course&apos;s own detail page. Select up to four to
          compare them side by side.
        </p>
      </div>

      <LaunchCountryDiscovery selectedCode={selectedLaunchCode} buildHref={buildDestinationHref} className="mb-6" />

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
      {emptyState !== "has_results" ? (
        <EmptyState
          tone={emptyState === "error" ? "error" : emptyState === "filtered_empty" ? "filtered" : "empty"}
          title={
            emptyState === "error"
              ? "We couldn't load courses right now"
              : emptyState === "filtered_empty"
                ? "No courses match these filters"
                : "We're still expanding this course catalogue"
          }
          description={
            emptyState === "error"
              ? "Something went wrong loading the course dataset. Please try again in a moment."
              : emptyState === "filtered_empty"
                ? "We do not currently hold verified programme records for this search. Continue on the trusted official portal below."
                : "New courses are added over time. Continue on the trusted official portal below in the meantime."
          }
          action={
            emptyState === "filtered_empty" ? (
              <Link href="/courses" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear all filters
              </Link>
            ) : undefined
          }
        />
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
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-primary">
            Trusted external search{destinationDisplayName ? ` — ${destinationDisplayName}` : ""}
          </h2>
          {destinationInternalCountMatches ? (
            <p className="mt-1 text-sm text-muted">
              NextWise&apos;s own catalogue currently includes {results.total} matching course{results.total === 1 ? "" : "s"} for{" "}
              {destinationDisplayName} — the official source below covers more than NextWise has verified so far.
            </p>
          ) : null}
        </div>
        {trustedSearch.results.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {trustedSearch.results.map((result) => (
              <TrustedExternalSearchCard key={result.providerId} result={result} />
            ))}
          </div>
        ) : (
          <Card className="text-sm text-muted">
            {destinationCode
              ? `No trusted official portal is currently activated for ${destinationDisplayName} in our system yet.`
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
