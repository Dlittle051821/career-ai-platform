import Link from "next/link";
import { ArrowRight, Bookmark, PenLine, Sparkles } from "lucide-react";
import type { CareerIntelligenceAccessState } from "@/lib/career-intelligence/access";
import { canViewCareerIntelligence } from "@/lib/career-intelligence/access";
import { ASSESSMENT_SECTION_COUNT } from "@/lib/career-intelligence/assessment/model";
import { v54Grotesk } from "@/components/sections/home/v54/fonts";
import { GuestAnswersTransfer } from "./GuestAnswersTransfer";
import "@/styles/career-intelligence-v2.css";

/**
 * Career Intelligence V2 — the three entry points added to the existing
 * Student Studio: the report (or the preview while locked), the assessment,
 * and saved careers. Everything is decided on the server from the live
 * entitlement and the saved profile; nothing else on Studio changes.
 */
export function StudioCareerIntelligencePanel({
  access,
  sectionsDone,
  savedCareerCount,
}: {
  access: CareerIntelligenceAccessState;
  sectionsDone: number;
  savedCareerCount: number;
}) {
  const unlocked = canViewCareerIntelligence(access);
  const complete = sectionsDone === ASSESSMENT_SECTION_COUNT;

  const report = unlocked
    ? { text: complete ? "Ready. Your recommendations with reasons, pathways and next steps." : "Unlocked. Finish your assessment to build it.", href: complete ? "/career/report" : "/career/assessment", cta: complete ? "Open my report" : "Finish assessment" }
    : access === "payment_pending"
      ? { text: "Payment not confirmed yet. Your report unlocks automatically once it is.", href: "/career/preview", cta: "See my preview" }
      : access === "revoked" || access === "expired"
        ? { text: "Your plan is no longer active, so the report is locked. Your answers are kept.", href: "/career/preview", cta: "See my preview" }
        : complete
          ? { text: "Assessment complete. Your preview is ready; the full report unlocks with an eligible plan.", href: "/career/preview", cta: "See my preview" }
          : { text: "The assessment is free. Your preview appears when it’s complete.", href: "/career", cta: sectionsDone > 0 ? "Continue" : "Start free assessment" };

  return (
    <div className={`ci2 ${v54Grotesk.variable}`} style={{ background: "transparent" }}>
      <GuestAnswersTransfer />
      <section className="studio" style={{ padding: 0 }} aria-labelledby="ci-studio-title">
        <h2 id="ci-studio-title" className="display" style={{ margin: 0, font: "700 20px/1.25 var(--display)", color: "var(--navy)" }}>
          Career Intelligence
        </h2>
        <div className="st-grid" style={{ marginTop: 14 }}>
          <div className={`st-card ${unlocked && complete ? "hl" : ""}`}>
            <span className="ic">
              <Sparkles className="icon" aria-hidden="true" />
            </span>
            <h3 style={{ margin: "10px 0 0", font: "700 19px/1.25 var(--display)", color: "var(--navy)" }}>Career Intelligence report</h3>
            <p>{report.text}</p>
            <Link className={`btn ${unlocked && complete ? "btn-primary" : "btn-quiet"}`} href={report.href}>
              {report.cta} <ArrowRight className="icon" aria-hidden="true" />
            </Link>
          </div>
          <div className="st-card">
            <span className="ic">
              <PenLine className="icon" aria-hidden="true" />
            </span>
            <h3 style={{ margin: "10px 0 0", font: "700 19px/1.25 var(--display)", color: "var(--navy)" }}>Your assessment</h3>
            <p>{complete ? `All ${ASSESSMENT_SECTION_COUNT} sections complete. You can update answers any time.` : `${sectionsDone} of ${ASSESSMENT_SECTION_COUNT} sections complete.`}</p>
            <Link className="btn btn-quiet" href="/career/assessment">
              {complete ? "Review answers" : sectionsDone > 0 ? "Continue" : "Start"}
            </Link>
          </div>
          <div className="st-card">
            <span className="ic">
              <Bookmark className="icon" aria-hidden="true" />
            </span>
            <h3 style={{ margin: "10px 0 0", font: "700 19px/1.25 var(--display)", color: "var(--navy)" }}>Saved careers</h3>
            <p>{savedCareerCount > 0 ? `${savedCareerCount} career${savedCareerCount === 1 ? "" : "s"} saved.` : "Careers you save in Career Explorer or your report appear here."}</p>
            <Link className="btn btn-quiet" href={savedCareerCount > 0 ? "/saved#saved-careers-title" : "/careers"}>
              {savedCareerCount > 0 ? "View saved" : "Explore careers"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
