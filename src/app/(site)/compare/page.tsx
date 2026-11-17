import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock, Plus, X } from "lucide-react";
import { CareerPhoto } from "@/components/career-explorer/CareerPhoto";
import { DiffToggle } from "@/components/career-explorer/DiffToggle";
import { SalaryResearch } from "@/components/career-explorer/SalaryResearch";
import { deriveCareerBalance } from "@/lib/career-explorer/balance";
import { COMPARE_PARAM_KEYS, buildCompareHref, readCompareSlugs } from "@/lib/career-explorer/compare-selection";
import { getCareerPhoto } from "@/lib/career-explorer/photos";
import { MAX_COMPARE_CAREERS, MIN_COMPARE_CAREERS, careerDetailToMatchProfile } from "@/lib/careers/compare";
import { educationLevelLabel, fieldLabel, skillLabel } from "@/lib/careers/labels";
import { getMyProductEntitlements } from "@/lib/products/entitlements";
import { MATCH_BAND_LABELS, getRecommendations, hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import { trackEvent } from "@/lib/supabase/analytics/track";
import { getCareerBySlug, getCareerOptionsForComparison } from "@/lib/supabase/careers";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import type { CareerDetail } from "@/types/career";
import "@/styles/career-explorer.css";

/**
 * Permanent noindex + clean canonical (M17A Step 5): this page is selected by
 * ?a=&b=&c=&d= and no combination has search value of its own.
 */
export const metadata: Metadata = {
  title: "Compare Careers",
  description: "Compare up to four careers side by side — responsibilities, skills, education routes, working life and a balanced view of each.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: false },
};

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string; c?: string; d?: string }>;
}

type Row = {
  label: string;
  /** One cell per career; `text` is what is compared when highlighting differences. */
  cells: { text: string; node: React.ReactNode }[];
  minus?: boolean;
  /** Rows that hold an action, not a fact, are never highlighted. */
  comparable?: boolean;
};

const missing = (what: string) => ({ text: "", node: <span className="ce-missing-inline">{what} not published</span> });
const plain = (text: string | null | undefined, what: string) => (text ? { text, node: text } : missing(what));
const bullets = (items: string[], what: string) =>
  items.length > 0
    ? {
        text: items.join("|"),
        node: (
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      }
    : missing(what);

function skillsCell(career: CareerDetail) {
  const top = [...career.skills].sort((a, b) => b.importance - a.importance).slice(0, 4).map((s) => skillLabel(s.skillKey));
  return top.length > 0 ? { text: top.join(" · "), node: top.join(" · ") } : missing("Skills");
}

function educationCell(career: CareerDetail) {
  const primary = career.educationRoutes.find((r) => r.relevance === "primary") ?? career.educationRoutes[0];
  if (!primary) return missing("Education routes");
  const others = career.educationRoutes.filter((r) => r !== primary).length;
  const text = `${educationLevelLabel(primary.educationLevel)} · ${fieldLabel(primary.fieldKey)}`;
  return {
    text,
    node: (
      <>
        {text}
        {others > 0 ? <small>{others === 1 ? "one other route is also on record" : `${others} other routes are also on record`}</small> : null}
      </>
    ),
  };
}

/**
 * Career Explorer V5 (approved, locked) — the free comparison, up to four
 * careers. Public: no login and no plan. Every cell is the career's own
 * record; nothing is scored or ranked and a gap is shown as a gap.
 *
 * Personal fit is the one part that is not free. It appears only when the
 * server confirms a paid Career entitlement (getMyProductEntitlements —
 * paid invoices only) and the student's own profile has enough data; then
 * it shows the existing recommendation engine's band, never a new score.
 * Everyone else sees the Nextwise Verified entry instead.
 */
export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const slugs = readCompareSlugs(params);
  const [options, found] = await Promise.all([getCareerOptionsForComparison(), Promise.all(slugs.map((slug) => getCareerBySlug(slug)))]);
  const careers = found.filter((c): c is CareerDetail => c !== null);
  const missingCount = slugs.length - careers.length;
  const chosen = careers.map((c) => c.slug);
  const canAdd = careers.length < MAX_COMPARE_CAREERS;
  const addable = options.filter((o) => !chosen.includes(o.slug));
  const ready = careers.length >= MIN_COMPARE_CAREERS;

  let fit: Map<string, string> | null = null;
  if (ready) {
    const entitlements = await getMyProductEntitlements();
    if (entitlements.hasCareerEntitlement) {
      const snapshot = await getStudentProfileSnapshot();
      if (snapshot && hasMinimumProfileDataForRecommendations(snapshot)) {
        const profiles = careers.map(careerDetailToMatchProfile);
        const { results } = getRecommendations(snapshot, profiles, profiles.length);
        fit = new Map(results.map((r) => [r.careerId, MATCH_BAND_LABELS[r.matchBand]]));
      }
    }
    void trackEvent({
      eventName: "career_compared",
      source: "compare_page",
      path: "/compare",
      feature: "career_compare",
      entityType: "career",
      entityId: careers[0]?.id ?? null,
      properties: { careerIds: careers.map((c) => c.id), count: careers.length },
    });
  }

  const balances = careers.map((c) => deriveCareerBalance(c.scores));
  const groups: { title: string; rows: Row[] }[] = [
    { title: "About", rows: [{ label: "Primary responsibilities", cells: careers.map((c) => plain(c.whatYouDo, "Responsibilities")) }] },
    {
      title: "Skills and study",
      rows: [
        { label: "Key skills", cells: careers.map(skillsCell) },
        { label: "Education routes", cells: careers.map(educationCell) },
      ],
    },
    {
      title: "Working life",
      rows: [
        { label: "Working environment", cells: careers.map((c) => plain(c.typicalEnvironment, "Working environment")) },
        { label: "Career progression", cells: careers.map((c) => plain(c.typicalEntryLevel, "Progression")) },
      ],
    },
    {
      title: "A balanced view",
      rows: [
        { label: "What may appeal", cells: balances.map((b) => bullets(b.appeal, "Advantages")) },
        { label: "Things to weigh up", cells: balances.map((b) => bullets(b.considerations, "Considerations")), minus: true },
      ],
    },
    {
      title: "Pay",
      rows: [{ label: "Salary research", comparable: false, cells: careers.map((c) => ({ text: "", node: <SalaryResearch careerTitle={c.title} variant="link" /> })) }],
    },
    {
      title: "Personal fit",
      rows: [
        {
          label: "How well it fits you",
          comparable: false,
          cells: careers.map((c) => {
            const band = fit?.get(c.id);
            return {
              text: "",
              node: band ? (
                band
              ) : (
                <Link href="/career/access" className="ce-locked">
                  <Lock aria-hidden="true" />
                  Career Intelligence · Nextwise Verified
                </Link>
              ),
            };
          }),
        },
      ],
    },
  ];

  const columns = Math.max(careers.length + (canAdd ? 1 : 0), 2);
  const nextKey = COMPARE_PARAM_KEYS[careers.length];

  return (
    <div className="ce">
      <section className="ce-section">
        <div className="ce-wrap">
          <nav aria-label="Breadcrumb">
            <ol className="ce-crumbs">
              <li>
                <Link href="/careers">Career Explorer</Link>
              </li>
              <li aria-current="page">Compare</li>
            </ol>
          </nav>
          <div className="ce-compare-top">
            <div>
              <h1>Compare careers</h1>
              <p className="ce-cat-sub">See how they differ. No career is ranked above another — and comparing is free.</p>
            </div>
            <Link href="/careers#all-careers" className="ce-btn" data-variant="outline" data-size="sm">
              <ArrowLeft aria-hidden="true" />
              Back to Career Explorer
            </Link>
          </div>

          {missingCount > 0 ? (
            <p className="ce-missing" role="status" style={{ marginTop: 20 }}>
              {missingCount === 1 ? "One selected career" : `${missingCount} selected careers`} couldn&rsquo;t be found and {missingCount === 1 ? "was" : "were"} left out.
            </p>
          ) : null}

          <div className="ce-cmp-scroll">
            <div id="ce-compare-grid" className="ce-cmp" style={{ "--cols": columns } as React.CSSProperties}>
              <div className="ce-cmp-meta">
                {ready ? <DiffToggle gridId="ce-compare-grid" /> : null}
                {careers.length} of {MAX_COMPARE_CAREERS} careers · free comparison
              </div>
              {careers.map((career) => (
                <div key={career.id} className="ce-cmp-headcell">
                  <div className="ce-cmp-card">
                    <CareerPhoto photo={getCareerPhoto(career.slug)} sizes="76px" decorative />
                    <div>
                      <strong>
                        <Link href={`/careers/${career.slug}`}>{career.title}</Link>
                      </strong>
                      <span>{career.familyName}</span>
                    </div>
                    <Link href={buildCompareHref(chosen.filter((s) => s !== career.slug))} className="ce-cmp-remove" aria-label={`Remove ${career.title} from comparison`}>
                      <X aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
              {canAdd && nextKey ? (
                <div className="ce-cmp-headcell">
                  <form className="ce-cmp-add" method="get" action="/compare">
                    {chosen.map((slug, i) => (
                      <input key={slug} type="hidden" name={COMPARE_PARAM_KEYS[i]} value={slug} />
                    ))}
                    <label htmlFor="ce-add-career">
                      <Plus aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: "-2px" }} /> Add a career
                    </label>
                    <select id="ce-add-career" name={nextKey} defaultValue="" required>
                      <option value="" disabled>
                        Choose…
                      </option>
                      {addable.map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.title}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="ce-btn" data-variant="primary" data-size="sm">
                      Add
                    </button>
                  </form>
                </div>
              ) : null}
              {/* keep the grid's column count when fewer cells than columns */}
              {Array.from({ length: columns - careers.length - (canAdd && nextKey ? 1 : 0) }, (_, i) => (
                <div key={`pad-${i}`} />
              ))}

              {ready
                ? groups.map((group) => (
                    <GroupRows key={group.title} title={group.title} rows={group.rows} columns={columns} />
                  ))
                : null}
            </div>
          </div>

          {!ready ? (
            <div className="ce-empty" role="status">
              <h3>Pick at least two careers to compare</h3>
              <p>
                Choose up to {MAX_COMPARE_CAREERS} careers above — or tick &ldquo;Compare&rdquo; on any career card — to see them side by side.
              </p>
              <Link href="/careers#all-careers" className="ce-btn" data-variant="outline" data-size="sm">
                Browse careers
              </Link>
            </div>
          ) : (
            <p className="ce-guidance">
              &ldquo;What may appeal&rdquo; and &ldquo;Things to weigh up&rdquo; are general tendencies drawn from each career&rsquo;s curated profile — not
              verified market data, salary information or admissions advice.
              {fit ? " “How well it fits you” reuses the same rules-based comparison as your recommendations; a lower band isn't a verdict that a career is unsuitable." : ""}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function GroupRows({ title, rows, columns }: { title: string; rows: Row[]; columns: number }) {
  return (
    <>
      <h2 className="ce-cmp-group ce-kicker" style={{ color: "var(--ce-navy)" }}>
        {title}
      </h2>
      {rows.map((row) => {
        const differs = row.comparable !== false && new Set(row.cells.map((c) => c.text)).size > 1;
        return (
          <div key={row.label} style={{ display: "contents" }} role="group" aria-label={row.label}>
            <div className="ce-cmp-rowlabel">{row.label}</div>
            {row.cells.map((cell, i) => (
              <div key={i} className="ce-cmp-cell" data-minus={row.minus ? "" : undefined} data-differs={differs ? "" : undefined}>
                {cell.node}
              </div>
            ))}
            {Array.from({ length: columns - row.cells.length }, (_, i) => (
              <div key={`pad-${i}`} className="ce-cmp-cell" />
            ))}
          </div>
        );
      })}
    </>
  );
}
