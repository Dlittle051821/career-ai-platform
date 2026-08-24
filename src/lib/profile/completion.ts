import type { CompletionResult, CompletionSection, StudentProfileSnapshot } from "@/types/student-profile";
import { WORK_PREFERENCE_OPTIONS } from "@/data/profile-options";

/**
 * Weighted profile-completion calculator (Milestone 3, section 18).
 *
 * Deliberately a plain, pure, dependency-free function rather than a
 * database function: it's called from several places (server actions
 * after every save, the dashboard card, the /profile page) and keeping it
 * in application code makes the weighting/thresholds easy to see, test,
 * and adjust as the Career Recommendation Engine's real requirements
 * become clearer in a later milestone — without a SQL migration each time.
 *
 * Each section is "complete" based on actual saved data meeting a
 * meaningful minimum (see the threshold comments below), never just "the
 * screen was opened." Experience is intentionally excluded — it's
 * optional and must never block completion.
 */

const MINIMUM_SUBJECTS_RATED = 3;
const MINIMUM_INTERESTS_SELECTED = 3;
const MINIMUM_SKILLS_SELECTED = 2;
const MINIMUM_PRIORITIES_RATED = 5;

export function calculateCompletion(snapshot: StudentProfileSnapshot): CompletionResult {
  const sections: CompletionSection[] = [
    {
      key: "about_you",
      label: "About You",
      weight: 10,
      required: true,
      complete: Boolean(snapshot.profile.currentStatus),
    },
    {
      key: "education",
      label: "Education",
      weight: 15,
      required: true,
      complete: snapshot.education.length >= 1,
    },
    {
      key: "subject_strengths",
      label: "Subject Strengths",
      weight: 10,
      required: true,
      complete: snapshot.subjectStrengths.length >= MINIMUM_SUBJECTS_RATED,
    },
    {
      key: "interests",
      label: "Interests",
      weight: 15,
      required: true,
      complete: snapshot.interests.length >= MINIMUM_INTERESTS_SELECTED,
    },
    {
      key: "skills",
      label: "Skills",
      weight: 10,
      required: true,
      complete: snapshot.skills.length >= MINIMUM_SKILLS_SELECTED,
    },
    {
      key: "work_preferences",
      label: "Work Preferences",
      weight: 15,
      required: true,
      complete: snapshot.workPreferences.length >= WORK_PREFERENCE_OPTIONS.length,
    },
    {
      key: "career_priorities",
      label: "Career Priorities",
      weight: 10,
      required: true,
      complete: snapshot.careerPriorities.length >= MINIMUM_PRIORITIES_RATED,
    },
    {
      key: "career_goals",
      label: "Career Goals",
      weight: 5,
      required: true,
      complete: isCareerGoalsComplete(snapshot),
    },
    {
      key: "study_location",
      label: "Study & Location",
      weight: 5,
      required: true,
      complete: isStudyPreferencesComplete(snapshot),
    },
    {
      key: "budget_funding",
      label: "Budget & Funding",
      weight: 5,
      required: true,
      complete: isFundingPreferencesComplete(snapshot),
    },
    {
      key: "experience",
      label: "Experience",
      weight: 0,
      required: false,
      complete: snapshot.experience.length > 0,
    },
  ];

  const requiredSections = sections.filter((s) => s.required);
  const percent = Math.round(
    requiredSections.reduce((sum, s) => sum + (s.complete ? s.weight : 0), 0)
  );

  const anyDataEntered =
    percent > 0 ||
    snapshot.education.length > 0 ||
    snapshot.subjectStrengths.length > 0 ||
    snapshot.interests.length > 0 ||
    snapshot.skills.length > 0 ||
    snapshot.workPreferences.length > 0 ||
    snapshot.careerPriorities.length > 0;

  const status = requiredSections.every((s) => s.complete)
    ? "completed"
    : anyDataEntered
      ? "in_progress"
      : "not_started";

  return { percent, status, sections };
}

function isCareerGoalsComplete(snapshot: StudentProfileSnapshot): boolean {
  const goals = snapshot.careerGoals;
  if (!goals?.clarity) return false;
  if (goals.clarity === "clear") return Boolean(goals.dreamJobTitle?.trim());
  if (goals.clarity === "some_ideas") return goals.careerIdeas.length >= 1;
  return true; // "not_sure" needs nothing further
}

function isStudyPreferencesComplete(snapshot: StudentProfileSnapshot): boolean {
  const prefs = snapshot.studyPreferences;
  if (!prefs) return false;
  return Boolean(
    prefs.studyFurther && prefs.studyAbroad && prefs.relocateWithinIndia && prefs.relocateInternational
  );
}

function isFundingPreferencesComplete(snapshot: StudentProfileSnapshot): boolean {
  const funding = snapshot.fundingPreferences;
  if (!funding) return false;
  return Boolean(funding.budgetBand && funding.fundingSource && funding.loanOpenness);
}
