import { CAREER_PRIORITY_OPTIONS, INTEREST_OPTIONS, SUBJECT_OPTIONS, labelFor } from "@/data/profile-options";
import type { AssessmentAnswers } from "./model";

export interface Glance {
  subjects: string[];
  interests: string[];
  priorities: string[];
}

/** The preview's "From your answers" line: the student's own strongest answers — their input, not a result. */
export function glanceFromAnswers(a: AssessmentAnswers): Glance {
  const top = (r: Record<string, number>, n: number) =>
    Object.entries(r)
      .sort((x, y) => y[1] - x[1])
      .slice(0, n)
      .map(([k]) => k);
  return {
    subjects: top(a.subjects, 2).map((k) => labelFor(SUBJECT_OPTIONS, k)),
    interests: top(a.interests, 3).map((k) => labelFor(INTEREST_OPTIONS, k)),
    priorities: top(a.priorities, 2).map((k) => labelFor(CAREER_PRIORITY_OPTIONS, k).toLowerCase()),
  };
}
