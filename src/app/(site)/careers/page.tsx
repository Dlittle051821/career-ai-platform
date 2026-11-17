import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { publicPageMetadata } from "@/config/seo";
import { CareerExplorerCard } from "@/components/career-explorer/CareerExplorerCard";
import { CareerExplorerHero } from "@/components/career-explorer/CareerExplorerHero";
import { CareerPhoto } from "@/components/career-explorer/CareerPhoto";
import { CatalogueFilters } from "@/components/career-explorer/CatalogueFilters";
import { CompareTray } from "@/components/career-explorer/CompareTray";
import { getFamilyPhoto } from "@/lib/career-explorer/photos";
import { getCareerCardExtras, getCareerIdsBySlugs, getFamilyCareerCounts, listSavedCareerIds } from "@/lib/supabase/career-explorer";
import { getCareerFamilies, getCareerTags, getCareersByIds, getIndustries, searchCareers } from "@/lib/supabase/careers";
import { resolveListEmptyState } from "@/lib/ui/list-state";
import "@/styles/career-explorer.css";

// Canonical stays the clean list URL for every filtered / searched / paged
// variant of this page (M17A Step 5).
export const metadata: Metadata = publicPageMetadata(
  "/careers",
  "Explore Career Paths for Students in India",
  "Explore career profiles for Indian students. Understand the work, skills and education pathways, then compare careers that interest you.",
);

interface CareersPageProps {
  searchParams: Promise<{ q?: string; family?: string; industry?: string; tag?: string; page?: string }>;
}

const PAGE_SIZE = 24;
const CATEGORY_CARD_COUNT = 8;
/** The three careers on the approved hero; any that is missing is replaced by the next featured career. */
const HERO_CAREER_SLUGS = ["marine-engineer", "robotics-engineer", "naval-architect"];

function listHref(params: Record<string, string | undefined>, page?: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  if (page && page > 1) query.set("page", String(page));
  const qs = query.toString();
  return `${qs ? `/careers?${qs}` : "/careers"}#all-careers`;
}

/**
 * Career Explorer V5 (approved, locked) — the free public catalogue.
 *
 * Public: no login, no plan. With no search or filter this is the landing
 * (hero, categories, catalogue); with any of them it is the catalogue alone.
 * Search and filters are the real ones searchCareers() runs on the server,
 * as URL parameters, so every view can be shared and works without scripts.
 * Nothing here is personalised and nothing reads a student's profile; the
 * only per-visitor data is which careers a signed-in student has saved.
 */
export default async function CareersPage({ searchParams }: CareersPageProps) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) ?? "";
  const family = params.family ?? "";
  const industry = params.industry ?? "";
  const tag = params.tag ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const hasActiveFilters = Boolean(q || family || industry || tag);
  const isLanding = !hasActiveFilters && page === 1;

  const [families, industries, tags, results, familyCounts, savedIdList, heroIds] = await Promise.all([
    getCareerFamilies(),
    getIndustries(),
    getCareerTags(),
    searchCareers({ query: q || undefined, familyKey: family || undefined, industryKey: industry || undefined, tagKey: tag || undefined, page, pageSize: PAGE_SIZE }),
    getFamilyCareerCounts(),
    listSavedCareerIds(),
    isLanding ? getCareerIdsBySlugs(HERO_CAREER_SLUGS) : Promise.resolve([]),
  ]);

  let featured = isLanding ? await getCareersByIds(heroIds) : [];
  if (isLanding && featured.length < 3) {
    const have = new Set(featured.map((c) => c.id));
    featured = [...featured, ...results.careers.filter((c) => !have.has(c.id))].slice(0, 3);
  }
  const extras = await getCareerCardExtras([...results.careers, ...featured].map((c) => c.id));
  const savedIds = new Set(savedIdList);

  const catalogueTotal = [...familyCounts.values()].reduce((sum, n) => sum + n, 0) || results.total;
  const categories = families
    .map((f) => ({ family: f, count: familyCounts.get(f.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.family.displayOrder - b.family.displayOrder)
    .slice(0, CATEGORY_CARD_COUNT);

  const current = { q, family, industry, tag };
  const active: { key: keyof typeof current; label: string }[] = [];
  if (family) active.push({ key: "family", label: families.find((f) => f.familyKey === family)?.name ?? family });
  if (industry) active.push({ key: "industry", label: industries.find((i) => i.industryKey === industry)?.name ?? industry });
  if (tag) active.push({ key: "tag", label: tags.find((t) => t.tagKey === tag)?.label ?? tag });
  if (q) active.push({ key: "q", label: `“${q}”` });

  const emptyState = resolveListEmptyState({ itemCount: results.careers.length, hasActiveFilters, error: results.error });
  const lastPage = Math.max(1, Math.ceil(results.total / results.pageSize));
  const Heading = isLanding ? "h2" : "h1";

  return (
    <div className="ce">
      {isLanding ? <CareerExplorerHero total={catalogueTotal} featured={featured} extras={extras} savedIds={savedIds} /> : null}

      <section className="ce-section" id="all-careers" aria-labelledby="all-careers-title" style={{ scrollMarginTop: "calc(var(--nwh-offset) + 12px)" }}>
        <div className="ce-wrap">
          {!isLanding ? (
            <nav aria-label="Breadcrumb">
              <ol className="ce-crumbs">
                <li>
                  <Link href="/careers">Career Explorer</Link>
                </li>
                <li aria-current="page">All careers</li>
              </ol>
            </nav>
          ) : null}
          <div className="ce-cat-head">
            <div>
              <Heading id="all-careers-title">All careers</Heading>
              <p className="ce-cat-sub">
                <b>
                  {catalogueTotal} career{catalogueTotal === 1 ? "" : "s"}
                </b>{" "}
                to search, save and compare. No payment needed.
              </p>
            </div>
            <span className="ce-pill">Free to browse</span>
          </div>

          {categories.length > 0 ? (
            <ul className="ce-families" aria-label="Browse by field">
              {categories.map(({ family: f, count }) => (
                <li key={f.familyKey}>
                  <Link href={listHref({ family: f.familyKey })} className="ce-family" aria-current={family === f.familyKey ? "true" : undefined}>
                    <CareerPhoto photo={getFamilyPhoto(f.familyKey)} sizes="(max-width: 640px) 62vw, (max-width: 900px) 50vw, 300px" decorative />
                    <span className="ce-family-text">
                      <strong>{f.name}</strong>
                      <span>
                        {count} career{count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="ce-browse">
            <CatalogueFilters values={current} families={families} industries={industries} tags={tags} />
            <div>
              <div className="ce-results-bar">
                <form className="ce-results-search" role="search" method="get" action="/careers">
                  <Search aria-hidden="true" />
                  <input type="search" name="q" defaultValue={q} placeholder="Search careers" aria-label="Search careers by title" autoComplete="off" />
                  {family ? <input type="hidden" name="family" value={family} /> : null}
                  {industry ? <input type="hidden" name="industry" value={industry} /> : null}
                  {tag ? <input type="hidden" name="tag" value={tag} /> : null}
                </form>
                <p className="ce-count" aria-live="polite">
                  <b>{results.total}</b>
                  career{results.total === 1 ? "" : "s"}
                </p>
                <p className="ce-credit">
                  Photos: Wikimedia Commons · <Link href="/careers/photo-credits">credits</Link>
                </p>
              </div>

              {active.length > 0 ? (
                <ul className="ce-active" aria-label="Active filters">
                  {active.map(({ key, label }) => (
                    <li key={key}>
                      <Link href={listHref({ ...current, [key]: undefined })} aria-label={`Remove filter: ${label}`}>
                        {label}
                        <X aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {emptyState === "has_results" ? (
                <ul className="ce-grid">
                  {results.careers.map((career, i) => (
                    <li key={career.id}>
                      <CareerExplorerCard career={career} extras={extras.get(career.id)} saved={savedIds.has(career.id)} priority={!isLanding && i < 3} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ce-empty" role="status">
                  <h3>
                    {emptyState === "error"
                      ? "We couldn't load careers right now"
                      : emptyState === "filtered_empty"
                        ? "No careers match this search"
                        : "We're still expanding this career library"}
                  </h3>
                  <p>
                    {emptyState === "error"
                      ? "Something went wrong loading the career library. Please try again in a moment."
                      : emptyState === "filtered_empty"
                        ? "Try a shorter search term, or remove a filter."
                        : "New careers are added over time — check back soon."}
                  </p>
                  {emptyState === "filtered_empty" ? (
                    <Link href="/careers#all-careers" className="ce-btn" data-variant="outline" data-size="sm">
                      Clear search and filters
                    </Link>
                  ) : null}
                </div>
              )}

              {lastPage > 1 && emptyState === "has_results" ? (
                <nav className="ce-pages" aria-label="Pages of careers">
                  {page > 1 ? (
                    <Link href={listHref(current, page - 1)} className="ce-btn" data-variant="outline" data-size="sm" rel="prev">
                      <ArrowLeft aria-hidden="true" />
                      Previous
                    </Link>
                  ) : null}
                  <span>
                    Page {page} of {lastPage}
                  </span>
                  {page < lastPage ? (
                    <Link href={listHref(current, page + 1)} className="ce-btn" data-variant="outline" data-size="sm" rel="next">
                      Next
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </nav>
              ) : null}

              <p className="ce-guidance">
                Career profiles here are general information for exploring — not a personalised ranking and not a promise of admission, employment
                or pay. For guidance built around you, see <Link href="/career/access">Career Intelligence</Link> or{" "}
                <Link href="/book-counselling">book a free discovery session</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
      <CompareTray />
    </div>
  );
}
