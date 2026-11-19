"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { useGuestProgress } from "@/lib/career-intelligence/assessment/use-guest-progress";
import { ASSESSMENT_SECTION_COUNT, completedSectionKeys, hasAnyAnswer, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";

export type EntryProgress = { kind: "unlocked" } | { kind: "complete" } | { kind: "partial"; done: number } | { kind: "new" };

/**
 * The entry screen's actions. The server decides for a signed-in student
 * (saved profile, live entitlement). For a guest the only progress there can
 * be is on this device, so it is read here after the page has loaded.
 */
export function CareerEntryActions({ server, signedIn }: { server: EntryProgress; signedIn: boolean }) {
  const [howOpen, setHowOpen] = useState(false);
  const local = useGuestProgress();
  const progress: EntryProgress =
    signedIn || !local || !hasAnyAnswer(local.answers)
      ? server
      : isAssessmentComplete(local.answers)
        ? { kind: "complete" }
        : { kind: "partial", done: completedSectionKeys(local.answers).length };

  const pct = progress.kind === "partial" ? Math.round((progress.done / ASSESSMENT_SECTION_COUNT) * 100) : 0;

  return (
    <>
      {progress.kind === "partial" ? (
        <div className="resume">
          <Clock className="icon" aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 160 }}>
            <b>
              Welcome back. You’ve completed {progress.done} of {ASSESSMENT_SECTION_COUNT} sections.
            </b>
            <div className="bar" style={{ marginTop: 8 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Assessment progress">
              <i style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
          </div>
          <Link className="btn btn-primary" href="/career/assessment">
            Continue where I left off <ArrowRight className="icon" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
      <div className="actions">
        {progress.kind === "unlocked" ? (
          <Link className="btn btn-primary" href="/career/report">
            Open my report <ArrowRight className="icon" aria-hidden="true" />
          </Link>
        ) : progress.kind === "complete" ? (
          <Link className="btn btn-primary" href="/career/preview">
            See my free preview <ArrowRight className="icon" aria-hidden="true" />
          </Link>
        ) : progress.kind === "new" ? (
          <Link className="btn btn-primary" href="/career/assessment" id="start">
            Start Free Assessment <ArrowRight className="icon" aria-hidden="true" />
          </Link>
        ) : null}
        <button type="button" className="btn btn-ghost-light" aria-expanded={howOpen} aria-controls="ci-how" onClick={() => setHowOpen((o) => !o)}>
          How Career Intelligence Works
        </button>
      </div>
      <div className="how" id="ci-how" hidden={!howOpen}>
        <div>
          <h3>1 · Take the assessment</h3>
          <p>About 10 minutes, {ASSESSMENT_SECTION_COUNT} short sections. Free, and no account needed to begin.</p>
        </div>
        <div>
          <h3>2 · See your preview</h3>
          <p>One recommendation from your answers, and a look at what your full report contains.</p>
        </div>
        <div>
          <h3>3 · Unlock when ready</h3>
          <p>Choose an eligible plan. Your answers carry over; nothing is repeated.</p>
        </div>
      </div>
    </>
  );
}
