"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Check, GraduationCap, LayoutGrid, Route, Save, Target } from "lucide-react";
import { useGuestProgress } from "@/lib/career-intelligence/assessment/use-guest-progress";
import { ASSESSMENT_SECTIONS, ASSESSMENT_SECTION_COUNT, firstOpenSectionIndex, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";

const WILL_SHOW = [
  { Icon: LayoutGrid, title: "Your ranked career recommendations", text: "Careers ordered by how well they fit your answers" },
  { Icon: Target, title: "Why each one fits you", text: "The reasons, tied to your own answers" },
  { Icon: BarChart3, title: "Strengths and development areas", text: "What you bring, and what is worth building" },
  { Icon: GraduationCap, title: "Education pathways", text: "Typical routes, degrees and entry points" },
  { Icon: Route, title: "Your next steps", text: "Practical steps, saved to Student Studio" },
] as const;

/** "Your next direction starts here." Shown only when all eight sections are really answered; the saved line says where. */
export function AssessmentCompleteView({ savedTo }: { savedTo: "account" | "device" }) {
  return (
    <section className="complete on-navy" aria-labelledby="ci-complete-title">
      <div className="wrap">
        <span className="eyebrow">Assessment complete</span>
        <h1 id="ci-complete-title" className="display">
          Your next direction starts here.
        </h1>
        <p className="lede">
          You finished all {ASSESSMENT_SECTION_COUNT} sections. {savedTo === "account" ? "Your answers are saved to your account" : "Your answers are saved on this device"}, and your
          preview is ready.
        </p>
        <div className="complete-grid">
          <div className="panel-dark">
            <h2>Sections completed</h2>
            <ul className="done-list">
              {ASSESSMENT_SECTIONS.map((s, i) => (
                <li key={s.key} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                  <span className="ok">
                    <Check className="icon" aria-hidden="true" />
                  </span>
                  {s.rail}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel-dark">
            <h2>Your full report will show</h2>
            <ul className="will">
              {WILL_SHOW.map(({ Icon, title, text }, i) => (
                <li key={title} style={{ animationDelay: `${1.1 + i * 0.12}s` }}>
                  <span className="ic">
                    <Icon className="icon" aria-hidden="true" />
                  </span>
                  <span>
                    <b>{title}</b>
                    <span>{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="cta" style={{ animationDelay: "1.9s" }}>
          <Link className="btn btn-primary" href="/career/preview" id="seeprev">
            See my free preview <ArrowRight className="icon" aria-hidden="true" />
          </Link>
          <span className="saved">
            <Save className="icon" aria-hidden="true" /> {savedTo === "account" ? "Answers saved to your account" : "Answers saved on this device"}
          </span>
        </div>
      </div>
    </section>
  );
}

export function NotFinishedYet({ section }: { section: number }) {
  return (
    <section className="status-card wrap">
      <span className="eyebrow">Career Intelligence</span>
      <h1 className="display">Finish the assessment first</h1>
      <p>Your preview appears once all {ASSESSMENT_SECTION_COUNT} sections are answered. Everything you have answered so far is kept.</p>
      <div className="actions">
        <Link className="btn btn-primary" href={`/career/assessment?section=${section + 1}`}>
          Continue the assessment <ArrowRight className="icon" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/** A guest's completion lives only on this device, so it is checked here. */
export function GuestCompletion() {
  const local = useGuestProgress();
  if (local === undefined) return <div className="status-card wrap" aria-busy="true" />;
  if (local && isAssessmentComplete(local.answers)) return <AssessmentCompleteView savedTo="device" />;
  return <NotFinishedYet section={local ? firstOpenSectionIndex(local.answers) : 0} />;
}
