import type { StudentProfileSnapshot } from "@/types/student-profile";

/**
 * NW09.2 — the FICTIONAL ADULT profile used by the manually authorised
 * OpenAI live pilot (scripts/dev/nw09-openai-pilot.ts). No real person,
 * institution, contact detail or identifier. Every one of the 11 profile
 * sections is filled, so one paid call exercises every part of the v2
 * output (interpretation, careers, comparison, academic direction, plan,
 * gaps). Born 2003 → an adult on any pilot date.
 */
export const PILOT_PROFILE: { id: string; description: string; snapshot: StudentProfileSnapshot } = {
  id: "pilot-adult-cs-graduate",
  description: "Fictional 23-year-old computer-science graduate, one year into work, weighing data, software and a master's.",
  snapshot: {
    profile: {
      userId: "fictional-pilot-adult",
      dateOfBirth: "2003-04-11",
      gender: null,
      city: "Fictional City",
      state: null,
      country: "India",
      preferredLanguage: "en",
      currentStatus: "working",
      profileStatus: "completed",
      profileCompletionPercent: 100,
      onboardingCurrentStep: 11,
    },
    education: [
      { id: "pilot-edu-12", educationLevel: "class_12", institutionName: "Fictional Senior School", boardOrUniversity: null, fieldOfStudy: "Science (PCM)", specialization: null, startYear: 2019, endYear: 2021, status: "completed", scoreType: "percentage", scoreValue: 84, backlogs: null },
      { id: "pilot-edu-ba", educationLevel: "bachelors", institutionName: "Fictional Institute of Technology", boardOrUniversity: null, fieldOfStudy: "Computer Science", specialization: null, startYear: 2021, endYear: 2025, status: "completed", scoreType: "cgpa_10", scoreValue: 7.6, backlogs: 0 },
    ],
    subjectStrengths: [
      { subjectKey: "mathematics", rating: 4 },
      { subjectKey: "computer_science", rating: 5 },
      { subjectKey: "physics", rating: 3 },
      { subjectKey: "english", rating: 4 },
      { subjectKey: "economics", rating: 3 },
    ],
    interests: [
      { interestKey: "programming", strength: 5, otherText: null },
      { interestKey: "ai_data", strength: 5, otherText: null },
      { interestKey: "computers", strength: 4, otherText: null },
      { interestKey: "environment", strength: 3, otherText: null },
    ],
    skills: [
      { skillKey: "python", level: "advanced" },
      { skillKey: "programming", level: "intermediate" },
      { skillKey: "data_analysis", level: "intermediate" },
      { skillKey: "excel", level: "intermediate" },
      { skillKey: "problem_solving", level: "advanced" },
      { skillKey: "communication", level: "intermediate" },
      { skillKey: "teamwork", level: "intermediate" },
    ],
    workPreferences: [
      { preferenceKey: "technical_problem_solving", rating: 5 },
      { preferenceKey: "prefers_computer_based_work", rating: 5 },
      { preferenceKey: "enjoys_research_analysis", rating: 4 },
      { preferenceKey: "prefers_teamwork", rating: 3 },
    ],
    careerPriorities: [
      { priorityKey: "fast_career_growth", rating: 5 },
      { priorityKey: "high_salary", rating: 4 },
      { priorityKey: "work_life_balance", rating: 4 },
      { priorityKey: "international_career", rating: 3 },
      { priorityKey: "job_security", rating: 3 },
      { priorityKey: "social_impact", rating: 3 },
    ],
    careerGoals: {
      clarity: "some_ideas",
      dreamJobTitle: "Data scientist",
      dreamIndustry: "Technology",
      dreamReason: "I enjoy finding patterns in data and building tools other people use.",
      careerIdeas: ["Data scientist", "Machine learning engineer", "Software developer"],
      lifeGoalsText: "Work on useful products, possibly abroad for a few years.",
    },
    studyPreferences: {
      studyFurther: "maybe",
      studyAbroad: "maybe",
      preferredStudyDestinations: ["germany", "canada"],
      preferredWorkDestinations: ["india", "germany"],
      relocateWithinIndia: "yes",
      relocateInternational: "maybe",
    },
    fundingPreferences: { budgetBand: "10_20l", fundingSource: "combination", loanOpenness: "maybe" },
    experience: [
      { id: "pilot-exp-1", type: "work_experience", title: "Junior software developer", organization: "Fictional Software Pvt Ltd", description: "Backend services and internal reporting dashboards.", year: 2025 },
      { id: "pilot-exp-2", type: "project", title: "Air-quality data project", organization: null, description: "Cleaned public sensor data and built a simple forecast model.", year: 2024 },
      { id: "pilot-exp-3", type: "certification", title: "Introductory machine learning course", organization: null, description: null, year: 2024 },
    ],
  },
};
