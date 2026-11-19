"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { saveCareerAssessmentSection } from "@/app/(site)/career/actions";
import { INTEREST_STRENGTH_LABELS, RATING_SCALE_LABELS, SUBJECT_RATING_LABELS, type OptionDef } from "@/data/profile-options";
import { writeGuestProgress } from "@/lib/career-intelligence/assessment/guest-store";
import { useGuestProgress } from "@/lib/career-intelligence/assessment/use-guest-progress";
import {
  ASSESSMENT_OPTIONS,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_SECTION_COUNT,
  MINIMUM_WORK_STATEMENTS_RATED,
  STREAM_OPTIONS,
  checkSection,
  emptyAnswers,
  firstOpenSectionIndex,
  type AssessmentAnswers,
} from "@/lib/career-intelligence/assessment/model";
import { MINIMUM_INTERESTS_SELECTED, MINIMUM_PRIORITIES_RATED, MINIMUM_SKILLS_SELECTED, MINIMUM_SUBJECTS_RATED } from "@/lib/profile/completion";

type SaveState = "idle" | "saving" | "device" | "account" | "device-unavailable" | "error";

const PRIORITY_LABELS: Record<number, string> = { 1: "Not important", 2: "Slightly important", 3: "Moderately important", 4: "Very important", 5: "Essential" };
const SUBJECTS_SHOWN_FIRST = 8;
const WORK_SHOWN_FIRST = 7;

/**
 * Career Intelligence V2 — the free assessment (8 sections).
 *
 * Guests answer without an account; progress is kept on this device only
 * (answers, never identity; see guest-store.ts). A signed-in student's answers
 * are saved to their profile, section by section, through the server
 * (src/app/(site)/career/actions.ts). Validation asks only for what the
 * profile genuinely needs; optional questions never block.
 */
export function CareerAssessment({ signedIn, initialAnswers, initialSection }: { signedIn: boolean; initialAnswers: AssessmentAnswers | null; initialSection: number | null }) {
  const local = useGuestProgress();
  if (signedIn) {
    const initial = initialAnswers ?? emptyAnswers();
    return <AssessmentForm signedIn initial={initial} initialStep={initialSection ?? firstOpenSectionIndex(initial)} initialSave="idle" />;
  }
  // a guest's progress lives only on this device, so the form starts once it has been read
  if (local === undefined) return <section className="assess" aria-busy="true" style={{ minHeight: "70vh" }} />;
  return <AssessmentForm signedIn={false} initial={local?.answers ?? emptyAnswers()} initialStep={initialSection ?? local?.step ?? 0} initialSave={local ? "device" : "idle"} />;
}

function AssessmentForm({ signedIn, initial, initialStep, initialSave }: { signedIn: boolean; initial: AssessmentAnswers; initialStep: number; initialSave: SaveState }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AssessmentAnswers>(initial);
  const answersRef = useRef(initial);
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(initialSave);
  const [laterOpen, setLaterOpen] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [showAllWork, setShowAllWork] = useState(false);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const section = ASSESSMENT_SECTIONS[step];
  const update = useCallback(
    (fn: (a: AssessmentAnswers) => AssessmentAnswers) => {
      setError(null);
      const next = fn(answersRef.current);
      answersRef.current = next;
      setAnswers(next);
      if (!signedIn) setSaveState(writeGuestProgress(next, step) ? "device" : "device-unavailable");
    },
    [signedIn, step],
  );

  const goTo = (i: number) => {
    setError(null);
    setStep(i);
    if (!signedIn) writeGuestProgress(answers, i);
    window.scrollTo({ top: 0 });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const check = checkSection(section.key, answers);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    const isLast = step === ASSESSMENT_SECTION_COUNT - 1;
    const advance = () => {
      if (!isLast) {
        goTo(step + 1);
        return;
      }
      const open = ASSESSMENT_SECTIONS.findIndex((s) => !checkSection(s.key, answers).ok);
      if (open !== -1) {
        goTo(open);
        setError(`Section ${open + 1}, ${ASSESSMENT_SECTIONS[open].rail}, still needs an answer: ${checkSection(ASSESSMENT_SECTIONS[open].key, answers).message}`);
        return;
      }
      router.push("/career/assessment/complete");
    };
    if (!signedIn) {
      setSaveState(writeGuestProgress(answers, isLast ? step : step + 1) ? "device" : "device-unavailable");
      advance();
      return;
    }
    setSaveState("saving");
    startTransition(async () => {
      const result = await saveCareerAssessmentSection(section.key, answers);
      if (result.status === "saved") {
        setSaveState("account");
        advance();
      } else if (result.status === "guest") {
        // the session ended mid-assessment: keep going on this device
        setSaveState(writeGuestProgress(answers, step) ? "device" : "device-unavailable");
        setError("You were signed out, so this section is now saved on this device. Log in again to save it to your account.");
      } else {
        setSaveState("error");
        setError(result.message);
      }
    });
  };

  const pct = Math.round((step / ASSESSMENT_SECTION_COUNT) * 100);
  const nextPath = `/career/assessment?section=${step + 1}`;

  return (
    <section className="assess">
      <div className="wrap assess-grid">
        <aside className="rail" aria-label="Assessment sections">
          <h2>Career Intelligence assessment</h2>
          <div className="sub">{ASSESSMENT_SECTION_COUNT} sections · about 10 minutes</div>
          <ol>
            {ASSESSMENT_SECTIONS.map((s, i) => {
              const done = checkSection(s.key, answers).ok;
              return (
                <li key={s.key} className={`${done ? "done" : ""} ${i === step ? "cur" : ""}`}>
                  <button type="button" onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}>
                    <span className="dot">{done ? <Check className="icon" aria-label="Answered" /> : i + 1}</span>
                    {s.rail}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="free">
            <ShieldCheck className="icon" aria-hidden="true" /> Free to complete. No payment needed.
          </div>
        </aside>

        <div>
          <div className="progress">
            <div className="track" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={ASSESSMENT_SECTION_COUNT} aria-label={`Section ${step + 1} of ${ASSESSMENT_SECTION_COUNT}`}>
              <i style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
            <span className="lbl">
              Section {step + 1} of {ASSESSMENT_SECTION_COUNT}
            </span>
          </div>

          <form className="qcard" id="qform" noValidate onSubmit={onSubmit}>
            <div className="step">{section.rail.toUpperCase()}</div>
            <h1 className="display" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
              {section.title}
            </h1>
            <p className="why">{section.why}</p>

            <SectionBody
              sectionKey={section.key}
              a={answers}
              update={update}
              showAllSubjects={showAllSubjects}
              onShowAllSubjects={() => setShowAllSubjects(true)}
              showAllWork={showAllWork}
              onShowAllWork={() => setShowAllWork(true)}
            />

            <div className={`valid ${error ? "show" : ""}`} role="alert">
              {error ? (
                <>
                  <AlertCircle className="icon" aria-hidden="true" />
                  <span>{error}</span>
                </>
              ) : null}
            </div>

            <div className="qnav">
              <div className="left">
                {step > 0 ? (
                  <button type="button" className="btn btn-quiet" onClick={() => goTo(step - 1)} disabled={pending}>
                    <ArrowLeft className="icon" aria-hidden="true" /> Back
                  </button>
                ) : null}
                <button type="button" className="btn-link" onClick={() => setLaterOpen(true)}>
                  Save and continue later
                </button>
              </div>
              <button type="submit" className="btn btn-primary" id="next" disabled={pending}>
                {pending ? "Saving…" : step === ASSESSMENT_SECTION_COUNT - 1 ? "Finish assessment" : "Continue"} <ArrowRight className="icon" aria-hidden="true" />
              </button>
            </div>
          </form>
          <SaveLine state={saveState} />
        </div>
      </div>

      {laterOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ci-later-title" onKeyDown={(e) => e.key === "Escape" && setLaterOpen(false)}>
          <div className="scrim" onClick={() => setLaterOpen(false)} />
          <div className="dialog">
            <button type="button" className="x" aria-label="Close" onClick={() => setLaterOpen(false)} autoFocus>
              <X className="icon" aria-hidden="true" />
            </button>
            <span className="eyebrow">Save and continue later</span>
            {signedIn ? (
              <>
                <h2 id="ci-later-title" className="display">
                  Your answers are saved
                </h2>
                <p>Each section you finish is saved to your account. Come back from Career Intelligence or Student Studio any time.</p>
                <div className="acts">
                  <Link className="btn btn-primary" href="/studio">
                    Go to Student Studio <ArrowRight className="icon" aria-hidden="true" />
                  </Link>
                  <button type="button" className="btn btn-quiet" onClick={() => setLaterOpen(false)}>
                    Keep going now
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="ci-later-title" className="display">
                  Keep your answers
                </h2>
                <p>
                  {saveState === "device-unavailable"
                    ? "This browser isn’t keeping your answers, so they will be lost if you close this tab. A free account keeps them safe."
                    : "Your answers are saved on this device. Create a free account to keep them on any device. No payment is needed."}
                </p>
                <div className="acts">
                  <Link className="btn btn-primary" href={`/register?next=${encodeURIComponent(nextPath)}`}>
                    Create a free account <ArrowRight className="icon" aria-hidden="true" />
                  </Link>
                  <Link className="btn btn-quiet" href={`/login?next=${encodeURIComponent(nextPath)}`}>
                    I already have an account
                  </Link>
                  <button type="button" className="btn-link" onClick={() => setLaterOpen(false)} style={{ justifySelf: "center", marginTop: 6 }}>
                    Keep going now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SaveLine({ state }: { state: SaveState }) {
  if (state === "device")
    return (
      <p className="saved-note" style={{ marginTop: 12 }} role="status">
        <CheckCircle2 className="icon" aria-hidden="true" /> Answers saved on this device as you go
      </p>
    );
  if (state === "account")
    return (
      <p className="saved-note" style={{ marginTop: 12 }} role="status">
        <CheckCircle2 className="icon" aria-hidden="true" /> Saved to your account
      </p>
    );
  if (state === "saving")
    return (
      <p className="saved-note" style={{ marginTop: 12, color: "var(--muted)" }} role="status">
        Saving…
      </p>
    );
  if (state === "device-unavailable")
    return (
      <p className="saved-note warn" style={{ marginTop: 12 }} role="status">
        <AlertCircle className="icon" aria-hidden="true" /> This browser isn’t storing your answers. Finish in this tab, or create a free account.
      </p>
    );
  if (state === "error")
    return (
      <p className="saved-note err" style={{ marginTop: 12 }} role="status">
        <AlertCircle className="icon" aria-hidden="true" /> Not saved yet. Your answers are still here; try Continue again.
      </p>
    );
  return null;
}

// ---------------------------------------------------------------------------
// Question building blocks
// ---------------------------------------------------------------------------
function Radios({ id, label, optional, options, value, onChange }: { id: string; label: string; optional?: boolean; options: OptionDef[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="q" role="radiogroup" aria-labelledby={id}>
      <span className="ql" id={id}>
        {label} {optional ? <span style={{ fontWeight: 500, color: "var(--muted)" }}>(optional)</span> : null}
      </span>
      <div className="opts">
        {options.map((o) => (
          <button key={o.key} type="button" className="opt" role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: OptionDef[]; selected: (key: string) => boolean; onToggle: (key: string) => void }) {
  return (
    <div className="opts">
      {options.map((o) => (
        <button key={o.key} type="button" className="opt" aria-pressed={selected(o.key)} onClick={() => onToggle(o.key)}>
          <Check className="icon tick" aria-hidden="true" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RateRow({ label, value, labels, onRate, showValue = true }: { label: string; value: number | undefined; labels: Record<number, string>; onRate: (v: number) => void; showValue?: boolean }) {
  return (
    <div className="rate-row">
      <div>
        <span className="nm">{label}</span>
        {showValue ? <span className="val">{value ? labels[value] : ""}</span> : null}
      </div>
      <div className="scale" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={`${v}: ${labels[v]}`} onClick={() => onRate(v)}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function Count({ n, min, noun }: { n: number; min: number; noun: string }) {
  return (
    <span className={`sel-count ${n >= min ? "ok" : ""}`}>
      {n} {noun} · minimum {min}
    </span>
  );
}

const toggleKey = <T,>(record: Record<string, T>, key: string, value: T): Record<string, T> => {
  const next = { ...record };
  if (key in next) delete next[key];
  else next[key] = value;
  return next;
};

function SectionBody({
  sectionKey,
  a,
  update,
  showAllSubjects,
  onShowAllSubjects,
  showAllWork,
  onShowAllWork,
}: {
  sectionKey: (typeof ASSESSMENT_SECTIONS)[number]["key"];
  a: AssessmentAnswers;
  update: (fn: (a: AssessmentAnswers) => AssessmentAnswers) => void;
  showAllSubjects: boolean;
  onShowAllSubjects: () => void;
  showAllWork: boolean;
  onShowAllWork: () => void;
}) {
  const O = ASSESSMENT_OPTIONS;
  switch (sectionKey) {
    case "education": {
      const streamOptions = a.education.fieldOfStudy && !STREAM_OPTIONS.some((o) => o.key === a.education.fieldOfStudy) ? [...STREAM_OPTIONS, { key: a.education.fieldOfStudy, label: a.education.fieldOfStudy }] : STREAM_OPTIONS;
      return (
        <>
          <Radios id="q-status" label="What best describes you right now?" options={O.currentStatus} value={a.education.currentStatus} onChange={(v) => update((p) => ({ ...p, education: { ...p.education, currentStatus: v } }))} />
          <Radios id="q-level" label="Highest education level you have completed or are studying" options={O.educationLevel} value={a.education.educationLevel} onChange={(v) => update((p) => ({ ...p, education: { ...p.education, educationLevel: v } }))} />
          <Radios id="q-edstatus" label="At that level, are you…" options={O.educationStatus} value={a.education.educationStatus} onChange={(v) => update((p) => ({ ...p, education: { ...p.education, educationStatus: v } }))} />
          <Radios
            id="q-stream"
            label="Your stream or field"
            optional
            options={streamOptions}
            value={a.education.fieldOfStudy}
            onChange={(v) => update((p) => ({ ...p, education: { ...p.education, fieldOfStudy: p.education.fieldOfStudy === v ? null : v } }))}
          />
        </>
      );
    }
    case "subjects": {
      const list = showAllSubjects ? O.subjects : O.subjects.slice(0, SUBJECTS_SHOWN_FIRST);
      const n = Object.keys(a.subjects).length;
      return (
        <div className="q">
          <span className="ql">How strong are you in each subject, and how much do you enjoy it?</span>
          <span className="qh">1 = Weak / dislike · 5 = Very strong / enjoy. Skip subjects you haven’t studied.</span>
          <div style={{ marginTop: 8 }}>
            {list.map((o) => (
              <RateRow key={o.key} label={o.label} value={a.subjects[o.key]} labels={SUBJECT_RATING_LABELS} onRate={(v) => update((p) => ({ ...p, subjects: { ...p.subjects, [o.key]: v } }))} />
            ))}
          </div>
          {!showAllSubjects && O.subjects.length > SUBJECTS_SHOWN_FIRST ? (
            <button type="button" className="btn-link more" onClick={onShowAllSubjects}>
              Show all {O.subjects.length} subjects
            </button>
          ) : null}
          <div>
            <Count n={n} min={MINIMUM_SUBJECTS_RATED} noun="rated" />
          </div>
        </div>
      );
    }
    case "interests":
      return (
        <div className="q">
          <span className="ql">What are you drawn to?</span>
          <span className="qh">Choose as many as feel true. Minimum {MINIMUM_INTERESTS_SELECTED}.</span>
          <Chips options={O.interests} selected={(k) => k in a.interests} onToggle={(k) => update((p) => ({ ...p, interests: toggleKey(p.interests, k, 3) }))} />
          <Count n={Object.keys(a.interests).length} min={MINIMUM_INTERESTS_SELECTED} noun="selected" />
          {Object.keys(a.interests).length > 0 ? (
            <details style={{ marginTop: 14 }}>
              <summary className="btn-link" style={{ display: "inline" }}>
                Say how strongly (optional)
              </summary>
              <div style={{ marginTop: 8 }}>
                {O.interests
                  .filter((o) => o.key in a.interests)
                  .map((o) => (
                    <RateRow key={o.key} label={o.label} value={a.interests[o.key]} labels={INTEREST_STRENGTH_LABELS} onRate={(v) => update((p) => ({ ...p, interests: { ...p.interests, [o.key]: v } }))} />
                  ))}
              </div>
            </details>
          ) : null}
        </div>
      );
    case "skills": {
      const all = [...O.technicalSkills, ...O.transferableSkills];
      const chosen = all.filter((o) => o.key in a.skills);
      return (
        <>
          <div className="q">
            <span className="ql">Technical skills you have tried</span>
            <Chips options={O.technicalSkills} selected={(k) => k in a.skills} onToggle={(k) => update((p) => ({ ...p, skills: toggleKey(p.skills, k, "beginner") }))} />
          </div>
          <div className="q">
            <span className="ql">Transferable skills</span>
            <Chips options={O.transferableSkills} selected={(k) => k in a.skills} onToggle={(k) => update((p) => ({ ...p, skills: toggleKey(p.skills, k, "beginner") }))} />
            <Count n={chosen.length} min={MINIMUM_SKILLS_SELECTED} noun="selected" />
          </div>
          {chosen.length > 0 ? (
            <div className="q">
              <span className="ql">Your level in each</span>
              <span className="qh">Beginner is fine.</span>
              <div className="lvl-list">
                {chosen.map((o) => (
                  <div className="lvl-row" key={o.key}>
                    <span className="nm">{o.label}</span>
                    <div className="seg" role="radiogroup" aria-label={`${o.label} level`}>
                      {O.skillLevels.map((l) => (
                        <button key={l.key} type="button" role="radio" aria-checked={a.skills[o.key] === l.key} onClick={() => update((p) => ({ ...p, skills: { ...p.skills, [o.key]: l.key } }))}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      );
    }
    case "work": {
      const list = showAllWork ? O.work : O.work.slice(0, WORK_SHOWN_FIRST);
      return (
        <div className="q">
          <span className="ql">How much do you agree?</span>
          <span className="qh">1 = Strongly disagree · 5 = Strongly agree. Answer at least {MINIMUM_WORK_STATEMENTS_RATED}.</span>
          <div style={{ marginTop: 8 }}>
            {list.map((o) => (
              <RateRow key={o.key} label={o.label} value={a.work[o.key]} labels={RATING_SCALE_LABELS} onRate={(v) => update((p) => ({ ...p, work: { ...p.work, [o.key]: v } }))} />
            ))}
          </div>
          {!showAllWork ? (
            <button type="button" className="btn-link more" onClick={onShowAllWork}>
              Show all {O.work.length} statements
            </button>
          ) : null}
          <span className="note-line">Statements you skip are saved as Neutral (3).</span>
        </div>
      );
    }
    case "priorities":
      return (
        <>
          <div className="q">
            <span className="ql">How much does each of these matter in your future career?</span>
            <span className="qh">1 = Not important · 5 = Essential</span>
            <div style={{ marginTop: 8 }}>
              {O.priorities.map((o) => (
                <RateRow key={o.key} label={o.label} value={a.priorities[o.key]} labels={PRIORITY_LABELS} showValue={false} onRate={(v) => update((p) => ({ ...p, priorities: { ...p.priorities, [o.key]: v } }))} />
              ))}
            </div>
            <Count n={Object.keys(a.priorities).length} min={MINIMUM_PRIORITIES_RATED} noun="rated" />
          </div>
          <Radios id="q-clarity" label="Do you know what career you want?" options={O.clarity} value={a.goals.clarity} onChange={(v) => update((p) => ({ ...p, goals: { ...p.goals, clarity: v } }))} />
          {a.goals.clarity === "clear" ? (
            <div className="q">
              <label className="ql" htmlFor="ci-dream">
                Which career do you have in mind?
              </label>
              <input
                id="ci-dream"
                className="textin"
                maxLength={120}
                placeholder="For example: robotics engineer"
                value={a.goals.dreamJobTitle ?? ""}
                onChange={(e) => update((p) => ({ ...p, goals: { ...p.goals, dreamJobTitle: e.target.value || null } }))}
              />
            </div>
          ) : null}
          {a.goals.clarity === "some_ideas" ? (
            <div className="q">
              <span className="ql" id="ci-ideas">
                Which careers are you considering?
              </span>
              <span className="qh">Add up to 3. One is enough.</span>
              <div className="ideas" role="group" aria-labelledby="ci-ideas">
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    className="textin"
                    maxLength={120}
                    aria-label={`Career idea ${i + 1}`}
                    placeholder={i === 0 ? "For example: data scientist" : "Another idea (optional)"}
                    value={a.goals.careerIdeas[i] ?? ""}
                    onChange={(e) =>
                      update((p) => {
                        const ideas = [0, 1, 2].map((j) => (j === i ? e.target.value : (p.goals.careerIdeas[j] ?? "")));
                        while (ideas.length > 0 && !ideas[ideas.length - 1].trim()) ideas.pop();
                        return { ...p, goals: { ...p.goals, careerIdeas: ideas } };
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      );
    case "study":
      return (
        <>
          <Radios id="s1" label="Do you plan to study further?" options={O.yesNoMaybe} value={a.study.studyFurther} onChange={(v) => update((p) => ({ ...p, study: { ...p.study, studyFurther: v } }))} />
          <Radios id="s2" label="Would you consider studying abroad?" options={O.yesNoMaybe} value={a.study.studyAbroad} onChange={(v) => update((p) => ({ ...p, study: { ...p.study, studyAbroad: v } }))} />
          <Radios id="s3" label="Are you open to relocating within India?" options={O.yesNoMaybe} value={a.study.relocateWithinIndia} onChange={(v) => update((p) => ({ ...p, study: { ...p.study, relocateWithinIndia: v } }))} />
          <Radios id="s4" label="Are you open to moving to another country?" options={O.yesNoMaybe} value={a.study.relocateInternational} onChange={(v) => update((p) => ({ ...p, study: { ...p.study, relocateInternational: v } }))} />
          <div className="q">
            <span className="ql">
              Countries you are curious about <span style={{ fontWeight: 500, color: "var(--muted)" }}>(optional)</span>
            </span>
            <Chips
              options={O.countries}
              selected={(k) => a.study.destinations.includes(k)}
              onToggle={(k) =>
                update((p) => ({ ...p, study: { ...p.study, destinations: p.study.destinations.includes(k) ? p.study.destinations.filter((d) => d !== k) : [...p.study.destinations, k] } }))
              }
            />
          </div>
        </>
      );
    case "plans":
      return (
        <>
          <Radios id="b1" label="Total budget for your next stage of study" options={O.budget} value={a.plans.budgetBand} onChange={(v) => update((p) => ({ ...p, plans: { ...p.plans, budgetBand: v } }))} />
          <Radios id="b2" label="How do you expect to fund it?" options={O.funding} value={a.plans.fundingSource} onChange={(v) => update((p) => ({ ...p, plans: { ...p.plans, fundingSource: v } }))} />
          <Radios id="b3" label="Open to an education loan?" options={O.loan} value={a.plans.loanOpenness} onChange={(v) => update((p) => ({ ...p, plans: { ...p.plans, loanOpenness: v } }))} />
        </>
      );
  }
}
