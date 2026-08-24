import type { OnboardingDraftState } from "@/components/sections/profile/onboarding/onboarding-types";
import type { StudentProfileSnapshot } from "@/types/student-profile";

/**
 * Converts a fetched Student Digital Profile snapshot into the onboarding
 * wizard's in-memory draft shape. Shared between the wizard (editing, in
 * `OnboardingWizard.tsx`) and the read-only `/profile` page, so the two
 * never drift apart — deliberately kept out of any "use client" module so
 * a Server Component can call it directly when building `/profile`.
 */
export function snapshotToDraft(snapshot: StudentProfileSnapshot): OnboardingDraftState {
  return {
    aboutYou: {
      dateOfBirth: snapshot.profile.dateOfBirth,
      gender: snapshot.profile.gender,
      city: snapshot.profile.city,
      state: snapshot.profile.state,
      country: snapshot.profile.country,
      preferredLanguage: snapshot.profile.preferredLanguage,
      currentStatus: snapshot.profile.currentStatus,
    },
    education: snapshot.education.map((r) => ({ ...r, draftId: r.id })),
    subjectStrengths: Object.fromEntries(snapshot.subjectStrengths.map((s) => [s.subjectKey, s.rating])),
    interests: Object.fromEntries(snapshot.interests.map((i) => [i.interestKey, i.strength ?? 3])),
    interestsOtherText: snapshot.interests.find((i) => i.interestKey === "other")?.otherText ?? "",
    skills: Object.fromEntries(snapshot.skills.map((s) => [s.skillKey, s.level])),
    workPreferences: Object.fromEntries(snapshot.workPreferences.map((w) => [w.preferenceKey, w.rating])),
    careerPriorities: Object.fromEntries(snapshot.careerPriorities.map((c) => [c.priorityKey, c.rating])),
    careerGoals: snapshot.careerGoals ?? {
      clarity: null,
      dreamJobTitle: null,
      dreamIndustry: null,
      dreamReason: null,
      careerIdeas: [],
      lifeGoalsText: null,
    },
    studyPreferences: snapshot.studyPreferences ?? {
      studyFurther: null,
      studyAbroad: null,
      preferredStudyDestinations: [],
      preferredWorkDestinations: [],
      relocateWithinIndia: null,
      relocateInternational: null,
    },
    fundingPreferences: snapshot.fundingPreferences ?? {
      budgetBand: null,
      fundingSource: null,
      loanOpenness: null,
    },
    experience: snapshot.experience.map((r) => ({ ...r, draftId: r.id })),
  };
}
