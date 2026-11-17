import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DetailRecordNotice } from "@/components/sections/DetailRecordNotice";
import { CareerExplorerCard } from "@/components/career-explorer/CareerExplorerCard";
import { CareerPhoto } from "@/components/career-explorer/CareerPhoto";
import { CareerTabs, type CareerTab } from "@/components/career-explorer/CareerTabs";
import { CompareToggle } from "@/components/career-explorer/CompareToggle";
import { CompareTray } from "@/components/career-explorer/CompareTray";
import { SalaryResearch } from "@/components/career-explorer/SalaryResearch";
import { SaveCareerButton } from "@/components/career-explorer/SaveCareerButton";
import { BRAND_NAME, DISCOVERY_SESSION_CTA } from "@/config/site";
import { getCareerPhoto } from "@/lib/career-explorer/photos";
import { deriveCareerCharacteristics } from "@/lib/careers/characteristics";
import { RELEVANCE_LABELS, SKILL_LEVEL_LABELS, educationLevelLabel, educationLevelToCourseSearchDegree, fieldLabel, interestLabel, skillLabel, subjectLabel } from "@/lib/careers/labels";
import { getBreadcrumbListJsonLd, toSafeJsonLdString } from "@/lib/seo/structured-data";
import { trackEvent } from "@/lib/supabase/analytics/track";
import { getCareerCardExtras, listSavedCareerIds } from "@/lib/supabase/career-explorer";
import { getCareerBySlug, getRelatedCareers, lookupCareerBySlug } from "@/lib/supabase/careers";
import "@/styles/career-explorer.css";

interface CareerDetailPageProps {
  params: Promise<{ slug: string }>;
}

// Self-referencing canonical for a real published career; a missing slug is
// noindex and (below) a genuine 404 (M17A Step 5, CC-24, M17B).
export async function generateMetadata({ params }: CareerDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const career = await getCareerBySlug(slug);
  if (!career) return { title: "Career not found", robots: { index: false, follow: false } };
  const canonicalPath = `/careers/${slug}`;
  return {
    title: career.title,
    description: career.summary,
    alternates: { canonical: canonicalPath },
    openGraph: { title: `${career.title} | ${BRAND_NAME}`, description: career.summary, url: canonicalPath, type: "article" },
    twitter: { card: "summary_large_image", title: `${career.title} | ${BRAND_NAME}`, description: career.summary },
  };
}

const RELATED_LIMIT = 3;

/** How much a school subject matters, in words (the 1–5 importance is never shown as a number). */
function importanceLabel(importance: number): string {
  if (importance >= 5) return "Very important";
  if (importance >= 4) return "Important";
  return "Useful";
}

/**
 * Career Explorer V5 (approved, locked) — one career profile, e.g.
 * /careers/marine-engineer. Public and free. Every section is rendered from
 * the career's own record: what they do, skills, education, progression,
 * salary & opportunities, related careers. A section with no data says so
 * instead of filling the gap. No salary figure is shown anywhere — salary
 * research is the Gemini handoff (SalaryResearch).
 */
export default async function CareerDetailPage({ params }: CareerDetailPageProps) {
  const { slug } = await params;
  const careerLookup = await lookupCareerBySlug(slug);
  // CC-24 — a missing record is a genuine 404 (see ./not-found.tsx); a failed lookup is not.
  if (careerLookup.status === "not_found") notFound();
  if (careerLookup.status === "unavailable") {
    return <DetailRecordNotice kind="unavailable" noun="career" browseHref="/careers" browseLabel="Browse the Career Explorer" />;
  }
  const career = careerLookup.value;

  const [related, savedIdList] = await Promise.all([getRelatedCareers(career.id, RELATED_LIMIT), listSavedCareerIds()]);
  const relatedExtras = await getCareerCardExtras(related.map((r) => r.id));
  const savedIds = new Set(savedIdList);
  const characteristics = deriveCareerCharacteristics(career.scores);

  void trackEvent({
    eventName: "career_viewed",
    source: "career_detail_page",
    path: `/careers/${career.slug}`,
    feature: "career_explorer",
    entityType: "career",
    entityId: career.id,
    properties: { slug: career.slug },
  });

  const skills = [...career.skills].sort((a, b) => b.importance - a.importance);
  const subjects = [...career.subjects].sort((a, b) => b.importance - a.importance);
  const interests = [...career.interests].sort((a, b) => b.importance - a.importance);
  const routeOrder = { primary: 0, common: 1, alternative: 2 } as const;
  const routes = [...career.educationRoutes].sort((a, b) => routeOrder[a.relevance] - routeOrder[b.relevance]);

  const tabs: CareerTab[] = [
    { id: "what-they-do", label: "What they do" },
    { id: "skills", label: "Skills" },
    { id: "education", label: "Education" },
    { id: "progression", label: "Progression" },
    { id: "salary", label: "Salary & opportunities" },
    ...(related.length > 0 ? [{ id: "related", label: "Related careers" }] : []),
  ];

  return (
    <div className="ce">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLdString(
            getBreadcrumbListJsonLd([
              { name: "Home", path: "/" },
              { name: "Career Explorer", path: "/careers" },
              { name: career.title, path: `/careers/${career.slug}` },
            ]),
          ),
        }}
      />
      <div className="ce-wrap">
        <header className="ce-profile-head">
          <div>
            <nav aria-label="Breadcrumb">
              <ol className="ce-crumbs">
                <li>
                  <Link href="/careers">Career Explorer</Link>
                </li>
                <li>
                  <Link href={`/careers?family=${career.familyKey}#all-careers`}>{career.familyName}</Link>
                </li>
                <li aria-current="page">{career.title}</li>
              </ol>
            </nav>
            <p className="ce-hero-top">
              <span className="ce-kicker">{career.familyName}</span>
              <span className="ce-pill">Free career profile</span>
            </p>
            <h1>{career.title}</h1>
            <p className="ce-profile-lede">{career.summary}</p>
            {career.aliases.length > 0 ? <p className="ce-note" style={{ marginTop: 10 }}>Also known as: {career.aliases.join(", ")}</p> : null}
            <dl className="ce-facts">
              {career.minimumEducationKey ? (
                <div>
                  <dt>Typical starting education</dt>
                  <dd>{educationLevelLabel(career.minimumEducationKey)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Field</dt>
                <dd>{career.familyName}</dd>
              </div>
              {career.industries.length > 0 ? (
                <div>
                  <dt>Industries</dt>
                  <dd>
                    {career.industries
                      .slice(0, 2)
                      .map((i) => i.name)
                      .join(" · ")}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="ce-profile-actions">
              <SaveCareerButton careerId={career.id} slug={career.slug} title={career.title} initialSaved={savedIds.has(career.id)} inline />
              <CompareToggle slug={career.slug} title={career.title} inline />
              <Link href={DISCOVERY_SESSION_CTA.href} className="ce-textlink">
                Book a Free Discovery Session
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
          <CareerPhoto photo={getCareerPhoto(career.slug)} className="ce-profile-photo" sizes="(max-width: 900px) 100vw, 520px" priority />
        </header>
      </div>

      <CareerTabs tabs={tabs} />

      <div className="ce-wrap" style={{ paddingBottom: 72 }}>
        <section id="what-they-do" className="ce-block" aria-labelledby="what-they-do-h">
          <h2 id="what-they-do-h">What they do</h2>
          <div className="ce-cols">
            <div className="ce-panel">
              <p>{career.whatYouDo}</p>
            </div>
            <div className="ce-panel">
              <p className="ce-label">Where the work happens</p>
              <p>{career.typicalEnvironment}</p>
              {characteristics.length > 0 ? (
                <>
                  <p className="ce-label">What this work tends to offer</p>
                  <ul className="ce-chipset" style={{ listStyle: "none", padding: 0 }}>
                    {characteristics.map((label) => (
                      <li key={label} className="ce-chip">
                        {label}
                      </li>
                    ))}
                  </ul>
                  <p className="ce-note" style={{ marginTop: 10 }}>General tendencies, not guarantees — real roles vary by employer and country.</p>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section id="skills" className="ce-block" aria-labelledby="skills-h">
          <h2 id="skills-h">Skills you would build</h2>
          {skills.length + subjects.length + interests.length > 0 ? (
            <div className="ce-cols" data-cols="3">
              {skills.length > 0 ? (
                <div className="ce-panel">
                  <p className="ce-label">Skills</p>
                  <ul className="ce-rows">
                    {skills.map((s) => (
                      <li key={s.skillKey}>
                        {skillLabel(s.skillKey)}
                        <span>{SKILL_LEVEL_LABELS[s.recommendedLevel] ?? s.recommendedLevel}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {subjects.length > 0 ? (
                <div className="ce-panel">
                  <p className="ce-label">School subjects that help</p>
                  <ul className="ce-rows">
                    {subjects.map((s) => (
                      <li key={s.subjectKey}>
                        {subjectLabel(s.subjectKey)}
                        <span>{importanceLabel(s.importance)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {interests.length > 0 ? (
                <div className="ce-panel">
                  <p className="ce-label">Interests it suits</p>
                  <ul className="ce-rows">
                    {interests.map((i) => (
                      <li key={i.interestKey}>
                        {interestLabel(i.interestKey)}
                        <span>{i.importance >= 4 ? "Core" : "Also relevant"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="ce-missing">Skills for this career haven&rsquo;t been published yet.</p>
          )}
          <p className="ce-note" style={{ marginTop: 12 }}>Skills to build over time — not a checklist you need to have already.</p>
        </section>

        <section id="education" className="ce-block" aria-labelledby="education-h">
          <h2 id="education-h">Education pathway</h2>
          {routes.length > 0 ? (
            <div className="ce-cols" data-cols="3">
              {routes.map((route, i) => {
                // NW02 §7 — only for a level with a confident Course Explorer equivalent; otherwise no link at all.
                const canonicalDegree = educationLevelToCourseSearchDegree(route.educationLevel);
                const courseSearchHref = canonicalDegree
                  ? `/courses?subject=${encodeURIComponent(fieldLabel(route.fieldKey))}&degree=${canonicalDegree}`
                  : null;
                return (
                  <div key={i} className="ce-panel ce-route">
                    <p className="ce-label">{RELEVANCE_LABELS[route.relevance] ?? route.relevance}</p>
                    <strong>
                      {educationLevelLabel(route.educationLevel)} · {fieldLabel(route.fieldKey)}
                    </strong>
                    {route.notes ? <p>{route.notes}</p> : null}
                    {courseSearchHref ? (
                      <Link href={courseSearchHref} className="ce-textlink">
                        Search courses
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="ce-missing">Education routes for this career haven&rsquo;t been published yet.</p>
          )}
          <p className="ce-note" style={{ marginTop: 12 }}>
            These are common routes in, not the only path — not a university or course recommendation, and not a guarantee that any specific programme leads to this career. Check the official entry and
            licensing rules for the country you plan to study or work in.
          </p>
        </section>

        <section id="progression" className="ce-block" aria-labelledby="progression-h">
          <h2 id="progression-h">Career progression</h2>
          <div className="ce-cols">
            <div className="ce-panel">
              <p className="ce-label">Typical entry point</p>
              <p>{career.typicalEntryLevel}</p>
              {career.careerOutlookSummary ? (
                <>
                  <p className="ce-label">Outlook</p>
                  <p>{career.careerOutlookSummary}</p>
                </>
              ) : null}
            </div>
            <p className="ce-missing">
              A step-by-step progression ladder isn&rsquo;t published for this career yet. Titles and timelines vary by employer and country, so
              Nextwise shows only what is on record rather than a typical-looking guess.
            </p>
          </div>
        </section>

        <section id="salary" className="ce-block" aria-labelledby="salary-h">
          <h2 id="salary-h">Salary and opportunities</h2>
          <div className="ce-cols">
            <div className="ce-panel ce-salary">
              <h3>What could you earn in this career?</h3>
              <p className="ce-note" style={{ fontSize: 14.5 }}>Explore salary expectations across different countries, experience levels and professional pathways.</p>
              <SalaryResearch careerTitle={career.title} />
              <p className="ce-note">
                Prepares a question about this career for Google Gemini, which you send yourself. Nextwise doesn&rsquo;t publish salary figures of its
                own.
              </p>
            </div>
            <div className="ce-panel">
              {career.industries.length > 0 ? (
                <>
                  <p className="ce-label">Industries</p>
                  <ul className="ce-chipset" style={{ listStyle: "none", padding: 0 }}>
                    {career.industries.map((ind) => (
                      <li key={ind.id} className="ce-chip">
                        {ind.name}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {career.tags.length > 0 ? (
                <>
                  <p className="ce-label" style={{ marginTop: career.industries.length > 0 ? 18 : 0 }}>Themes</p>
                  <ul className="ce-chipset" style={{ listStyle: "none", padding: 0 }}>
                    {career.tags.map((tag) => (
                      <li key={tag.id} className="ce-chip">
                        {tag.label}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {career.industries.length + career.tags.length === 0 ? <p className="ce-note">No industries are recorded for this career yet.</p> : null}
              <p className="ce-note" style={{ marginTop: 14 }}>Shown for exploration. They are not a promise of employment or pay.</p>
            </div>
          </div>
        </section>

        <section id="related" className="ce-block" aria-labelledby="related-h">
          <h2 id="related-h">{related.length > 0 ? "Related careers" : "Next steps"}</h2>
          <ul className="ce-related">
            {related.map((r) => (
              <li key={r.id}>
                <CareerExplorerCard career={r} extras={relatedExtras.get(r.id)} saved={savedIds.has(r.id)} sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 290px" />
              </li>
            ))}
            <li>
              <div className="ce-next">
                <p className="ce-label">Next steps · all free</p>
                <h3>Keep this career in view.</h3>
                <SaveCareerButton careerId={career.id} slug={career.slug} title={career.title} initialSaved={savedIds.has(career.id)} inline />
                <CompareToggle slug={career.slug} title={career.title} inline />
                <Link href={DISCOVERY_SESSION_CTA.href} className="ce-btn" data-ghost="">
                  Book a Free Discovery Session
                </Link>
                <p>
                  Want a personal assessment? <Link href="/career/access">Career Intelligence</Link> is part of Nextwise Verified.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <p className="ce-guidance">
          This page describes the career itself. It isn&rsquo;t a personalised match, and it isn&rsquo;t admissions, employment or salary advice.{" "}
          <Link href="/careers">Back to Career Explorer</Link>
        </p>
      </div>
      <CompareTray />
    </div>
  );
}
