import type { CareerMatchProfile } from "@/types/career";
import type {
  StudentProfileSnapshot,
  StudentProfile,
  SubjectStrength,
  Interest,
  Skill,
  WorkPreferenceAnswer,
  CareerPriorityAnswer,
  StudyPreferences,
  EducationRecord,
} from "@/types/student-profile";
import { WORK_PREFERENCE_OPTIONS, CAREER_PRIORITY_OPTIONS } from "@/data/profile-options";

/**
 * Fixture builders shared by the recommendation-engine test files. Not
 * matched by vitest.config.ts's `include` glob (it only picks up
 * `*.test.ts`), so this file never runs as a test suite itself — it's
 * imported by the files that do.
 */

const EMPTY_PROFILE: StudentProfile = {
  userId: "student-1",
  dateOfBirth: null,
  gender: null,
  city: null,
  state: null,
  country: "India",
  preferredLanguage: null,
  currentStatus: null,
  profileStatus: "not_started",
  profileCompletionPercent: 0,
  onboardingCurrentStep: 1,
};

/** A full StudentProfile with sensible empty defaults, for callers (e.g. readiness.test.ts) that only need to override a field or two like `currentStatus` without retyping every other required field. */
export function studentProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return { ...EMPTY_PROFILE, ...overrides };
}

export function buildSnapshot(overrides: Partial<StudentProfileSnapshot> = {}): StudentProfileSnapshot {
  return {
    profile: { ...EMPTY_PROFILE, ...overrides.profile },
    education: overrides.education ?? [],
    subjectStrengths: overrides.subjectStrengths ?? [],
    interests: overrides.interests ?? [],
    skills: overrides.skills ?? [],
    workPreferences: overrides.workPreferences ?? [],
    careerPriorities: overrides.careerPriorities ?? [],
    careerGoals: overrides.careerGoals ?? null,
    studyPreferences: overrides.studyPreferences ?? null,
    fundingPreferences: overrides.fundingPreferences ?? null,
    experience: overrides.experience ?? [],
  };
}

export function subjectStrength(subjectKey: string, rating: number): SubjectStrength {
  return { subjectKey, rating };
}

export function interest(interestKey: string, strength: number | null = null): Interest {
  return { interestKey, strength, otherText: null };
}

export function skill(skillKey: string, level: Skill["level"]): Skill {
  return { skillKey, level };
}

export function educationRecord(overrides: Partial<EducationRecord> = {}): EducationRecord {
  return {
    id: overrides.id ?? "edu-1",
    educationLevel: overrides.educationLevel ?? "bachelors",
    institutionName: overrides.institutionName ?? null,
    boardOrUniversity: overrides.boardOrUniversity ?? null,
    fieldOfStudy: overrides.fieldOfStudy ?? null,
    specialization: overrides.specialization ?? null,
    startYear: overrides.startYear ?? null,
    endYear: overrides.endYear ?? null,
    status: overrides.status ?? "ongoing",
    scoreType: overrides.scoreType ?? null,
    scoreValue: overrides.scoreValue ?? null,
    backlogs: overrides.backlogs ?? null,
  };
}

/** All 18 work-preference keys rated neutral (3), with the given overrides applied on top — mirrors onboarding, which collects every key at once. */
export function fullWorkPreferences(overrides: Record<string, number> = {}): WorkPreferenceAnswer[] {
  return WORK_PREFERENCE_OPTIONS.map((o) => ({ preferenceKey: o.key, rating: overrides[o.key] ?? 3 }));
}

/** A subset of career-priority keys rated, defaulting the rest to neutral (3) only for the keys explicitly listed — callers can also pass a partial set to simulate an incomplete section. */
export function partialCareerPriorities(overrides: Record<string, number>): CareerPriorityAnswer[] {
  return Object.entries(overrides).map(([priorityKey, rating]) => ({ priorityKey, rating }));
}

export function allCareerPriorities(overrides: Record<string, number> = {}): CareerPriorityAnswer[] {
  return CAREER_PRIORITY_OPTIONS.map((o) => ({ priorityKey: o.key, rating: overrides[o.key] ?? 3 }));
}

export function studyPreferences(overrides: Partial<StudyPreferences> = {}): StudyPreferences {
  return {
    studyFurther: null,
    studyAbroad: null,
    preferredStudyDestinations: [],
    preferredWorkDestinations: [],
    relocateWithinIndia: null,
    relocateInternational: null,
    ...overrides,
  };
}

const EMPTY_SCORES: CareerMatchProfile["scores"] = {
  internationalMobility: null,
  remoteWork: null,
  entrepreneurship: null,
  salaryPotential: null,
  jobSecurity: null,
  creativity: null,
  socialImpact: null,
  leadershipOpportunity: null,
  travel: null,
  researchIntensity: null,
  technicalDepth: null,
};

export function buildCareer(overrides: Partial<CareerMatchProfile> = {}): CareerMatchProfile {
  return {
    id: overrides.id ?? "career-1",
    careerKey: overrides.careerKey ?? "software_engineer",
    slug: overrides.slug ?? "software-engineer",
    title: overrides.title ?? "Software Engineer",
    shortTitle: overrides.shortTitle ?? null,
    summary: overrides.summary ?? "Designs and builds software systems.",
    familyKey: overrides.familyKey ?? "technology",
    familyName: overrides.familyName ?? "Technology",
    isFeatured: overrides.isFeatured ?? false,
    minimumEducationKey: overrides.minimumEducationKey ?? null,
    scores: { ...EMPTY_SCORES, ...overrides.scores },
    subjects: overrides.subjects ?? [],
    interests: overrides.interests ?? [],
    skills: overrides.skills ?? [],
    workPreferences: overrides.workPreferences ?? [],
    careerPriorities: overrides.careerPriorities ?? [],
    educationRoutes: overrides.educationRoutes ?? [],
    industryKeys: overrides.industryKeys ?? [],
    tagKeys: overrides.tagKeys ?? [],
  };
}

/** A career with rich requirements across every dimension, used as the "strong match" counterpart fixture. */
export function buildRichCareer(overrides: Partial<CareerMatchProfile> = {}): CareerMatchProfile {
  return buildCareer({
    minimumEducationKey: "bachelors",
    scores: {
      internationalMobility: 4,
      remoteWork: 5,
      entrepreneurship: 3,
      salaryPotential: 5,
      jobSecurity: 4,
      creativity: 3,
      socialImpact: 2,
      leadershipOpportunity: 3,
      travel: 2,
      researchIntensity: 3,
      technicalDepth: 5,
    },
    subjects: [
      { subjectKey: "mathematics", importance: 5, minimumStrength: 4 },
      { subjectKey: "computer_science", importance: 5, minimumStrength: 3 },
    ],
    interests: [
      { interestKey: "programming", importance: 5 },
      { interestKey: "ai_data", importance: 3 },
    ],
    skills: [
      { skillKey: "programming", importance: 5, recommendedLevel: "advanced" },
      { skillKey: "problem_solving", importance: 4, recommendedLevel: "intermediate" },
    ],
    workPreferences: [
      { preferenceKey: "prefers_computer_based_work", score: 5 },
      { preferenceKey: "enjoys_people", score: 2 },
    ],
    careerPriorities: [
      { priorityKey: "high_salary", score: 5 },
      { priorityKey: "remote_work", score: 5 },
      { priorityKey: "job_security", score: 4 },
    ],
    educationRoutes: [{ educationLevel: "bachelors", fieldKey: "computer_science", specializationKey: null, relevance: "primary", notes: null }],
    ...overrides,
  });
}
