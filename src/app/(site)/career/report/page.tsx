import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Save } from "lucide-react";
import { CiShell } from "@/components/career-intelligence/CiShell";
import { CareerReport, type BandTone, type ReportItem } from "@/components/career-intelligence/CareerReport";
import { GuestAnswersTransfer } from "@/components/career-intelligence/GuestAnswersTransfer";
import { NotFinishedYet } from "@/components/career-intelligence/AssessmentComplete";
import { DISCOVERY_SESSION_CTA } from "@/config/site";
import { ASSESSMENT_SECTION_COUNT, answersFromSnapshot, firstOpenSectionIndex, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";
import { getCareerPhoto } from "@/lib/career-explorer/photos";
import { educationLevelLabel, fieldLabel, RELEVANCE_LABELS } from "@/lib/careers/labels";
import { getRecommendations, MATCH_BAND_LABELS } from "@/lib/recommendations";
import type { MatchBand, RecommendationResult } from "@/lib/recommendations/types";
import { requireCareerIntelligence } from "@/lib/supabase/career-intelligence-access";
import { listSavedCareerIds } from "@/lib/supabase/career-explorer";
import { getCareersForMatching } from "@/lib/supabase/careers";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import type { CareerMatchProfile } from "@/types/career";
import "@/styles/career-explorer.css";

export const metadata: Metadata = {
  title: "Your Career Intelligence report",
  robots: { index: false, follow: false },
};

const BAND_TONE: Record<MatchBand, BandTone> = { strong_match: "strong", promising_match: "promising", worth_exploring: "explore", limited_evidence: "explore" };

function toReportItem(r: RecommendationResult, career: CareerMatchProfile | undefined, next: RecommendationResult | undefined, saved: Set<string>): ReportItem {
  const photo = getCareerPhoto(r.slug);
  const routeOrder = { primary: 0, common: 1, alternative: 2 } as const;
  const routes = [...(career?.educationRoutes ?? [])]
    .sort((a, b) => routeOrder[a.relevance] - routeOrder[b.relevance])
    .slice(0, 3)
    .map((route) => ({ title: `${educationLevelLabel(route.educationLevel)} · ${RELEVANCE_LABELS[route.relevance] ?? route.relevance}`, detail: fieldLabel(route.fieldKey) }));
  const m = r.matched;
  const strengths = [...new Set([...m.subjects, ...m.skills, ...m.interests])].slice(0, 8);
  const nextSteps: ReportItem["nextSteps"] = [{ text: `Read the full ${r.title} profile in Career Explorer`, href: `/careers/${r.slug}` }];
  if (next) nextSteps.push({ text: `Compare ${r.title} with ${next.title}`, href: `/compare?a=${r.slug}&b=${next.slug}` });
  nextSteps.push({ text: "Talk this direction through with a Nextwise counsellor", href: DISCOVERY_SESSION_CTA.href });
  return {
    careerId: r.careerId,
    slug: r.slug,
    title: r.title,
    familyName: r.familyName,
    summary: r.summary,
    band: { label: MATCH_BAND_LABELS[r.matchBand], tone: BAND_TONE[r.matchBand] },
    reasons: r.reasons.map((x) => x.label),
    strengths,
    gaps: r.gaps.map((x) => x.label),
    routes,
    nextSteps,
    image: photo ? { src: photo.src, alt: photo.alt, credit: `Photo: ${photo.creator}, ${photo.licence}` } : null,
    saved: saved.has(r.careerId),
  };
}

/**
 * Career Intelligence V2 — the full report.
 *
 * Access is checked FIRST, on the server, through the one resolver
 * (requireCareerIntelligence): before the profile is read, the career
 * library is loaded or anything is scored. Without a paid invoice (or staff
 * role) the request is redirected to the upgrade screen and nothing of the
 * report exists. The check runs on every request, so a refund or void
 * locks the report on the next load even if it was opened before.
 *
 * The report is the existing engine's output for the student's saved
 * assessment: the same answers always give the same report, so returning
 * needs no new assessment and no new payment. The number of
 * recommendations is whatever the engine returns.
 */
export default async function CareerReportPage() {
  const state = await requireCareerIntelligence("report");

  const snapshot = await getStudentProfileSnapshot();
  const answers = snapshot ? answersFromSnapshot(snapshot) : null;
  if (!snapshot || !answers || !isAssessmentComplete(answers)) {
    return (
      <CiShell>
        <GuestAnswersTransfer />
        <NotFinishedYet section={answers ? firstOpenSectionIndex(answers) : 0} />
      </CiShell>
    );
  }

  const careers = await getCareersForMatching();
  const { results } = careers.length > 0 ? getRecommendations(snapshot, careers) : { results: [] as RecommendationResult[] };
  const byId = new Map(careers.map((c) => [c.id, c]));
  const saved = new Set(await listSavedCareerIds().catch(() => [] as string[]));
  const items = results.map((r, i) => toReportItem(r, byId.get(r.careerId), results[i + 1] ?? results[i - 1], saved));

  return (
    <CiShell navy>
      <section className="report-hero on-navy" aria-labelledby="ci-report-title">
        <div className="wrap">
          <span className="eyebrow">Career Intelligence report</span>
          <h1 id="ci-report-title" className="display">
            Your career directions, explained.
          </h1>
          <div className="meta">
            <span>
              <Check className="icon" aria-hidden="true" /> Based on your {ASSESSMENT_SECTION_COUNT} completed sections
            </span>
            <span>
              <Save className="icon" aria-hidden="true" /> Built from your saved answers · open it any time from{" "}
              <Link href="/studio" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                Student Studio
              </Link>
            </span>
            <span>
              <ShieldCheck className="icon" aria-hidden="true" /> {state === "staff" ? "Staff access" : "Career Intelligence · active"}
            </span>
          </div>
        </div>
      </section>
      {items.length > 0 ? (
        <CareerReport items={items} />
      ) : (
        <section className="report">
          <div className="wrap">
            <div className="rep-empty">
              <h2 className="display" style={{ margin: 0, color: "var(--navy)" }}>
                Your report can’t be built right now
              </h2>
              <p style={{ color: "var(--muted)" }}>
                {careers.length === 0
                  ? "We couldn’t load the career library just now. Your answers and your access are safe; please try again in a moment."
                  : "Your answers didn’t match any career in the library closely enough. Updating your assessment, or a conversation with a counsellor, can help."}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <Link className="btn btn-primary" href="/career/assessment">
                  Review my answers <ArrowRight className="icon" aria-hidden="true" />
                </Link>
                <Link className="btn btn-quiet" href={DISCOVERY_SESSION_CTA.href}>
                  Book a free session
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </CiShell>
  );
}
