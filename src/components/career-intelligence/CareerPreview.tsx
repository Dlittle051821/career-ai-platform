"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, BarChart3, Check, Clock, Compass, GraduationCap, Info, LayoutGrid, Layers, Lock, Route, ShieldCheck, Sparkles, Target } from "lucide-react";
import { getGuestCareerTeaser } from "@/app/(site)/career/actions";
import { glanceFromAnswers, type Glance } from "@/lib/career-intelligence/assessment/glance";
import { useGuestProgress } from "@/lib/career-intelligence/assessment/use-guest-progress";
import { ASSESSMENT_SECTION_COUNT, firstOpenSectionIndex, isAssessmentComplete, type AssessmentAnswers } from "@/lib/career-intelligence/assessment/model";
import type { CareerTeaser } from "@/lib/career-intelligence/teaser";
import { NotFinishedYet } from "./AssessmentComplete";
import { UnlockDialog, type UnlockPlan } from "./UnlockDialog";

export type PreviewStatus = "none" | "payment_pending" | "revoked" | "expired";

const LOCKED = [
  { Icon: Target, title: "Detailed career-fit explanations", text: "Every reason each career appeared, tied to your answers" },
  { Icon: BarChart3, title: "Strengths and development areas", text: "Where you are strong, and what to build next" },
  { Icon: GraduationCap, title: "Education and qualification pathways", text: "Degrees, routes and typical entry points" },
  { Icon: Layers, title: "Skills-gap checklist", text: "The skills each career expects that you could add" },
  { Icon: Route, title: "Career development roadmap", text: "Practical next steps, saved to Student Studio" },
] as const;

interface CareerPreviewProps {
  signedIn: boolean;
  /** Signed in: computed on the server. Guest: null, fetched from the teaser action with this device's answers. */
  teaser: CareerTeaser | null;
  glance: Glance | null;
  status: PreviewStatus;
  verified: UnlockPlan & { inclusions: string[] };
  /** Other plans that include Career Intelligence, from the live catalogue. */
  alsoIncludedIn: string;
  purchasesOpen: boolean;
}

/**
 * "Here's a first direction." The one free recommendation, the locked report
 * outline and the unlock panel. Everything personal on this screen is the
 * teaser contract (title, family, summary, one reason, photo) and the
 * student's own answers; the locked cards are generic descriptions, so no
 * report content exists on the page to be revealed.
 */
export function CareerPreview({ signedIn, teaser: serverTeaser, glance: serverGlance, status, verified, alsoIncludedIn, purchasesOpen }: CareerPreviewProps) {
  const local = useGuestProgress();
  const guestAnswers = !signedIn && local && isAssessmentComplete(local.answers) ? local.answers : null;
  const guestKey = guestAnswers ? JSON.stringify(guestAnswers) : "";
  const [guestTeaser, setGuestTeaser] = useState<{ key: string; teaser: CareerTeaser | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [mobBar, setMobBar] = useState(false);

  // a guest's answers live on this device: send them to the teaser action, which returns the teaser contract only
  useEffect(() => {
    if (!guestKey) return;
    let live = true;
    getGuestCareerTeaser(JSON.parse(guestKey) as unknown)
      .then((t) => live && setGuestTeaser({ key: guestKey, teaser: t, failed: false }))
      .catch(() => live && setGuestTeaser({ key: guestKey, teaser: null, failed: true }));
    return () => {
      live = false;
    };
  }, [guestKey, attempt]);

  const glance = useMemo(() => serverGlance ?? (guestAnswers ? glanceFromAnswers(guestAnswers) : null), [serverGlance, guestAnswers]);
  const current = guestTeaser && guestTeaser.key === guestKey ? guestTeaser : null;
  const teaser = signedIn ? serverTeaser : (current?.teaser ?? null);
  const guestState: "loading" | "ready" | "unfinished" | "failed" = signedIn
    ? "ready"
    : local === undefined
      ? "loading"
      : !guestAnswers
        ? "unfinished"
        : !current
          ? "loading"
          : current.failed
            ? "failed"
            : current.teaser
              ? "ready"
              : "unfinished";
  const openSection = local ? firstOpenSectionIndex(local.answers) : 0;
  const retry = () => {
    setGuestTeaser(null);
    setAttempt((n) => n + 1);
  };

  // phones: a slim unlock bar once the recommendation card has scrolled away
  useEffect(() => {
    const onScroll = () => {
      const card = document.querySelector(".ci2 .rec");
      const panel = document.querySelector(".ci2 .unlock");
      if (!card || !panel) return;
      setMobBar(card.getBoundingClientRect().bottom < 0 && panel.getBoundingClientRect().top > window.innerHeight - 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeUnlock = useCallback(() => setUnlockOpen(false), []);

  if (guestState === "unfinished") return <NotFinishedYet section={openSection} />;

  return (
    <section className="preview" aria-labelledby="ci-preview-title">
      <div className="wrap">
        <div className="pv-head">
          <div>
            <span className="eyebrow">Your free preview</span>
            <h1 id="ci-preview-title" className="display">
              Here’s a first direction.
            </h1>
            <p>One recommendation from your assessment, with the main reason it appeared. Your full report holds the rest.</p>
          </div>
          {teaser?.kind === "illustrative" ? (
            <span className="tag-illustrative">
              <Info className="icon" aria-hidden="true" /> Illustrative example, not your result
            </span>
          ) : null}
        </div>

        <StatusBanner status={status} />

        {glance ? (
          <div className="glance" aria-label="Your answers at a glance">
            <span className="t">From your answers</span>
            <span className="g">
              Strongest subjects <b>{glance.subjects.join(", ") || "—"}</b>
            </span>
            <span className="g">
              Drawn to <b>{glance.interests.join(", ") || "—"}</b>
            </span>
            <span className="g">
              Matters most <b>{glance.priorities.join(", ") || "—"}</b>
            </span>
          </div>
        ) : null}

        <div className="pv-grid">
          {guestState === "failed" ? (
            <article className="rec" aria-live="polite">
              <div className="bd">
                <h2 className="display">We couldn’t load your preview</h2>
                <p className="sum">Your answers are safe on this device. Check your connection and try again.</p>
                <div className="ft">
                  <button type="button" className="btn btn-primary" onClick={retry}>
                    Try again
                  </button>
                </div>
              </div>
            </article>
          ) : !teaser ? (
            <article className="rec" aria-busy="true" aria-label="Loading your first recommendation">
              <div className="ph" />
              <div className="bd">
                <p className="sum">Preparing your first recommendation…</p>
              </div>
            </article>
          ) : (
            <TeaserCard teaser={teaser} />
          )}

          <section className="locked" aria-labelledby="ci-locked-title">
            <h2 id="ci-locked-title">
              <Lock className="icon" aria-hidden="true" /> In your full report
            </h2>
            <p className="note">Everything below is prepared from your answers when you unlock.</p>
            <ul className="lk-list">
              <li className="lk" style={{ animationDelay: ".35s" }}>
                <span className="ic">
                  <LayoutGrid className="icon" aria-hidden="true" />
                </span>
                <span>
                  <b>More career recommendations</b>
                  <span>Ranked by fit, each with its own explanation</span>
                  <span className="ghosts" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <span className="ghost" key={i}>
                        <Lock className="icon" />
                      </span>
                    ))}
                  </span>
                </span>
                <span className="lock" role="img" aria-label="Locked">
                  <Lock className="icon" aria-hidden="true" />
                </span>
              </li>
              {LOCKED.map(({ Icon, title, text }, i) => (
                <li className="lk" key={title} style={{ animationDelay: `${0.47 + i * 0.1}s` }}>
                  <span className="ic">
                    <Icon className="icon" aria-hidden="true" />
                  </span>
                  <span>
                    <b>{title}</b>
                    <span>{text}</span>
                  </span>
                  <span className="lock" role="img" aria-label="Locked">
                    <Lock className="icon" aria-hidden="true" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="trust">
              <ShieldCheck className="icon" aria-hidden="true" />
              <span>Locked sections are not hidden on this page. Nextwise builds them only after your plan is confirmed, so nothing of yours is exposed before then.</span>
            </div>
          </section>
        </div>
      </div>

      <section className="unlock on-navy" aria-labelledby="ci-unlock-panel-title">
        <div className="wrap unlock-grid">
          <div>
            <span className="eyebrow">Unlock Career Intelligence</span>
            <h2 id="ci-unlock-panel-title" className="display">
              You’ve explored your potential. Now understand the opportunities.
            </h2>
            <p className="lede">Unlock the complete Career Intelligence report and see the reasoning, pathways and next steps behind your recommendations.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" id="unlockbtn" onClick={() => setUnlockOpen(true)}>
                Unlock My Career Intelligence <ArrowRight className="icon" aria-hidden="true" />
              </button>
              <Link className="btn btn-ghost-light" href="/career/plans" id="compare">
                Compare Nextwise Plans
              </Link>
            </div>
            <div className="keep">
              <span>
                <Check className="icon" aria-hidden="true" /> Your {ASSESSMENT_SECTION_COUNT} sections carry over
              </span>
              <span>
                <Check className="icon" aria-hidden="true" /> No need to repeat the assessment
              </span>
              <span>
                <Check className="icon" aria-hidden="true" /> One-time payment
              </span>
            </div>
          </div>
          <aside className="price-card" aria-label={verified.name}>
            <span className="badge badge-ver">
              {verified.name}
            </span>
            <div className="row">
              <span className="price">{verified.price}</span>
              <span className="price-note">
                final price
                <br />
                GST included
              </span>
            </div>
            <ul className="inc">
              <li>
                <Check className="icon" aria-hidden="true" />
                <span>Your full Career Intelligence report</span>
              </li>
              {verified.inclusions.slice(0, 3).map((inc) => (
                <li key={inc}>
                  <Check className="icon" aria-hidden="true" />
                  <span>{inc}</span>
                </li>
              ))}
            </ul>
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--muted)" }}>Also included in {alsoIncludedIn}.</p>
          </aside>
        </div>
      </section>

      <div className={`mob-unlock ${mobBar ? "show" : ""}`} aria-hidden={!mobBar}>
        <span>
          <b>Full report · {verified.price}</b>
          <span>{verified.name} · GST included</span>
        </span>
        <button type="button" className="btn btn-primary" tabIndex={mobBar ? 0 : -1} onClick={() => setUnlockOpen(true)}>
          Unlock <ArrowRight className="icon" aria-hidden="true" />
        </button>
      </div>

      {unlockOpen ? <UnlockDialog plan={verified} signedIn={signedIn} purchasesOpen={purchasesOpen} onClose={closeUnlock} /> : null}
    </section>
  );
}

function TeaserCard({ teaser }: { teaser: CareerTeaser }) {
  const illustrative = teaser.kind === "illustrative";
  return (
    <article className="rec" aria-labelledby="ci-rec-title">
      <div className="ph">
        {teaser.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teaser.image.src} alt={teaser.image.alt} />
        ) : (
          <span className="tile">
            <Compass className="icon" aria-hidden="true" />
          </span>
        )}
        <div className="ribbon">
          <span>{illustrative ? "Example recommendation" : "Your first recommendation"}</span>
        </div>
        {teaser.image ? <span className="credit">{teaser.image.credit}</span> : null}
      </div>
      <div className="bd">
        <div className="fam">{teaser.familyName}</div>
        <h2 id="ci-rec-title" className="display">
          {teaser.title}
        </h2>
        <p className="sum">{teaser.summary}</p>
        <div className="why1">
          <span className="ic">
            <Sparkles className="icon" aria-hidden="true" />
          </span>
          <span>
            <b>{illustrative ? "Why a career appears" : "Why it may be relevant"}</b>
            <span>{teaser.reason}</span>
          </span>
        </div>
        <div className="still" aria-label={`Still locked for ${teaser.title}`}>
          <span className="st-t">
            <Lock className="icon" aria-hidden="true" /> Still locked for {teaser.title}
          </span>
          <span className="st-c">Fit level</span>
          <span className="st-c">More reasons</span>
          <span className="st-c">Strengths you bring</span>
          <span className="st-c">Education pathway</span>
          <span className="st-c">Next steps</span>
        </div>
        <div className="ft">
          <small>Career Explorer shows this career’s general profile, free.</small>
          <Link className="btn btn-quiet" href={`/careers/${teaser.slug}`}>
            Explore this career free
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatusBanner({ status }: { status: PreviewStatus }) {
  if (status === "payment_pending")
    return (
      <div className="banner pending" role="status">
        <Clock className="icon" aria-hidden="true" />
        <span>
          <b>Payment not confirmed yet</b>A payment for an eligible plan has been started but isn’t confirmed as paid. Your report unlocks automatically once it is. Your answers are safe.
        </span>
      </div>
    );
  if (status === "revoked")
    return (
      <div className="banner revoked" role="status">
        <Info className="icon" aria-hidden="true" />
        <span>
          <b>Your plan is no longer active</b>The plan was refunded or cancelled, so the full report is locked again. Your assessment answers are kept.
        </span>
      </div>
    );
  if (status === "expired")
    return (
      <div className="banner revoked" role="status">
        <AlertCircle className="icon" aria-hidden="true" />
        <span>
          <b>Your access has ended</b>Your Career Intelligence access period is over. Your assessment answers are kept.
        </span>
      </div>
    );
  return null;
}
