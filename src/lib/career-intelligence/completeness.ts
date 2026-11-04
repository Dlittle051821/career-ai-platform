import type { StudentProfileSnapshot } from "@/types/student-profile";
import { hasMinimumProfileDataForRecommendations } from "@/lib/recommendations/normalize";

/**
 * NW09 — profile completeness and validation, BEFORE any AI call.
 *
 * Reuses the matching engine's own minimum-data rule
 * (hasMinimumProfileDataForRecommendations: at least three of subjects /
 * interests / skills / work preferences / priorities). Below that, the
 * pipeline stops with follow-up questions — nothing is invented and no
 * provider is called. Above it, softer gaps and conflicts are passed to the
 * analysis (and to the counsellor) as things to verify.
 */
export interface ProfileAssessment {
  ready: boolean;
  missing: string[];
  followUpQuestions: string[];
  /** Soft issues worth a counsellor's attention even when ready. */
  conflicts: string[];
}

const CORE: Array<{ key: keyof StudentProfileSnapshot; label: string; question: string }> = [
  { key: "subjectStrengths", label: "Subject strengths", question: "Which school or college subjects do you find easiest or most enjoyable?" },
  { key: "interests", label: "Interests", question: "What topics or activities do you find yourself drawn to, in or out of school?" },
  { key: "skills", label: "Skills", question: "Which skills have you already practised — for example coding, writing, drawing, organising, or public speaking?" },
  { key: "workPreferences", label: "Work preferences", question: "What kind of working environment suits you — teamwork or independent work, desk-based or hands-on?" },
  { key: "careerPriorities", label: "Career priorities", question: "What matters most to you in a future career — stability, creativity, helping people, income, or something else?" },
];

export function assessProfile(snapshot: StudentProfileSnapshot): ProfileAssessment {
  const missing: string[] = [];
  const followUpQuestions: string[] = [];
  for (const c of CORE) {
    const v = snapshot[c.key];
    if (!Array.isArray(v) || v.length === 0) {
      missing.push(c.label);
      followUpQuestions.push(c.question);
    }
  }
  if (snapshot.education.length === 0) {
    missing.push("Education background");
    followUpQuestions.push("What are you studying now (class or degree, and subject stream)?");
  }
  if (!snapshot.profile.currentStatus) {
    missing.push("Current stage (school, college or working)");
  }

  const conflicts: string[] = [];
  const s = snapshot.studyPreferences;
  const f = snapshot.fundingPreferences;
  if (s?.studyAbroad === "yes" && f?.budgetBand === "below_5l" && f.loanOpenness === "no" && f.fundingSource !== "scholarship_dependent") {
    conflicts.push("Wants to study abroad, but the stated budget is below ₹5 lakh with no openness to loans.");
  }
  if (s?.studyAbroad === "yes" && s.relocateInternational === "no") {
    conflicts.push("Says yes to studying abroad but no to relocating internationally.");
  }
  if (snapshot.careerGoals?.clarity === "clear" && !snapshot.careerGoals.dreamJobTitle && snapshot.careerGoals.careerIdeas.length === 0) {
    conflicts.push("Describes career goals as clear but has not named a role or idea.");
  }
  const strongSubjects = snapshot.subjectStrengths.filter((x) => x.rating >= 4).length;
  const weakSubjects = snapshot.subjectStrengths.filter((x) => x.rating <= 2).length;
  if (snapshot.subjectStrengths.length >= 4 && strongSubjects === 0 && weakSubjects >= 3) {
    conflicts.push("Rates most subjects as weak — strengths may sit outside the academic subjects listed.");
  }

  return { ready: hasMinimumProfileDataForRecommendations(snapshot), missing, followUpQuestions, conflicts };
}
