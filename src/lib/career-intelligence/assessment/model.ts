/**
 * Career Intelligence V2 — the free assessment's data model.
 *
 * The assessment is the existing Student Digital Profile, regrouped into the
 * eight short sections of the approved design. Nothing here invents a new
 * question bank or a new score: every option comes from
 * src/data/profile-options.ts, every minimum from src/lib/profile/completion.ts,
 * and a signed-in student's answers are saved through the existing
 * student-profile Server Actions (see src/app/(site)/career/actions.ts).
 *
 * Pure and isomorphic: used in the browser (guest progress, validation) and
 * on the server (re-validation of anything the browser sends, the guest
 * teaser, the transfer of guest answers into a new account).
 *
 * What a guest's browser stores is only these answers. About You (date of
 * birth, gender, city, language) is deliberately not part of the assessment,
 * so no personal identifier is ever written to browser storage.
 */
import {
  BUDGET_BAND_OPTIONS,
  CAREER_GOAL_CLARITY_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENT_STATUS_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  EDUCATION_STATUS_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  INTEREST_OPTIONS,
  LOAN_OPENNESS_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  SUBJECT_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  YES_NO_MAYBE_OPTIONS,
  type OptionDef,
} from "@/data/profile-options";
import {
  MINIMUM_INTERESTS_SELECTED,
  MINIMUM_PRIORITIES_RATED,
  MINIMUM_SKILLS_SELECTED,
  MINIMUM_SUBJECTS_RATED,
} from "@/lib/profile/completion";
import { PROFILE_TEXT_LIMITS } from "@/lib/profile/input-limits";
import type { StudentProfileSnapshot } from "@/types/student-profile";

export type AssessmentSectionKey = "education" | "subjects" | "interests" | "skills" | "work" | "priorities" | "study" | "plans";

export interface AssessmentSection {
  key: AssessmentSectionKey;
  /** Heading on the question card. */
  title: string;
  /** Short name in the section list, the entry card and the completion screen. */
  rail: string;
  /** One line under the heading. */
  why: string;
}

export const ASSESSMENT_SECTIONS: readonly AssessmentSection[] = [
  { key: "education", title: "Education and background", rail: "Education", why: "Where you are now. This tells us which routes are realistic for you next." },
  { key: "subjects", title: "Academic strengths", rail: "Subject strengths", why: "Rate at least 3 subjects you have studied. Be honest; there are no right answers." },
  { key: "interests", title: "Interests and activities", rail: "Interests", why: "Pick at least 3 things you genuinely enjoy reading about, building or doing." },
  { key: "skills", title: "Skills and competencies", rail: "Skills", why: "Choose at least 2. Beginner is fine; this is about where you are today." },
  { key: "work", title: "How you like to work", rail: "Work style", why: "How much do you agree with each statement?" },
  { key: "priorities", title: "Ambitions and priorities", rail: "Priorities and goals", why: "Rate at least 5 priorities, then tell us how clear your goal feels." },
  { key: "study", title: "Study and location preferences", rail: "Study and location", why: "Where and how you would like to study next." },
  { key: "plans", title: "Budget and future plans", rail: "Budget and plans", why: "Constraints are part of a good plan. This stays private to you." },
];

export const ASSESSMENT_SECTION_COUNT = ASSESSMENT_SECTIONS.length;

/** Statements a student must rate before Work style counts as answered; the rest are saved as Neutral (3), exactly as the profile wizard does. */
export const MINIMUM_WORK_STATEMENTS_RATED = 4;

/** Quick picks for the optional stream question. Saved as the education record's free-text field of study. */
export const STREAM_OPTIONS: OptionDef[] = [
  { key: "Science (PCM)", label: "Science (PCM)" },
  { key: "Science (PCB)", label: "Science (PCB)" },
  { key: "Commerce", label: "Commerce" },
  { key: "Humanities / Arts", label: "Humanities / Arts" },
];

export interface AssessmentAnswers {
  education: {
    currentStatus: string | null;
    educationLevel: string | null;
    educationStatus: string | null;
    fieldOfStudy: string | null;
  };
  subjects: Record<string, number>;
  interests: Record<string, number>;
  skills: Record<string, string>;
  work: Record<string, number>;
  priorities: Record<string, number>;
  goals: { clarity: string | null; dreamJobTitle: string | null; careerIdeas: string[] };
  study: {
    studyFurther: string | null;
    studyAbroad: string | null;
    relocateWithinIndia: string | null;
    relocateInternational: string | null;
    destinations: string[];
  };
  plans: { budgetBand: string | null; fundingSource: string | null; loanOpenness: string | null };
}

export function emptyAnswers(): AssessmentAnswers {
  return {
    education: { currentStatus: null, educationLevel: null, educationStatus: null, fieldOfStudy: null },
    subjects: {},
    interests: {},
    skills: {},
    work: {},
    priorities: {},
    goals: { clarity: null, dreamJobTitle: null, careerIdeas: [] },
    study: { studyFurther: null, studyAbroad: null, relocateWithinIndia: null, relocateInternational: null, destinations: [] },
    plans: { budgetBand: null, fundingSource: null, loanOpenness: null },
  };
}

// ---------------------------------------------------------------------------
// Options shown in the assessment ("other" needs free text, which the profile
// keeps; the assessment leaves it alone rather than collect more text).
// ---------------------------------------------------------------------------
const withoutOther = (options: OptionDef[]) => options.filter((o) => o.key !== "other");
export const ASSESSMENT_OPTIONS = {
  currentStatus: withoutOther(CURRENT_STATUS_OPTIONS),
  educationLevel: withoutOther(EDUCATION_LEVEL_OPTIONS),
  educationStatus: EDUCATION_STATUS_OPTIONS.filter((o) => o.key !== "discontinued"),
  subjects: withoutOther(SUBJECT_OPTIONS),
  interests: withoutOther(INTEREST_OPTIONS),
  technicalSkills: TECHNICAL_SKILL_OPTIONS,
  transferableSkills: TRANSFERABLE_SKILL_OPTIONS,
  skillLevels: SKILL_LEVEL_OPTIONS,
  work: WORK_PREFERENCE_OPTIONS,
  priorities: CAREER_PRIORITY_OPTIONS,
  clarity: CAREER_GOAL_CLARITY_OPTIONS,
  yesNoMaybe: YES_NO_MAYBE_OPTIONS,
  countries: withoutOther(COUNTRY_OPTIONS),
  budget: BUDGET_BAND_OPTIONS,
  funding: FUNDING_SOURCE_OPTIONS,
  loan: LOAN_OPENNESS_OPTIONS,
} as const;

const keySet = (...lists: OptionDef[][]) => new Set(lists.flat().map((o) => o.key));
const VALID = {
  currentStatus: keySet(CURRENT_STATUS_OPTIONS),
  educationLevel: keySet(EDUCATION_LEVEL_OPTIONS),
  educationStatus: keySet(EDUCATION_STATUS_OPTIONS),
  subjects: keySet(ASSESSMENT_OPTIONS.subjects),
  interests: keySet(ASSESSMENT_OPTIONS.interests),
  skills: keySet(TECHNICAL_SKILL_OPTIONS, TRANSFERABLE_SKILL_OPTIONS),
  skillLevels: keySet(SKILL_LEVEL_OPTIONS),
  work: keySet(WORK_PREFERENCE_OPTIONS),
  priorities: keySet(CAREER_PRIORITY_OPTIONS),
  clarity: keySet(CAREER_GOAL_CLARITY_OPTIONS),
  yesNoMaybe: keySet(YES_NO_MAYBE_OPTIONS),
  countries: keySet(ASSESSMENT_OPTIONS.countries),
  budget: keySet(BUDGET_BAND_OPTIONS),
  funding: keySet(FUNDING_SOURCE_OPTIONS),
};

// ---------------------------------------------------------------------------
// Sanitising: anything read from browser storage or received by a Server
// Action passes through here. Unknown keys are dropped, ratings are clamped
// to whole numbers 1-5, text is trimmed to the profile's own length limits.
// ---------------------------------------------------------------------------
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const pick = (v: unknown, valid: Set<string>): string | null => (typeof v === "string" && valid.has(v) ? v : null);
const rating = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return t ? t.slice(0, max) : null;
};
function ratings(v: unknown, valid: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [k, raw] of Object.entries(v)) {
    const r = rating(raw);
    if (valid.has(k) && r !== null) out[k] = r;
  }
  return out;
}

export function sanitizeAnswers(input: unknown): AssessmentAnswers {
  const a = emptyAnswers();
  if (!isRecord(input)) return a;
  const edu = isRecord(input.education) ? input.education : {};
  a.education = {
    currentStatus: pick(edu.currentStatus, VALID.currentStatus),
    educationLevel: pick(edu.educationLevel, VALID.educationLevel),
    educationStatus: pick(edu.educationStatus, VALID.educationStatus),
    fieldOfStudy: text(edu.fieldOfStudy, PROFILE_TEXT_LIMITS.fieldOfStudy),
  };
  a.subjects = ratings(input.subjects, VALID.subjects);
  a.interests = ratings(input.interests, VALID.interests);
  if (isRecord(input.skills)) {
    for (const [k, level] of Object.entries(input.skills)) {
      const l = pick(level, VALID.skillLevels);
      if (VALID.skills.has(k) && l) a.skills[k] = l;
    }
  }
  a.work = ratings(input.work, VALID.work);
  a.priorities = ratings(input.priorities, VALID.priorities);
  const goals = isRecord(input.goals) ? input.goals : {};
  a.goals = {
    clarity: pick(goals.clarity, VALID.clarity),
    dreamJobTitle: text(goals.dreamJobTitle, PROFILE_TEXT_LIMITS.dreamJobTitle),
    careerIdeas: (Array.isArray(goals.careerIdeas) ? goals.careerIdeas : [])
      .map((idea) => text(idea, PROFILE_TEXT_LIMITS.careerIdea))
      .filter((idea): idea is string => Boolean(idea))
      .slice(0, 3),
  };
  const study = isRecord(input.study) ? input.study : {};
  a.study = {
    studyFurther: pick(study.studyFurther, VALID.yesNoMaybe),
    studyAbroad: pick(study.studyAbroad, VALID.yesNoMaybe),
    relocateWithinIndia: pick(study.relocateWithinIndia, VALID.yesNoMaybe),
    relocateInternational: pick(study.relocateInternational, VALID.yesNoMaybe),
    destinations: [...new Set((Array.isArray(study.destinations) ? study.destinations : []).filter((d): d is string => typeof d === "string" && VALID.countries.has(d)))],
  };
  const plans = isRecord(input.plans) ? input.plans : {};
  a.plans = {
    budgetBand: pick(plans.budgetBand, VALID.budget),
    fundingSource: pick(plans.fundingSource, VALID.funding),
    loanOpenness: pick(plans.loanOpenness, VALID.yesNoMaybe),
  };
  return a;
}

// ---------------------------------------------------------------------------
// Validation: only what genuinely needs an answer. Optional questions
// (stream, destinations, dream job unless the goal is "clear") never block.
// Minimums are the profile's own; the messages count up so a student can see
// how far they are.
// ---------------------------------------------------------------------------
export interface SectionCheck {
  ok: boolean;
  message: string | null;
}
const ok: SectionCheck = { ok: true, message: null };
const fail = (message: string): SectionCheck => ({ ok: false, message });
const count = (o: Record<string, unknown>) => Object.keys(o).length;

export function checkSection(key: AssessmentSectionKey, a: AssessmentAnswers): SectionCheck {
  switch (key) {
    case "education":
      if (!a.education.currentStatus) return fail("Choose what best describes you right now.");
      if (!a.education.educationLevel) return fail("Choose your highest education level.");
      if (!a.education.educationStatus) return fail("Tell us whether you are still studying at that level or have completed it.");
      return ok;
    case "subjects":
      return count(a.subjects) >= MINIMUM_SUBJECTS_RATED ? ok : fail(`Rate at least ${MINIMUM_SUBJECTS_RATED} subjects (${count(a.subjects)} of ${MINIMUM_SUBJECTS_RATED} so far).`);
    case "interests":
      return count(a.interests) >= MINIMUM_INTERESTS_SELECTED ? ok : fail(`Choose at least ${MINIMUM_INTERESTS_SELECTED} interests (${count(a.interests)} of ${MINIMUM_INTERESTS_SELECTED} so far).`);
    case "skills":
      return count(a.skills) >= MINIMUM_SKILLS_SELECTED ? ok : fail(`Choose at least ${MINIMUM_SKILLS_SELECTED} skills (${count(a.skills)} of ${MINIMUM_SKILLS_SELECTED} so far).`);
    case "work":
      return count(a.work) >= MINIMUM_WORK_STATEMENTS_RATED ? ok : fail(`Answer at least ${MINIMUM_WORK_STATEMENTS_RATED} statements (${count(a.work)} of ${MINIMUM_WORK_STATEMENTS_RATED} so far).`);
    case "priorities":
      if (count(a.priorities) < MINIMUM_PRIORITIES_RATED) return fail(`Rate at least ${MINIMUM_PRIORITIES_RATED} priorities (${count(a.priorities)} of ${MINIMUM_PRIORITIES_RATED} so far).`);
      if (!a.goals.clarity) return fail("Tell us how clear your career goal feels.");
      if (a.goals.clarity === "clear" && !a.goals.dreamJobTitle) return fail("Add the career you have in mind, or choose a different answer.");
      if (a.goals.clarity === "some_ideas" && !a.goals.careerIdeas.some((idea) => idea.trim())) return fail("Add at least one career idea, or choose a different answer.");
      return ok;
    case "study":
      if (!a.study.studyFurther || !a.study.studyAbroad || !a.study.relocateWithinIndia || !a.study.relocateInternational) {
        return fail("Answer the four questions about studying further, studying abroad and relocating.");
      }
      return ok;
    case "plans":
      if (!a.plans.budgetBand) return fail("Choose a budget range (“Not sure” is fine).");
      if (!a.plans.fundingSource) return fail("Choose how you expect to fund it (“Not sure” is fine).");
      if (!a.plans.loanOpenness) return fail("Tell us whether you are open to an education loan.");
      return ok;
  }
}

export function completedSectionKeys(a: AssessmentAnswers): AssessmentSectionKey[] {
  return ASSESSMENT_SECTIONS.filter((s) => checkSection(s.key, a).ok).map((s) => s.key);
}

export function isAssessmentComplete(a: AssessmentAnswers): boolean {
  return completedSectionKeys(a).length === ASSESSMENT_SECTION_COUNT;
}

/** First section that still needs answers, or the last section when everything is answered. */
export function firstOpenSectionIndex(a: AssessmentAnswers): number {
  const i = ASSESSMENT_SECTIONS.findIndex((s) => !checkSection(s.key, a).ok);
  return i === -1 ? ASSESSMENT_SECTION_COUNT - 1 : i;
}

export function hasAnyAnswer(a: AssessmentAnswers): boolean {
  return ASSESSMENT_SECTIONS.some((s) => sectionHasAnswers(s.key, a));
}

export function sectionHasAnswers(key: AssessmentSectionKey, a: AssessmentAnswers): boolean {
  switch (key) {
    case "education":
      return Boolean(a.education.currentStatus || a.education.educationLevel || a.education.educationStatus || a.education.fieldOfStudy);
    case "subjects":
      return count(a.subjects) > 0;
    case "interests":
      return count(a.interests) > 0;
    case "skills":
      return count(a.skills) > 0;
    case "work":
      return count(a.work) > 0;
    case "priorities":
      return count(a.priorities) > 0 || Boolean(a.goals.clarity);
    case "study":
      return Boolean(a.study.studyFurther || a.study.studyAbroad || a.study.relocateWithinIndia || a.study.relocateInternational || a.study.destinations.length);
    case "plans":
      return Boolean(a.plans.budgetBand || a.plans.fundingSource || a.plans.loanOpenness);
  }
}

/**
 * The transfer rule for answers given before signing in, per section:
 * the account wins. A section the account has already answered is kept as it
 * is (so an older browser copy never overwrites newer saved answers); only
 * sections the account has not answered are filled from the browser.
 * Deterministic: the same inputs always give the same plan.
 */
export function planGuestTransfer(account: AssessmentAnswers, guest: AssessmentAnswers): { transfer: AssessmentSectionKey[]; keep: AssessmentSectionKey[] } {
  const transfer: AssessmentSectionKey[] = [];
  const keep: AssessmentSectionKey[] = [];
  for (const { key } of ASSESSMENT_SECTIONS) {
    if (sectionHasAnswers(key, account)) keep.push(key);
    else if (sectionHasAnswers(key, guest)) transfer.push(key);
  }
  return { transfer, keep };
}

// ---------------------------------------------------------------------------
// Profile snapshot <-> assessment answers.
// ---------------------------------------------------------------------------

/** The education record the assessment reads and edits: the one still in progress, else the most recent. Other records are left untouched. */
export function primaryEducationIndex(snapshot: StudentProfileSnapshot): number {
  if (snapshot.education.length === 0) return -1;
  const ongoing = snapshot.education.findIndex((r) => r.status === "ongoing");
  if (ongoing !== -1) return ongoing;
  let best = 0;
  snapshot.education.forEach((r, i) => {
    if ((r.endYear ?? 0) > (snapshot.education[best].endYear ?? 0)) best = i;
  });
  return best;
}

export function answersFromSnapshot(snapshot: StudentProfileSnapshot): AssessmentAnswers {
  const primary = snapshot.education[primaryEducationIndex(snapshot)];
  return sanitizeAnswers({
    education: {
      currentStatus: snapshot.profile.currentStatus,
      educationLevel: primary?.educationLevel ?? null,
      educationStatus: primary?.status ?? null,
      fieldOfStudy: primary?.fieldOfStudy ?? null,
    },
    subjects: Object.fromEntries(snapshot.subjectStrengths.map((s) => [s.subjectKey, s.rating])),
    interests: Object.fromEntries(snapshot.interests.map((i) => [i.interestKey, i.strength ?? 3])),
    skills: Object.fromEntries(snapshot.skills.map((s) => [s.skillKey, s.level])),
    work: Object.fromEntries(snapshot.workPreferences.map((w) => [w.preferenceKey, w.rating])),
    priorities: Object.fromEntries(snapshot.careerPriorities.map((p) => [p.priorityKey, p.rating])),
    goals: {
      clarity: snapshot.careerGoals?.clarity ?? null,
      dreamJobTitle: snapshot.careerGoals?.dreamJobTitle ?? null,
      careerIdeas: snapshot.careerGoals?.careerIdeas ?? [],
    },
    study: {
      studyFurther: snapshot.studyPreferences?.studyFurther ?? null,
      studyAbroad: snapshot.studyPreferences?.studyAbroad ?? null,
      relocateWithinIndia: snapshot.studyPreferences?.relocateWithinIndia ?? null,
      relocateInternational: snapshot.studyPreferences?.relocateInternational ?? null,
      destinations: snapshot.studyPreferences?.preferredStudyDestinations ?? [],
    },
    plans: {
      budgetBand: snapshot.fundingPreferences?.budgetBand ?? null,
      fundingSource: snapshot.fundingPreferences?.fundingSource ?? null,
      loanOpenness: snapshot.fundingPreferences?.loanOpenness ?? null,
    },
  });
}

/**
 * A profile snapshot built from guest answers, for the server-side teaser
 * only. It is never saved and carries no user id. Interests the student
 * picked count as "Interested" (3), the same neutral strength the profile
 * gives a chip that was selected without a rating.
 */
export function snapshotFromAnswers(a: AssessmentAnswers): StudentProfileSnapshot {
  return {
    profile: {
      userId: "",
      dateOfBirth: null,
      gender: null,
      city: null,
      state: null,
      country: "India",
      preferredLanguage: null,
      currentStatus: a.education.currentStatus as StudentProfileSnapshot["profile"]["currentStatus"],
      profileStatus: "in_progress",
      profileCompletionPercent: 0,
      onboardingCurrentStep: 1,
    },
    education: a.education.educationLevel
      ? [
          {
            id: "assessment",
            educationLevel: a.education.educationLevel as StudentProfileSnapshot["education"][number]["educationLevel"],
            institutionName: null,
            boardOrUniversity: null,
            fieldOfStudy: a.education.fieldOfStudy,
            specialization: null,
            startYear: null,
            endYear: null,
            status: (a.education.educationStatus ?? "ongoing") as StudentProfileSnapshot["education"][number]["status"],
            scoreType: null,
            scoreValue: null,
            backlogs: null,
          },
        ]
      : [],
    subjectStrengths: Object.entries(a.subjects).map(([subjectKey, r]) => ({ subjectKey, rating: r })),
    interests: Object.entries(a.interests).map(([interestKey, strength]) => ({ interestKey, strength, otherText: null })),
    skills: Object.entries(a.skills).map(([skillKey, level]) => ({ skillKey, level: level as StudentProfileSnapshot["skills"][number]["level"] })),
    workPreferences: Object.entries(withNeutralWork(a.work)).map(([preferenceKey, r]) => ({ preferenceKey, rating: r })),
    careerPriorities: Object.entries(a.priorities).map(([priorityKey, r]) => ({ priorityKey, rating: r })),
    careerGoals: {
      clarity: a.goals.clarity as NonNullable<StudentProfileSnapshot["careerGoals"]>["clarity"],
      dreamJobTitle: a.goals.dreamJobTitle,
      dreamIndustry: null,
      dreamReason: null,
      careerIdeas: a.goals.careerIdeas,
      lifeGoalsText: null,
    },
    studyPreferences: {
      studyFurther: a.study.studyFurther as NonNullable<StudentProfileSnapshot["studyPreferences"]>["studyFurther"],
      studyAbroad: a.study.studyAbroad as NonNullable<StudentProfileSnapshot["studyPreferences"]>["studyAbroad"],
      preferredStudyDestinations: a.study.destinations,
      preferredWorkDestinations: [],
      relocateWithinIndia: a.study.relocateWithinIndia as NonNullable<StudentProfileSnapshot["studyPreferences"]>["relocateWithinIndia"],
      relocateInternational: a.study.relocateInternational as NonNullable<StudentProfileSnapshot["studyPreferences"]>["relocateInternational"],
    },
    fundingPreferences: {
      budgetBand: a.plans.budgetBand as NonNullable<StudentProfileSnapshot["fundingPreferences"]>["budgetBand"],
      fundingSource: a.plans.fundingSource as NonNullable<StudentProfileSnapshot["fundingPreferences"]>["fundingSource"],
      loanOpenness: a.plans.loanOpenness as NonNullable<StudentProfileSnapshot["fundingPreferences"]>["loanOpenness"],
    },
    experience: [],
  };
}

/** Every statement the student skipped is saved as Neutral (3), as the profile wizard's own backfill does. */
export function withNeutralWork(work: Record<string, number>): Record<string, number> {
  const next = { ...work };
  for (const option of WORK_PREFERENCE_OPTIONS) if (!(option.key in next)) next[option.key] = 3;
  return next;
}
