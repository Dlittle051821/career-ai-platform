import type { CompletionResult } from "@/types/student-profile";
import type { OnboardingDraftState } from "@/components/sections/profile/onboarding/onboarding-types";
import {
  MINIMUM_INTERESTS_SELECTED,
  MINIMUM_PRIORITIES_RATED,
  MINIMUM_SKILLS_SELECTED,
  MINIMUM_SUBJECTS_RATED,
} from "./completion";
import { WORK_PREFERENCE_OPTIONS } from "@/data/profile-options";

/**
 * UX10-P01 — "Profile Readiness" (the new `/profile` page's right-column
 * card) wants a per-section PROGRESS bar, not just a pass/fail tick. The
 * reference mockup shows varied percentages (100% / 70% / 40% / 20% / 0% /
 * 0% / 10%) — the brief is explicit those example numbers are illustrative
 * only and must be replaced with a real calculation, never hardcoded.
 *
 * `calculateCompletion()` (src/lib/profile/completion.ts) only tracks a
 * boolean `complete` per section — exactly right for the weighted overall
 * percent and for "is the student done with this", but it throws away how
 * CLOSE an in-progress section is. This module adds that granularity on
 * top, without touching or duplicating calculateCompletion()'s own
 * pass/fail logic or weights: every ratio below is built from the same
 * real stored counts, divided by the SAME real thresholds
 * calculateCompletion() itself uses (imported, not re-typed), for the five
 * sections that have a natural "N of M" shape. The remaining sections
 * (about_you, education, career_goals, experience) have no such intrinsic
 * count — calculateCompletion()'s own complete flag is already the
 * honest, fully real answer for those, so this just mirrors it as 0/100.
 *
 * This NEVER changes what counts as "complete" anywhere else in the app —
 * `completion.sections[i].complete` (used for the overall ring percent,
 * the dashboard checklist, recommendation readiness, etc.) is completely
 * untouched. This is a presentational refinement for one card only.
 *
 * Reads from the wizard's live in-memory `OnboardingDraftState` (not a
 * freshly-fetched `StudentProfileSnapshot`) so the Profile Readiness card
 * updates immediately as the student edits/saves, in step with
 * `completion` (also live draft-derived state) — never a stale snapshot
 * that would drift from the completion ring right after a save.
 */
export interface SectionProgress {
  key: string;
  label: string;
  /** 0-100, real and granular where the section has a natural count, otherwise the same 0/100 as `complete`. */
  percent: number;
  complete: boolean;
}

function fieldFillRatio(fields: (string | null)[]): number {
  const filled = fields.filter((f) => f !== null && f !== "").length;
  return fields.length > 0 ? filled / fields.length : 0;
}

export function computeSectionProgress(draft: OnboardingDraftState, completion: CompletionResult): SectionProgress[] {
  const ratioFor: Partial<Record<string, number>> = {
    subject_strengths: Math.min(1, Object.keys(draft.subjectStrengths).length / MINIMUM_SUBJECTS_RATED),
    interests: Math.min(1, Object.keys(draft.interests).length / MINIMUM_INTERESTS_SELECTED),
    skills: Math.min(1, Object.keys(draft.skills).length / MINIMUM_SKILLS_SELECTED),
    work_preferences: Math.min(1, Object.keys(draft.workPreferences).length / WORK_PREFERENCE_OPTIONS.length),
    career_priorities: Math.min(1, Object.keys(draft.careerPriorities).length / MINIMUM_PRIORITIES_RATED),
    study_location: fieldFillRatio([
      draft.studyPreferences.studyFurther,
      draft.studyPreferences.studyAbroad,
      draft.studyPreferences.relocateWithinIndia,
      draft.studyPreferences.relocateInternational,
    ]),
    budget_funding: fieldFillRatio([
      draft.fundingPreferences.budgetBand,
      draft.fundingPreferences.fundingSource,
      draft.fundingPreferences.loanOpenness,
    ]),
  };

  return completion.sections.map((section) => {
    const ratio = ratioFor[section.key];
    const percent = ratio !== undefined ? Math.round(ratio * 100) : section.complete ? 100 : 0;
    return { key: section.key, label: section.label, percent, complete: section.complete };
  });
}
