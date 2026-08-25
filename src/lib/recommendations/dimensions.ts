import type { CareerMatchProfile } from "@/types/career";
import {
  SUBJECT_OPTIONS,
  INTEREST_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  labelFor,
} from "@/data/profile-options";
import type { NormalizedStudentProfile } from "./normalize";
import type { DimensionResult, ExplanationItem } from "./types";
import {
  BELOW_MINIMUM_FIT_CAP,
  INTEREST_NO_STRENGTH_DEFAULT_FIT,
  NEUTRAL_RATING,
  MIN_OPINION_WEIGHT,
  RATING_SCALE_MAX,
  RATING_SCALE_SPAN,
  HEURISTIC_MIN_ITEM_WEIGHT,
  EDUCATION_LEVEL_ORDER,
  EDUCATION_ROUTE_RELEVANCE_FIT,
  EDUCATION_LEVEL_ADJACENT_FIT,
  MOBILITY_ANSWER_WEIGHT,
} from "./weights";

const SKILL_LEVEL_ORDER: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const SKILL_LABEL_BY_KEY = new Map(
  [...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS].map((o) => [o.key, o.label])
);

/**
 * One item being folded into a dimension's weighted average — always a
 * plain data object, never a reference back into student/career input, so
 * dimension functions can't accidentally mutate what they were given.
 */
interface WeightedItem {
  weight: number;
  fit: number; // 0-1
  hasData: boolean;
  reason?: ExplanationItem;
  gap?: ExplanationItem;
  matchedKey?: string;
}

function aggregate(dimension: DimensionResult["dimension"], items: WeightedItem[]): DimensionResult {
  const applicableWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const evaluated = items.filter((i) => i.hasData);
  const evaluatedWeight = evaluated.reduce((sum, i) => sum + i.weight, 0);

  const hasEvidence = evaluatedWeight > 0;
  const rawScore = hasEvidence ? evaluated.reduce((sum, i) => sum + i.weight * i.fit, 0) / evaluatedWeight : 0;
  const evidenceStrength = applicableWeight > 0 ? evaluatedWeight / applicableWeight : 0;

  // Reasons: the highest-fit evaluated items. Gaps: applicable-but-unevaluated items, i.e. things the career cares about that the student hasn't told us about yet.
  const reasons = evaluated
    .filter((i) => i.reason)
    .sort((a, b) => b.weight * b.fit - a.weight * a.fit)
    .map((i) => i.reason as ExplanationItem);
  const gaps = items
    .filter((i) => !i.hasData && i.gap)
    .sort((a, b) => b.weight - a.weight)
    .map((i) => i.gap as ExplanationItem);
  const matchedKeys = evaluated.filter((i) => i.matchedKey).map((i) => i.matchedKey as string);

  return { dimension, hasEvidence, rawScore, evidenceStrength, reasons, gaps, matchedKeys };
}

function capBelowMinimum(fit: number, meetsMinimum: boolean): number {
  return meetsMinimum ? fit : Math.min(fit, BELOW_MINIMUM_FIT_CAP);
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export function scoreSubjects(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const items: WeightedItem[] = career.subjects.map((req) => {
    const rating = student.subjectStrengthByKey.get(req.subjectKey);
    const label = labelFor(SUBJECT_OPTIONS, req.subjectKey);
    const hasData = rating !== undefined;
    const meetsMinimum = req.minimumStrength === null || (rating ?? 0) >= req.minimumStrength;
    const fit = hasData ? capBelowMinimum(rating! / RATING_SCALE_MAX, meetsMinimum) : 0;

    return {
      weight: req.importance,
      fit,
      hasData,
      matchedKey: hasData ? req.subjectKey : undefined,
      reason: hasData
        ? {
            dimension: "subjects",
            key: req.subjectKey,
            label: meetsMinimum
              ? `Your strength in ${label} lines up with what this career looks for.`
              : `You've rated ${label} below the level this career typically expects.`,
          }
        : undefined,
      gap:
        !hasData && req.importance >= 3
          ? { dimension: "subjects", key: req.subjectKey, label: `${label} matters here — add a strength rating for it to sharpen this match.` }
          : undefined,
    };
  });

  return aggregate("subjects", items);
}

// ---------------------------------------------------------------------------
// Interests
// ---------------------------------------------------------------------------
export function scoreInterests(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const items: WeightedItem[] = career.interests.map((req) => {
    const hasData = student.interestStrengthByKey.has(req.interestKey);
    const strength = student.interestStrengthByKey.get(req.interestKey) ?? null;
    const label = labelFor(INTEREST_OPTIONS, req.interestKey);
    const fit = hasData ? (strength !== null ? strength / RATING_SCALE_MAX : INTEREST_NO_STRENGTH_DEFAULT_FIT) : 0;

    return {
      weight: req.importance,
      fit,
      hasData,
      matchedKey: hasData ? req.interestKey : undefined,
      reason: hasData ? { dimension: "interests", key: req.interestKey, label: `You share an interest in ${label}.` } : undefined,
      gap:
        !hasData && req.importance >= 3
          ? { dimension: "interests", key: req.interestKey, label: `Students drawn to ${label} often enjoy this career — worth a look.` }
          : undefined,
    };
  });

  return aggregate("interests", items);
}

// ---------------------------------------------------------------------------
// Skills (technical + transferable, same table/key space)
// ---------------------------------------------------------------------------
export function scoreSkills(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const items: WeightedItem[] = career.skills.map((req) => {
    const level = student.skillLevelByKey.get(req.skillKey);
    const hasData = level !== undefined;
    const label = SKILL_LABEL_BY_KEY.get(req.skillKey) ?? req.skillKey;
    const recommendedOrder = SKILL_LEVEL_ORDER[req.recommendedLevel] ?? 1;
    const studentOrder = hasData ? SKILL_LEVEL_ORDER[level as string] ?? 1 : 0;
    const fit = hasData ? Math.min(1, studentOrder / recommendedOrder) : 0;

    return {
      weight: req.importance,
      fit,
      hasData,
      matchedKey: hasData ? req.skillKey : undefined,
      reason: hasData
        ? {
            dimension: "skills",
            key: req.skillKey,
            label:
              fit >= 1
                ? `Your ${label} skill level already meets what this career typically expects.`
                : `You have some ${label} experience, which this career draws on.`,
          }
        : undefined,
      gap:
        !hasData && req.importance >= 3
          ? { dimension: "skills", key: req.skillKey, label: `${label} is commonly used here — add it to your profile if you have any experience with it.` }
          : undefined,
    };
  });

  return aggregate("skills", items);
}

// ---------------------------------------------------------------------------
// Work preferences — an agreement dimension: both sides rate the same key
// on a 1-5 scale (student: "how much do you agree", career: "how much
// does this apply"), so fit is closeness rather than a requirement check.
// ---------------------------------------------------------------------------
export function scoreWorkPreferences(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const items: WeightedItem[] = career.workPreferences.map((profile) => {
    const rating = student.workPreferenceRatingByKey.get(profile.preferenceKey);
    const hasData = rating !== undefined;
    const label = labelFor(WORK_PREFERENCE_OPTIONS, profile.preferenceKey);
    // A career's opinion further from neutral (3) is more informative — weight it more.
    const weight = MIN_OPINION_WEIGHT + Math.abs(profile.score - NEUTRAL_RATING);
    const fit = hasData ? 1 - Math.abs(rating! - profile.score) / RATING_SCALE_SPAN : 0;

    return {
      weight,
      fit,
      hasData,
      matchedKey: hasData ? profile.preferenceKey : undefined,
      reason:
        hasData && fit >= 0.75
          ? { dimension: "workPreferences", key: profile.preferenceKey, label: `Your working style around "${label}" matches this career well.` }
          : undefined,
      gap: undefined, // work-preference coverage is an all-18-keys-at-once section in onboarding, not worth listing individually as a gap
    };
  });

  return aggregate("workPreferences", items);
}

// ---------------------------------------------------------------------------
// Career priorities — same agreement pattern as work preferences.
// ---------------------------------------------------------------------------
export function scoreCareerPriorities(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const items: WeightedItem[] = career.careerPriorities.map((profile) => {
    const rating = student.priorityRatingByKey.get(profile.priorityKey);
    const hasData = rating !== undefined;
    const label = labelFor(CAREER_PRIORITY_OPTIONS, profile.priorityKey);
    const weight = MIN_OPINION_WEIGHT + Math.abs(profile.score - NEUTRAL_RATING);
    const fit = hasData ? 1 - Math.abs(rating! - profile.score) / RATING_SCALE_SPAN : 0;

    return {
      weight,
      fit,
      hasData,
      matchedKey: hasData ? profile.priorityKey : undefined,
      reason:
        hasData && fit >= 0.75 && rating! >= 4
          ? { dimension: "careerPriorities", key: profile.priorityKey, label: `This career is a good fit for your priority on ${label.toLowerCase()}.` }
          : undefined,
      gap:
        !hasData && Math.abs(profile.score - NEUTRAL_RATING) >= 2
          ? { dimension: "careerPriorities", key: profile.priorityKey, label: `Rate how much "${label}" matters to you to see how well this career lines up here.` }
          : undefined,
    };
  });

  return aggregate("careerPriorities", items);
}

// ---------------------------------------------------------------------------
// Career-level heuristic attributes (careers.scores.*) — driven primarily
// by how much the student says they care about the matching priority (see
// PRIORITY_TO_SCORE_FIELD), plus a small technical-depth signal derived
// from the student's own technical skill portfolio (there's no single
// student "priority" that maps to technical depth the way salary/security/
// etc. do via CAREER_PRIORITY_OPTIONS).
// ---------------------------------------------------------------------------
const PRIORITY_TO_SCORE_FIELD: Partial<Record<string, keyof CareerMatchProfile["scores"]>> = {
  high_salary: "salaryPotential",
  job_security: "jobSecurity",
  international_career: "internationalMobility",
  work_abroad_opportunity: "internationalMobility",
  creativity: "creativity",
  leadership: "leadershipOpportunity",
  social_impact: "socialImpact",
  remote_work: "remoteWork",
  entrepreneurship: "entrepreneurship",
  research: "researchIntensity",
  travel: "travel",
};

const HEURISTIC_LABELS: Record<keyof CareerMatchProfile["scores"], string> = {
  internationalMobility: "international mobility",
  remoteWork: "remote-work potential",
  entrepreneurship: "entrepreneurial opportunity",
  salaryPotential: "salary potential",
  jobSecurity: "job security",
  creativity: "room for creativity",
  socialImpact: "social impact",
  leadershipOpportunity: "leadership opportunity",
  travel: "travel",
  researchIntensity: "research intensity",
  technicalDepth: "technical depth",
};

export function scoreCareerHeuristics(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const items: WeightedItem[] = [];

  for (const [priorityKey, field] of Object.entries(PRIORITY_TO_SCORE_FIELD)) {
    const scoreValue = field ? career.scores[field] : null;
    if (scoreValue === null || scoreValue === undefined || !field) continue;

    const rating = student.priorityRatingByKey.get(priorityKey);
    const hasData = rating !== undefined;
    const importanceWeight = hasData ? (rating! - 1) / RATING_SCALE_SPAN : 0; // 0-1
    const weight = Math.max(HEURISTIC_MIN_ITEM_WEIGHT, importanceWeight);
    const fit = scoreValue / RATING_SCALE_MAX;

    items.push({
      weight,
      fit,
      hasData: hasData && rating! >= 4, // only counts as "evidence" when the student actually cares — a low priority rating shouldn't manufacture a strong reason
      matchedKey: hasData && rating! >= 4 ? priorityKey : undefined,
      reason:
        hasData && rating! >= 4 && fit >= 0.6
          ? { dimension: "careerHeuristics", key: priorityKey, label: `This career scores well on ${HEURISTIC_LABELS[field]}, which matters to you.` }
          : undefined,
      gap: undefined,
    });
  }

  // Technical depth: soft signal from the student's own technical skill portfolio, not a priority rating.
  if (career.scores.technicalDepth !== null) {
    const technicalKeys = TECHNICAL_SKILL_OPTIONS.map((o) => o.key);
    const ratedTechnicalLevels = technicalKeys
      .map((k) => student.skillLevelByKey.get(k))
      .filter((v): v is NonNullable<typeof v> => v !== undefined)
      .map((level) => SKILL_LEVEL_ORDER[level] ?? 1);
    const hasData = ratedTechnicalLevels.length > 0;
    const avgOrder = hasData ? ratedTechnicalLevels.reduce((a, b) => a + b, 0) / ratedTechnicalLevels.length : 0;
    const studentTechnicalDepth = avgOrder / 3; // 0-1
    const careerTechnicalDepth = career.scores.technicalDepth / RATING_SCALE_MAX;
    // Agreement, not a one-directional requirement — a highly technical student and a low-technical-depth career is just as informative as the reverse.
    const fit = 1 - Math.abs(studentTechnicalDepth - careerTechnicalDepth);

    items.push({
      weight: 1,
      fit,
      hasData,
      matchedKey: hasData ? "technical_depth" : undefined,
      reason: hasData && fit >= 0.75 ? { dimension: "careerHeuristics", key: null, label: "The technical depth of this career matches your technical skill profile." } : undefined,
      gap: undefined,
    });
  }

  return aggregate("careerHeuristics", items);
}

// ---------------------------------------------------------------------------
// Education — level match against career.educationRoutes / minimumEducationKey.
//
// NOTE ON SCOPE: `student_education.field_of_study` is free text captured
// during onboarding (see supabase/migrations/0002_student_profile.sql) —
// it is NOT a stable key from FIELD_OF_STUDY_OPTIONS the way subjects/
// interests/skills are. Comparing free text against a career's `fieldKey`
// would mean inventing a fuzzy-matching heuristic on ungoverned data, which
// risks false confidence. This dimension deliberately scores education
// LEVEL only (a real stable key on both sides) and leaves field-of-study
// matching as a documented known limitation — see docs/recommendation-
// engine-guide.md.
// ---------------------------------------------------------------------------
export function scoreEducation(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const studentLevel = student.educationLevel;
  const studentOrder = studentLevel ? EDUCATION_LEVEL_ORDER[studentLevel] ?? 0 : 0;
  const hasLevelData = studentLevel !== null && studentOrder > 0;

  const items: WeightedItem[] = [];

  if (career.educationRoutes.length > 0) {
    const exactMatch = hasLevelData ? career.educationRoutes.find((r) => r.educationLevel === studentLevel) : undefined;
    const lowestRouteOrder = Math.min(...career.educationRoutes.map((r) => EDUCATION_LEVEL_ORDER[r.educationLevel] ?? 0));

    let fit = 0;
    if (exactMatch) {
      fit = EDUCATION_ROUTE_RELEVANCE_FIT[exactMatch.relevance];
    } else if (hasLevelData && studentOrder >= lowestRouteOrder) {
      fit = EDUCATION_LEVEL_ADJACENT_FIT;
    }

    items.push({
      weight: 2,
      fit,
      hasData: hasLevelData,
      matchedKey: hasLevelData ? studentLevel! : undefined,
      reason:
        hasLevelData && exactMatch
          ? { dimension: "education", key: studentLevel, label: `Your education level (${labelFor(EDUCATION_LEVEL_OPTIONS, studentLevel!)}) is a typical entry point for this career.` }
          : undefined,
      gap: !hasLevelData ? { dimension: "education", key: null, label: "Add your current education level to see how it lines up with this career's typical entry route." } : undefined,
    });
  }

  if (career.minimumEducationKey) {
    const minOrder = EDUCATION_LEVEL_ORDER[career.minimumEducationKey] ?? 0;
    const meetsMinimum = hasLevelData && studentOrder >= minOrder;
    const fit = hasLevelData ? capBelowMinimum(1, meetsMinimum) : 0;

    items.push({
      weight: 1,
      fit,
      hasData: hasLevelData,
      matchedKey: undefined,
      reason: undefined,
      gap:
        hasLevelData && !meetsMinimum
          ? {
              dimension: "education",
              key: career.minimumEducationKey,
              label: `This career typically expects at least ${labelFor(EDUCATION_LEVEL_OPTIONS, career.minimumEducationKey)} — worth knowing as you plan ahead.`,
            }
          : undefined,
    });
  }

  return aggregate("education", items);
}

// ---------------------------------------------------------------------------
// Mobility — international study/relocation intent vs. the career's
// internationalMobility heuristic. See docs for why this dimension is
// intentionally narrow (no direct student "domestic mobility" signal
// exists in M3 to compare against).
// ---------------------------------------------------------------------------
export function scoreMobility(student: NormalizedStudentProfile, career: CareerMatchProfile): DimensionResult {
  const mobilityScore = career.scores.internationalMobility;
  if (mobilityScore === null) return aggregate("mobility", []);

  const signals: { key: "studyAbroad" | "relocateInternational"; answer: "yes" | "maybe" | "no" | null; label: string }[] = [
    { key: "studyAbroad", answer: student.mobility.studyAbroad, label: "openness to studying abroad" },
    { key: "relocateInternational", answer: student.mobility.relocateInternational, label: "openness to relocating internationally" },
  ];

  const items: WeightedItem[] = signals.map(({ key, answer, label }) => {
    const hasData = answer !== null;
    const weight = hasData ? MOBILITY_ANSWER_WEIGHT[answer!] : 0;
    let fit = 0;
    if (answer === "yes") fit = mobilityScore / RATING_SCALE_MAX;
    else if (answer === "maybe") fit = 0.5 + mobilityScore / (RATING_SCALE_MAX * 2);
    else if (answer === "no") fit = 1 - (mobilityScore - 1) / RATING_SCALE_SPAN;

    return {
      weight: weight || 1, // avoid a zero-weight item polluting the average when there's no data anyway (excluded via hasData)
      fit,
      hasData,
      matchedKey: hasData ? key : undefined,
      reason:
        hasData && answer === "yes" && fit >= 0.6
          ? { dimension: "mobility", key, label: `This career offers ${label.replace("openness to ", "")}, which matches your stated ${label}.` }
          : undefined,
      gap: undefined,
    };
  });

  return aggregate("mobility", items);
}
