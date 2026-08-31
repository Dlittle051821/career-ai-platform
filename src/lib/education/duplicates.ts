/**
 * Milestone 9 — deterministic duplicate-detection scoring for universities
 * and courses. Pure functions, no DB access: callers (the import pipeline
 * and src/lib/supabase/admin/education-duplicates.ts's scan) pass in plain
 * candidate objects and get back a 0-1 match score plus the individual
 * signals that contributed, for transparent admin review.
 *
 * Deliberately NOT a fuzzy/ML matcher — every signal is an exact match on a
 * normalized value (see src/lib/education/normalize.ts), so a given pair of
 * records always scores identically no matter how many times it's
 * evaluated (spec: deterministic matching). A high score only ever
 * SUGGESTS a duplicate — see education_duplicate_candidates — it is never
 * auto-merged.
 */

import {
  extractDomain,
  normalizeCountryCode,
  normalizeNameForMatching,
  normalizeQualificationLevel,
  normalizeWhitespace,
} from "./normalize";
import type { DuplicateMatchSignal } from "@/types/education";

export interface DuplicateScoreResult {
  score: number;
  signals: DuplicateMatchSignal[];
}

/** A signal with its own weight, evaluated as a 0/1 exact-match unless a custom comparator is supplied. */
interface SignalSpec<T> {
  field: string;
  weight: number;
  primary: (item: T) => string | null;
  candidate: (item: T) => string | null;
}

function scoreSignals<T>(primaryItem: T, candidateItem: T, specs: Array<SignalSpec<T>>): DuplicateScoreResult {
  const signals: DuplicateMatchSignal[] = [];
  let earnedWeight = 0;
  let totalWeight = 0;

  for (const spec of specs) {
    const primaryValue = spec.primary(primaryItem);
    const candidateValue = spec.candidate(candidateItem);
    totalWeight += spec.weight;
    // A signal only counts toward the score when BOTH sides have a value —
    // two records that are both missing a field (e.g. no source ID on
    // either) should not score as "matching" on that field.
    const matched = !!primaryValue && !!candidateValue && primaryValue === candidateValue;
    if (matched) earnedWeight += spec.weight;
    if (primaryValue || candidateValue) {
      signals.push({ field: spec.field, primaryValue, candidateValue, weight: spec.weight });
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 1000) / 1000 : 0;
  return { score, signals };
}

// ---------------------------------------------------------------------------
// Universities: normalized name, country, city, domain, source record ID
// ---------------------------------------------------------------------------

export interface UniversityMatchInput {
  name: string | null;
  countryCode: string | null; // ISO alpha-2, e.g. from countries.iso_alpha2
  city: string | null;
  websiteUrl: string | null;
  sourceRecordId: string | null;
}

const UNIVERSITY_SIGNAL_SPECS: Array<SignalSpec<UniversityMatchInput>> = [
  { field: "name", weight: 4, primary: (u) => normalizeNameForMatching(u.name) || null, candidate: (u) => normalizeNameForMatching(u.name) || null },
  { field: "country", weight: 2, primary: (u) => normalizeCountryCode(u.countryCode) || null, candidate: (u) => normalizeCountryCode(u.countryCode) || null },
  { field: "city", weight: 1, primary: (u) => normalizeWhitespace(u.city).toLowerCase() || null, candidate: (u) => normalizeWhitespace(u.city).toLowerCase() || null },
  { field: "domain", weight: 3, primary: (u) => extractDomain(u.websiteUrl), candidate: (u) => extractDomain(u.websiteUrl) },
  { field: "sourceRecordId", weight: 2, primary: (u) => normalizeWhitespace(u.sourceRecordId) || null, candidate: (u) => normalizeWhitespace(u.sourceRecordId) || null },
];

export function scoreUniversityMatch(primary: UniversityMatchInput, candidate: UniversityMatchInput): DuplicateScoreResult {
  return scoreSignals(primary, candidate, UNIVERSITY_SIGNAL_SPECS);
}

/** Convenience threshold — a score at or above this is surfaced as a duplicate candidate for admin review (never auto-merged regardless of score). */
export const UNIVERSITY_DUPLICATE_SCORE_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Courses: university + normalized program name + qualification + campus +
// program code + study mode
// ---------------------------------------------------------------------------

export interface CourseMatchInput {
  universityId: string | null;
  name: string | null;
  qualificationLevel: string | null; // e.g. courses.education_level
  campusId: string | null;
  programCode: string | null;
  studyMode: string | null; // e.g. courses.delivery_mode / study_pace
}

const COURSE_SIGNAL_SPECS: Array<SignalSpec<CourseMatchInput>> = [
  { field: "universityId", weight: 3, primary: (c) => c.universityId || null, candidate: (c) => c.universityId || null },
  { field: "name", weight: 4, primary: (c) => normalizeNameForMatching(c.name) || null, candidate: (c) => normalizeNameForMatching(c.name) || null },
  { field: "qualificationLevel", weight: 2, primary: (c) => normalizeQualificationLevel(c.qualificationLevel) || null, candidate: (c) => normalizeQualificationLevel(c.qualificationLevel) || null },
  { field: "campusId", weight: 1, primary: (c) => c.campusId || null, candidate: (c) => c.campusId || null },
  { field: "programCode", weight: 2, primary: (c) => normalizeWhitespace(c.programCode).toUpperCase() || null, candidate: (c) => normalizeWhitespace(c.programCode).toUpperCase() || null },
  { field: "studyMode", weight: 1, primary: (c) => normalizeWhitespace(c.studyMode).toLowerCase() || null, candidate: (c) => normalizeWhitespace(c.studyMode).toLowerCase() || null },
];

export function scoreCourseMatch(primary: CourseMatchInput, candidate: CourseMatchInput): DuplicateScoreResult {
  return scoreSignals(primary, candidate, COURSE_SIGNAL_SPECS);
}

/** A course match REQUIRES the same university — two identically-named courses at different universities are not duplicates of each other, no matter how the other signals score. Callers should skip scoring (or force score 0) for cross-university pairs; this constant documents that rule for reuse. */
export const COURSE_DUPLICATE_REQUIRES_SAME_UNIVERSITY = true;

export const COURSE_DUPLICATE_SCORE_THRESHOLD = 0.6;
