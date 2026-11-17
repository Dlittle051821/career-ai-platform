import type { Metadata } from "next";
import { getUniversityAccess } from "@/lib/supabase/education/university-access";
import { canUseUniversityDirectory } from "@/lib/education/university-discovery/access";
import { getVerifiedOffer } from "@/lib/education/university-discovery/offer";
import { LockedUniversityPreview } from "@/components/sections/university-discovery/LockedUniversityPreview";
import "@/styles/university-discovery.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, ExternalLink, FileCheck2, Info, MapPin, Star } from "lucide-react";
import { DetailRecordNotice } from "@/components/sections/DetailRecordNotice";
import { lookupPublicUniversityBySlugCached } from "@/lib/supabase/education/detail-lookups";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { DataStatusBadge } from "@/components/sections/education/DataStatusBadge";
import { UnverifiedRecordNotice } from "@/components/sections/education/UnverifiedRecordNotice";
import { isVerifiedEducationRecord, lastCheckedLabel, shouldShowRankings, UNVERIFIED_SCHOLARSHIP_NOTE } from "@/lib/education/verification-display";
import {
  listPublicCampusesForUniversity,
  listPublicScholarshipsForUniversity,
} from "@/lib/supabase/education/universities";
import { categoryLabel, ownershipLabel, studyAreaLabel, type UniversityRanking } from "@/lib/education/university-discovery/directory";
import { SaveButton, SaveError, SaveUniversityProvider } from "@/components/sections/university-discovery/SaveUniversity";
import { UniversityGallery } from "@/components/sections/university-discovery/UniversityGallery";
import { listSavedEntityIds } from "@/lib/supabase/education/saved-items";
import { formatMoney } from "@/lib/admin/money";
import { trackEvent } from "@/lib/supabase/analytics/track";
import { BRAND_NAME } from "@/config/site";
import { getBreadcrumbListJsonLd, toSafeJsonLdString } from "@/lib/seo/structured-data";

interface UniversityDetailPageProps {
  params: Promise<{ slug: string }>;
}

// M17A Step 5 — self-referencing canonical for real published+active
// universities, using the actual slug already fetched (never fabricated).
// A missing/unpublished/inactive slug gets a permanent noindex instead.
//
// M17B FINAL — added an entity-specific `openGraph`/`twitter` block so
// sharing a university URL shows that university's own name/summary
// instead of the generic site-wide card. `description` falls back to a
// short generated line when `summary` is null — composed only from fields
// already fetched for this page, never an invented claim about the
// institution.
export async function generateMetadata({ params }: UniversityDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  // University Discovery V3 — institution records (including their name and
  // summary in page metadata) are for visitors with directory access only.
  if (!canUseUniversityDirectory(await getUniversityAccess())) {
    return { title: "University profile", robots: { index: false, follow: false } };
  }
  const lookup = await lookupPublicUniversityBySlugCached(slug);
  const university = lookup.status === "found" ? lookup.value : null;
  if (!university) return { title: "University not found", robots: { index: false, follow: false } };
  const canonicalPath = `/universities/${slug}`;
  const description = university.summary ?? `${university.name} on ${BRAND_NAME}.`;
  return {
    title: university.name,
    description: university.summary ?? undefined,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `${university.name} | ${BRAND_NAME}`,
      description,
      url: canonicalPath,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${university.name} | ${BRAND_NAME}`,
      description,
    },
  };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * University profile (University Discovery V3), e.g.
 * `/universities/universitaet-zu-koeln`. Access is decided on the server
 * before any record is looked up: a visitor without Verified directory
 * access gets the locked preview and no institution data is fetched,
 * rendered or serialised for them.
 *
 * Never fills in a plausible-looking placeholder for a missing field — every
 * optional value either renders "Not available" or is omitted outright,
 * matching what getPublicUniversityBySlug actually returns.
 */
export default async function UniversityDetailPage({ params }: UniversityDetailPageProps) {
  const { slug } = await params;
  // University Discovery V3 — checked on the server before any record lookup.
  const access = await getUniversityAccess();
  if (!canUseUniversityDirectory(access)) {
    return <LockedUniversityPreview accessState={access} offer={getVerifiedOffer()} returnTo={`/universities/${encodeURIComponent(slug)}`} />;
  }
  const universityLookup = await lookupPublicUniversityBySlugCached(slug);
  // CC-24 — a missing record is a genuine 404 (checked first in ./layout.tsx; card in ../not-found.tsx); a failed lookup is not.
  if (universityLookup.status === "not_found") notFound();
  if (universityLookup.status === "unavailable") {
    return <DetailRecordNotice kind="unavailable" noun="university" browseHref="/universities" browseLabel="Browse the University Explorer" />;
  }
  const university = universityLookup.value;

  void trackEvent({
    eventName: "college_viewed",
    source: "university_detail_page",
    path: `/universities/${university.slug}`,
    feature: "university_explorer",
    entityType: "university",
    entityId: university.id,
    properties: { slug: university.slug },
  });

  const canSave = access !== "admin";
  const [campuses, scholarships, savedIds] = await Promise.all([
    listPublicCampusesForUniversity(university.id),
    listPublicScholarshipsForUniversity(university.id),
    canSave ? listSavedEntityIds("university") : Promise.resolve<string[]>([]),
  ]);

  const verified = isVerifiedEducationRecord(university.verificationStatus);
  const location = [university.city, university.stateRegion, university.countryName].filter(Boolean).join(", ");
  const lastVerifiedLabel = formatDate(university.lastVerifiedAt);
  const category = categoryLabel(university.institutionCategory);
  const ownership = ownershipLabel(university.ownershipType);
  const areas = university.studyAreas.map(studyAreaLabel).filter((label): label is string => Boolean(label));
  const hero = university.photos.find((photo) => photo.kind === "hero") ?? university.photos[0] ?? null;
  // Rankings are a factual claim: shown only for a verified record, and only entries that name their provider and year.
  const rankings = shouldShowRankings(university.verificationStatus) ? university.ranking : [];
  const overallRankings = rankings.filter((entry) => entry.scope === "overall");
  const subjectRankings = rankings.filter((entry) => entry.scope === "subject");
  const websiteHost = hostOf(university.websiteUrl);
  const guidanceHref = "/book-counselling";

  const facts: { label: string; value: React.ReactNode }[] = [];
  if (category) facts.push({ label: "Institution type", value: category });
  if (ownership) facts.push({ label: "Funding", value: `${ownership} institution` });
  if (location) facts.push({ label: "Location", value: location });
  if (university.foundingYear) facts.push({ label: "Founded", value: String(university.foundingYear) });
  if (university.websiteUrl && websiteHost) {
    facts.push({ label: "Official website", value: <a href={university.websiteUrl} target="_blank" rel="noopener noreferrer">{websiteHost}</a> });
  }
  if (lastVerifiedLabel) facts.push({ label: lastCheckedLabel(university.verificationStatus), value: lastVerifiedLabel });

  const page = (
    <div className="ud ud-pf-pad">
      {/* M17B FINAL — BreadcrumbList JSON-LD mirroring the visual trail below exactly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLdString(
            getBreadcrumbListJsonLd([
              { name: "Home", path: "/" },
              { name: "University Explorer", path: "/universities" },
              { name: university.name, path: `/universities/${university.slug}` },
            ])
          ),
        }}
      />
      <div className="ud-wrap ud-section" style={{ paddingTop: "6.5rem" }}>
        <section className="ud-pf-hero" data-plain={hero ? undefined : ""} aria-labelledby="ud-pf-title">
          {hero ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- licence-cleared campus photograph served from /public with its credit */}
              <img src={hero.url} alt={hero.alt} fetchPriority="high" decoding="async" />
              <a className="ud-credit" href={hero.creditSourceUrl} target="_blank" rel="noopener noreferrer">
                Photo: {hero.creditAuthor} · {hero.licenceName}
              </a>
            </>
          ) : null}
          <Link href="/universities" className="ud-pf-bc">
            <ArrowLeft aria-hidden="true" />
            University Explorer
          </Link>
          <div className="ud-pf-in">
            <div>
              <div className="ud-pf-chips">
                {category ? <span data-pink>{category}</span> : null}
                {ownership ? <span>{ownership}</span> : null}
                {verified ? (
                  <span><BadgeCheck aria-hidden="true" />Verified by Nextwise</span>
                ) : (
                  <span><FileCheck2 aria-hidden="true" />Official source recorded</span>
                )}
              </div>
              <h1 id="ud-pf-title">{university.name}</h1>
              {location ? (
                <p className="ud-pf-loc">
                  <MapPin aria-hidden="true" />
                  {location}
                </p>
              ) : null}
            </div>
            <div className="ud-pf-acts">
              {canSave ? <SaveButton tone="glass" /> : null}
              {university.websiteUrl ? (
                <a href={university.websiteUrl} target="_blank" rel="noopener noreferrer" className="ud-btn" data-variant="white">
                  Official website
                  <ExternalLink aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </section>
        {canSave ? <span style={{ position: "relative", display: "block" }}><SaveError /></span> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DataStatusBadge verificationStatus={university.verificationStatus} freshnessBand={university.freshnessBand} />
        </div>
        {!verified ? <div className="mt-3"><UnverifiedRecordNotice officialUrl={university.websiteUrl} officialLabel="Open the official university website" /></div> : null}

        <section className="ud-pf-sec" aria-labelledby="ud-pf-overview">
          <h2 className="ud-h2" id="ud-pf-overview">Overview</h2>
          <div className="ud-pf-ov">
            <div>
              {university.summary ? <p>{university.summary}</p> : <p>An introduction has not been recorded for this university yet. Its official website is the best place to start.</p>}
              {university.campusInfo ? <p>{university.campusInfo}</p> : null}
              {university.internationalStudentSupport ? <p>{university.internationalStudentSupport}</p> : null}
            </div>
            <dl className="ud-fx">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {university.photos.length > 0 ? (
          <section className="ud-pf-sec" aria-labelledby="ud-pf-gallery">
            <h2 className="ud-h2" id="ud-pf-gallery">Campus gallery</h2>
            <UniversityGallery photos={university.photos} universityName={university.name} />
          </section>
        ) : null}

        {university.highlights.length > 0 ? (
          <section className="ud-pf-sec" aria-labelledby="ud-pf-standout">
            <h2 className="ud-h2" id="ud-pf-standout">What makes this university stand out?</h2>
            <ul className="ud-so">
              {university.highlights.map((highlight) => (
                <li key={highlight.text} className="ud-sc">
                  <i aria-hidden="true"><Star /></i>
                  <p>{highlight.text}</p>
                  <small>
                    Source: <a href={highlight.sourceUrl} target="_blank" rel="noopener noreferrer">{highlight.sourceName}</a>
                  </small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {areas.length > 0 || university.courseCatalogueUrl ? (
          <section className="ud-pf-sec" aria-labelledby="ud-pf-areas">
            <h2 className="ud-h2" id="ud-pf-areas">Academic focus areas</h2>
            <div className="ud-as">
              <div>
                {areas.length > 0 ? (
                  <div className="ud-tgs">
                    {areas.map((label) => (
                      <span key={label} className="ud-tg">{label}</span>
                    ))}
                  </div>
                ) : null}
                <p className="ud-bnd">
                  <Info aria-hidden="true" />
                  <span>
                    Study areas are grouped from the university&apos;s official programme catalogue and are a guide, not a full list.
                    Programmes, entry requirements and deadlines are on the university&apos;s own pages.
                  </span>
                </p>
              </div>
              <div className="ud-rk">
                <h3>Find a programme</h3>
                <p className="ud-rk-src" style={{ marginTop: 0, fontSize: ".9rem" }}>
                  Nextwise does not list individual courses for students. Use the university&apos;s official catalogue, or the official national portals.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {university.courseCatalogueUrl ? (
                    <a href={university.courseCatalogueUrl} target="_blank" rel="noopener noreferrer" className="ud-btn" data-variant="navy">
                      Official programme catalogue
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ) : null}
                  <Link href="/courses" className="ud-btn" data-variant="line">Official course portals</Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {rankings.length > 0 ? (
          <section className="ud-pf-sec" aria-labelledby="ud-pf-rankings">
            <h2 className="ud-h2" id="ud-pf-rankings">Rankings</h2>
            {overallRankings.length > 0 ? <RankingGroup title="Overall international rankings" tag="University-wide" entries={overallRankings} /> : null}
            {subjectRankings.length > 0 ? <RankingGroup title="Subject rankings" tag="One discipline each" entries={subjectRankings} /> : null}
            <p className="ud-bnd">
              <Info aria-hidden="true" />
              <span>Rankings measure different things and change every year. A subject rank describes one discipline, not the whole university.</span>
            </p>
          </section>
        ) : null}

        {campuses.length > 0 ? (
          <section className="ud-pf-sec" aria-labelledby="ud-pf-campuses">
            <h2 className="ud-h2" id="ud-pf-campuses">Campus and location</h2>
            <dl className="ud-fx" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              {campuses.map((campus) => (
                <div key={campus.id}>
                  <dt>{campus.isMain ? "Main campus" : "Campus"}</dt>
                  <dd>{campus.name}</dd>
                  <dt style={{ marginTop: 6 }}>{[campus.city, campus.stateRegion, campus.countryName].filter(Boolean).join(", ") || "Location not recorded"}</dt>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {scholarships.length > 0 ? (
          <section className="ud-pf-sec" aria-labelledby="ud-pf-scholarships">
            <h2 className="ud-h2" id="ud-pf-scholarships">Scholarships recorded for this university</h2>
            {!verified ? <p className="ud-bnd"><Info aria-hidden="true" /><span>{UNVERIFIED_SCHOLARSHIP_NOTE}</span></p> : null}
            <ul className="ud-list mt-4">
              {scholarships.map((scholarship) => (
                <li key={scholarship.id}>
                  <div>
                    <b>{scholarship.name}</b>
                    <span>
                      {scholarship.awardAmountMinorUnits != null && scholarship.currencyCode
                        ? formatMoney(scholarship.awardAmountMinorUnits, scholarship.currencyCode)
                        : scholarship.awardDescription ?? "Award not recorded"}
                    </span>
                  </div>
                  {scholarship.scholarshipUrl ? (
                    <a href={scholarship.scholarshipUrl} target="_blank" rel="noopener noreferrer" className="ud-btn" data-variant="line">
                      Official details
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="ud-pf-sec" aria-labelledby="ud-pf-next">
          <h2 className="ud-h2" id="ud-pf-next">Your next steps</h2>
          <div className="ud-next">
            <Link href={guidanceHref}>
              <b>Request Nextwise guidance <ArrowRight aria-hidden="true" /></b>
              <span>Talk through this university and your shortlist in a free discovery session.</span>
            </Link>
            <Link href="/saved">
              <b>Review your shortlist <ArrowRight aria-hidden="true" /></b>
              <span>See every university you have saved, side by side, in your Studio.</span>
            </Link>
            <Link href="/courses">
              <b>Search official course portals <ArrowRight aria-hidden="true" /></b>
              <span>Find programmes and entry requirements on trusted national portals.</span>
            </Link>
          </div>
        </section>

        <GuidanceNotice className="mt-8">
          Always confirm programmes, fees, deadlines and admission requirements on the university&apos;s own website before
          you decide or apply.{university.sourceUrl ? " " : ""}
          {university.sourceUrl ? (
            <a href={university.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Source recorded for this profile</a>
          ) : null}
        </GuidanceNotice>

        <nav className="ud-stk" aria-label={`Actions for ${university.name}`}>
          <span className="ud-stk-name" aria-hidden="true">{university.name}</span>
          {canSave ? <SaveButton tone="bar" /> : null}
          {university.websiteUrl ? (
            <a href={university.websiteUrl} target="_blank" rel="noopener noreferrer">
              Official website
              <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
          <Link href={guidanceHref} data-primary>Request guidance</Link>
        </nav>
      </div>
    </div>
  );

  if (!canSave) return page;
  return (
    <SaveUniversityProvider universityId={university.id} slug={university.slug} name={university.name} initialSaved={savedIds.includes(university.id)}>
      {page}
    </SaveUniversityProvider>
  );
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function RankingGroup({ title, tag, entries }: { title: string; tag: string; entries: UniversityRanking[] }) {
  const sources = Array.from(new Map(entries.filter((entry) => entry.sourceUrl).map((entry) => [entry.sourceUrl as string, entry])).values());
  return (
    <div className="ud-rk">
      <h3>
        {title}
        <span className="ud-tag">{tag}</span>
      </h3>
      {entries.map((entry) => (
        <div key={`${entry.provider}-${entry.year}-${entry.category ?? "overall"}`} className="ud-rr">
          <b>{/^[=#]/.test(entry.rank) ? entry.rank : `#${entry.rank}`}</b>
          <span>{entry.category ?? "Overall"}</span>
          <small>{entry.provider} · {entry.year}</small>
        </div>
      ))}
      {sources.length > 0 ? (
        <p className="ud-rk-src">
          Source:{" "}
          {sources.map((entry, index) => (
            <span key={entry.sourceUrl}>
              {index > 0 ? ", " : ""}
              <a href={entry.sourceUrl as string} target="_blank" rel="noopener noreferrer">{hostOf(entry.sourceUrl)}</a>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
