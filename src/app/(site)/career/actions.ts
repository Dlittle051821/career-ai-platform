"use server";

import {
  saveAboutYou,
  saveCareerGoals,
  saveCareerPriorities,
  saveEducation,
  saveFundingPreferences,
  saveInterests,
  saveSkills,
  saveStudyPreferences,
  saveSubjectStrengths,
  saveWorkPreferences,
  type EducationInput,
  type SaveResult,
} from "@/lib/supabase/student-profile-actions";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_SECTIONS,
  answersFromSnapshot,
  checkSection,
  isAssessmentComplete,
  planGuestTransfer,
  primaryEducationIndex,
  sanitizeAnswers,
  snapshotFromAnswers,
  withNeutralWork,
  type AssessmentAnswers,
  type AssessmentSectionKey,
} from "@/lib/career-intelligence/assessment/model";
import { computeCareerTeaser } from "@/lib/career-intelligence/teaser-server";
import type { CareerTeaser } from "@/lib/career-intelligence/teaser";
import type { StudentProfileSnapshot } from "@/types/student-profile";

/**
 * Career Intelligence V2 — the assessment's Server Actions.
 *
 * Who the student is comes only from the Supabase session read here on the
 * server; nothing the browser sends can name a user. Every save goes
 * through the existing student-profile Server Actions (which re-check the
 * session themselves), so the profile tables, their validation, their
 * row-level security and their completion tracking are exactly what the
 * Student Digital Profile already uses. The assessment covers part of the
 * profile; whatever it does not ask about (date of birth, other education
 * records, an "other" interest's text, dream industry, …) is read back and
 * passed through unchanged, never blanked.
 *
 * Answers are never logged.
 */

const SECTION_KEYS = new Set<string>(ASSESSMENT_SECTIONS.map((s) => s.key));

async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const firstError = (results: SaveResult[]): string | null => results.find((r) => !r.success)?.error ?? (results.every((r) => r.success) ? null : "We couldn't save that just now.");

/** Writes one assessment section for the signed-in student, merged with what their profile already holds. */
async function writeSection(key: AssessmentSectionKey, a: AssessmentAnswers, snapshot: StudentProfileSnapshot): Promise<string | null> {
  switch (key) {
    case "education": {
      const p = snapshot.profile;
      const results: SaveResult[] = [];
      if (a.education.currentStatus) {
        results.push(
          await saveAboutYou({
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
            city: p.city,
            state: p.state,
            country: p.country,
            preferredLanguage: p.preferredLanguage,
            currentStatus: a.education.currentStatus,
          }),
        );
      }
      if (a.education.educationLevel && a.education.educationStatus) {
        const records: EducationInput[] = snapshot.education.map((r) => ({
          educationLevel: r.educationLevel,
          institutionName: r.institutionName,
          boardOrUniversity: r.boardOrUniversity,
          fieldOfStudy: r.fieldOfStudy,
          specialization: r.specialization,
          startYear: r.startYear,
          endYear: r.endYear,
          status: r.status,
          scoreType: r.scoreType,
          scoreValue: r.scoreValue,
          backlogs: r.backlogs,
        }));
        const edited = {
          educationLevel: a.education.educationLevel,
          status: a.education.educationStatus,
          fieldOfStudy: a.education.fieldOfStudy,
        };
        const i = primaryEducationIndex(snapshot);
        if (i === -1) {
          records.push({ institutionName: null, boardOrUniversity: null, specialization: null, startYear: null, endYear: null, scoreType: null, scoreValue: null, backlogs: null, ...edited });
        } else {
          records[i] = { ...records[i], ...edited };
        }
        results.push(await saveEducation(records));
      }
      return firstError(results);
    }
    case "subjects": {
      const keep = snapshot.subjectStrengths.filter((s) => s.subjectKey === "other");
      const items = [...Object.entries(a.subjects).map(([subjectKey, rating]) => ({ subjectKey, rating })), ...keep];
      return firstError([await saveSubjectStrengths(items)]);
    }
    case "interests": {
      const other = snapshot.interests.find((i) => i.interestKey === "other");
      const items = Object.entries(a.interests).map(([interestKey, strength]) => ({ interestKey, strength }));
      if (other) items.push({ interestKey: "other", strength: other.strength ?? 3 });
      return firstError([await saveInterests(items, other?.otherText ?? null)]);
    }
    case "skills":
      return firstError([await saveSkills(Object.entries(a.skills).map(([skillKey, level]) => ({ skillKey, level })))]);
    case "work":
      return firstError([await saveWorkPreferences(Object.entries(withNeutralWork(a.work)).map(([preferenceKey, rating]) => ({ preferenceKey, rating })))]);
    case "priorities": {
      const results: SaveResult[] = [];
      if (Object.keys(a.priorities).length > 0) {
        results.push(await saveCareerPriorities(Object.entries(a.priorities).map(([priorityKey, rating]) => ({ priorityKey, rating }))));
      }
      if (a.goals.clarity) {
        const g = snapshot.careerGoals;
        results.push(
          await saveCareerGoals({
            clarity: a.goals.clarity,
            dreamJobTitle: a.goals.dreamJobTitle,
            dreamIndustry: g?.dreamIndustry ?? null,
            dreamReason: g?.dreamReason ?? null,
            careerIdeas: a.goals.careerIdeas,
            lifeGoalsText: g?.lifeGoalsText ?? null,
          }),
        );
      }
      return firstError(results);
    }
    case "study":
      return firstError([
        await saveStudyPreferences({
          studyFurther: a.study.studyFurther,
          studyAbroad: a.study.studyAbroad,
          relocateWithinIndia: a.study.relocateWithinIndia,
          relocateInternational: a.study.relocateInternational,
          preferredStudyDestinations: a.study.destinations,
          preferredWorkDestinations: snapshot.studyPreferences?.preferredWorkDestinations ?? [],
        }),
      ]);
    case "plans":
      return firstError([
        await saveFundingPreferences({ budgetBand: a.plans.budgetBand, fundingSource: a.plans.fundingSource, loanOpenness: a.plans.loanOpenness }),
      ]);
  }
}

export type SaveSectionResult = { status: "saved" } | { status: "guest" } | { status: "invalid"; message: string } | { status: "error"; message: string };

/**
 * Saves one completed section for a signed-in student. A signed-out visitor
 * gets `guest` back and keeps answering on this device.
 */
export async function saveCareerAssessmentSection(sectionKey: string, rawAnswers: unknown): Promise<SaveSectionResult> {
  if (!SECTION_KEYS.has(sectionKey)) return { status: "invalid", message: "Unknown section." };
  const key = sectionKey as AssessmentSectionKey;
  if (!(await signedInUserId())) return { status: "guest" };
  const answers = sanitizeAnswers(rawAnswers);
  const check = checkSection(key, answers);
  if (!check.ok) return { status: "invalid", message: check.message ?? "Please answer the required questions." };
  try {
    const snapshot = await getStudentProfileSnapshot();
    if (!snapshot) return { status: "error", message: "Your session has ended. Log in again to keep saving." };
    const error = await writeSection(key, answers, snapshot);
    return error ? { status: "error", message: error } : { status: "saved" };
  } catch {
    console.error(`[career-assessment] save failed for section ${key}`);
    return { status: "error", message: "We couldn't save that just now. Your answers are still on this device; try again." };
  }
}

export type ClaimResult =
  | { status: "claimed"; transferred: AssessmentSectionKey[]; kept: AssessmentSectionKey[]; complete: boolean }
  | { status: "guest" }
  | { status: "error"; message: string };

/**
 * Moves answers a student gave before signing in into their own profile.
 *
 * Deterministic and safe to run more than once:
 *  - The account is the session's, never anything the browser names.
 *  - Per section, the account wins. A section that already holds answers on
 *    the account is kept exactly as it is, so an older browser copy can never
 *    overwrite newer saved answers. Only sections the account has not
 *    answered are filled from the browser.
 *  - The profile tables hold one set of rows per student (each save replaces
 *    that student's rows), so a repeat transfer cannot create duplicates; and
 *    because the transferred sections now hold answers, a second run keeps
 *    them and transfers nothing.
 */
export async function claimGuestCareerAssessment(rawAnswers: unknown): Promise<ClaimResult> {
  if (!(await signedInUserId())) return { status: "guest" };
  const guest = sanitizeAnswers(rawAnswers);
  try {
    let snapshot = await getStudentProfileSnapshot();
    if (!snapshot) return { status: "error", message: "Your session has ended. Log in again." };
    const { transfer, keep } = planGuestTransfer(answersFromSnapshot(snapshot), guest);
    const transferred: AssessmentSectionKey[] = [];
    for (const key of transfer) {
      const error = await writeSection(key, guest, snapshot);
      if (error) return { status: "error", message: "We couldn't move all of your answers just now. They are still on this device; try again." };
      transferred.push(key);
      snapshot = (await getStudentProfileSnapshot()) ?? snapshot;
    }
    const kept = keep;
    return { status: "claimed", transferred, kept, complete: isAssessmentComplete(answersFromSnapshot(snapshot)) };
  } catch {
    console.error("[career-assessment] transfer of guest answers failed");
    return { status: "error", message: "We couldn't move your answers just now. They are still on this device; try again." };
  }
}

/**
 * The free teaser for answers that live only in a guest's browser. The
 * answers are re-validated here; an unfinished assessment gets nothing.
 * Returns the teaser contract only (see src/lib/career-intelligence/teaser.ts).
 */
export async function getGuestCareerTeaser(rawAnswers: unknown): Promise<CareerTeaser | null> {
  const answers = sanitizeAnswers(rawAnswers);
  if (!isAssessmentComplete(answers)) return null;
  return computeCareerTeaser(snapshotFromAnswers(answers));
}
