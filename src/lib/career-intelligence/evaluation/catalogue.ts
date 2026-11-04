import type { CareerMatchProfile } from "@/types/career";
import { ALL_CAREERS, CAREER_FAMILIES } from "@/data/careers";

/**
 * NW09 evaluation — the REAL Nextwise career catalogue (the same Milestone 4
 * seed data the database was loaded from), converted offline into the
 * CareerMatchProfile shape the engine uses. Ids are "seed:<career_key>" so an
 * evaluation report can never be confused with a database record. Only
 * approved catalogue entries are included, mirroring the careers RLS policy.
 */
const FAMILY = new Map(CAREER_FAMILIES.map((f) => [f.key, f.name]));

export function evaluationCatalogue(): CareerMatchProfile[] {
  return ALL_CAREERS.filter((c) => c.dataQualityStatus === "approved").map((c) => ({
    id: `seed:${c.careerKey}`,
    careerKey: c.careerKey,
    slug: c.slug,
    title: c.title,
    shortTitle: c.shortTitle ?? null,
    summary: c.summary,
    familyKey: c.familyKey,
    familyName: FAMILY.get(c.familyKey) ?? c.familyKey,
    isFeatured: c.isFeatured ?? false,
    minimumEducationKey: c.minimumEducationKey ?? null,
    scores: {
      internationalMobility: c.scores?.internationalMobility ?? null,
      remoteWork: c.scores?.remoteWork ?? null,
      entrepreneurship: c.scores?.entrepreneurship ?? null,
      salaryPotential: c.scores?.salaryPotential ?? null,
      jobSecurity: c.scores?.jobSecurity ?? null,
      creativity: c.scores?.creativity ?? null,
      socialImpact: c.scores?.socialImpact ?? null,
      leadershipOpportunity: c.scores?.leadershipOpportunity ?? null,
      travel: c.scores?.travel ?? null,
      researchIntensity: c.scores?.researchIntensity ?? null,
      technicalDepth: c.scores?.technicalDepth ?? null,
    },
    subjects: c.subjects.map((s) => ({ subjectKey: s.subjectKey, importance: s.importance, minimumStrength: s.minimumStrength ?? null })),
    interests: c.interests.map((i) => ({ interestKey: i.interestKey, importance: i.importance })),
    skills: c.skills.map((s) => ({ skillKey: s.skillKey, importance: s.importance, recommendedLevel: s.recommendedLevel })),
    workPreferences: c.workPreferences.map((w) => ({ preferenceKey: w.preferenceKey, score: w.score })),
    careerPriorities: c.careerPriorities.map((p) => ({ priorityKey: p.priorityKey, score: p.score })),
    educationRoutes: c.educationRoutes.map((r) => ({ educationLevel: r.educationLevel, fieldKey: r.fieldKey, specializationKey: r.specializationKey ?? null, relevance: r.relevance, notes: r.notes ?? null })),
    industryKeys: c.industryKeys,
    tagKeys: c.tagKeys,
  }));
}
