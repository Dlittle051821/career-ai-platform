/**
 * Single source of truth for every option list used by the Student Digital
 * Profile (Milestone 3): subjects, interests, skills, work-preference
 * statements, career priorities, countries, budget bands, and so on.
 *
 * IMPORTANT — stable keys vs. display labels: every option has a `key`
 * (snake_case, stored in the database and later read by the Career
 * Recommendation Engine) and a `label` (the English sentence shown today).
 * Component code and the recommendation engine should only ever branch on
 * `key`. `label` is free to change wording, or be localized (see
 * "Odia/language readiness" — Milestone 3 does not implement translation,
 * but keeping labels separate from keys is what makes that possible later
 * without a data migration).
 */

export interface OptionDef {
  key: string;
  label: string;
}

export const CURRENT_STATUS_OPTIONS: OptionDef[] = [
  { key: "school_10", label: "Class 10 student" },
  { key: "school_12", label: "Class 12 student" },
  { key: "diploma", label: "Diploma student" },
  { key: "undergraduate", label: "Undergraduate student" },
  { key: "postgraduate", label: "Postgraduate student" },
  { key: "working", label: "Working professional" },
  { key: "gap_year", label: "On a gap year" },
  { key: "other", label: "Other" },
];

export const GENDER_OPTIONS: OptionDef[] = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "other", label: "Other" },
  { key: "prefer_not_to_say", label: "Prefer not to say" },
];

export const EDUCATION_LEVEL_OPTIONS: OptionDef[] = [
  { key: "class_10", label: "Class 10" },
  { key: "class_12", label: "Class 12" },
  { key: "diploma", label: "Diploma" },
  { key: "bachelors", label: "Bachelor's degree" },
  { key: "masters", label: "Master's degree" },
  { key: "phd", label: "PhD" },
  { key: "other", label: "Other" },
];

/** Class 10/12 don't collect CGPA/backlogs — only these levels do. */
export const EDUCATION_LEVELS_WITH_ACADEMIC_DETAIL = new Set(["diploma", "bachelors", "masters", "phd", "other"]);

export const EDUCATION_STATUS_OPTIONS: OptionDef[] = [
  { key: "ongoing", label: "Currently studying" },
  { key: "completed", label: "Completed" },
  { key: "discontinued", label: "Discontinued" },
];

export const SCORE_TYPE_OPTIONS: OptionDef[] = [
  { key: "percentage", label: "Percentage" },
  { key: "cgpa_10", label: "CGPA (out of 10)" },
  { key: "cgpa_4", label: "CGPA (out of 4)" },
  { key: "grade", label: "Grade" },
  { key: "other", label: "Other" },
];

export const SCORE_RANGES: Record<string, { min: number; max: number }> = {
  percentage: { min: 0, max: 100 },
  cgpa_10: { min: 0, max: 10 },
  cgpa_4: { min: 0, max: 4 },
};

export const SUBJECT_OPTIONS: OptionDef[] = [
  { key: "mathematics", label: "Mathematics" },
  { key: "physics", label: "Physics" },
  { key: "chemistry", label: "Chemistry" },
  { key: "biology", label: "Biology" },
  { key: "computer_science", label: "Computer Science" },
  { key: "english", label: "English" },
  { key: "economics", label: "Economics" },
  { key: "business_studies", label: "Business Studies" },
  { key: "accounting", label: "Accounting" },
  { key: "geography", label: "Geography" },
  { key: "history", label: "History" },
  { key: "design_art", label: "Design / Art" },
  { key: "other", label: "Other" },
];

export const SUBJECT_RATING_LABELS: Record<number, string> = {
  1: "Weak / dislike",
  2: "Below average",
  3: "Comfortable",
  4: "Above average",
  5: "Very strong / enjoy",
};

export const INTEREST_OPTIONS: OptionDef[] = [
  { key: "automotive", label: "Cars / Automotive" },
  { key: "machines", label: "Machines" },
  { key: "marine", label: "Ships / Marine" },
  { key: "aviation", label: "Aviation" },
  { key: "electronics", label: "Electronics" },
  { key: "robotics", label: "Robotics" },
  { key: "computers", label: "Computers" },
  { key: "programming", label: "Programming" },
  { key: "ai_data", label: "AI / Data" },
  { key: "gaming", label: "Gaming" },
  { key: "finance", label: "Finance" },
  { key: "investing_trading", label: "Investing / Trading" },
  { key: "business", label: "Business" },
  { key: "entrepreneurship", label: "Entrepreneurship" },
  { key: "marketing", label: "Marketing" },
  { key: "sales", label: "Sales" },
  { key: "healthcare", label: "Healthcare" },
  { key: "biology_science", label: "Biology" },
  { key: "research", label: "Research" },
  { key: "environment", label: "Environment" },
  { key: "energy", label: "Energy" },
  { key: "construction", label: "Construction" },
  { key: "architecture", label: "Architecture" },
  { key: "design", label: "Design" },
  { key: "art", label: "Art" },
  { key: "writing", label: "Writing" },
  { key: "media", label: "Media" },
  { key: "law", label: "Law" },
  { key: "politics_public_policy", label: "Politics / Public policy" },
  { key: "teaching", label: "Teaching" },
  { key: "psychology", label: "Psychology" },
  { key: "helping_people", label: "Helping people" },
  { key: "leadership", label: "Leadership" },
  { key: "travel", label: "Travel" },
  { key: "sports", label: "Sports" },
  { key: "logistics_operations", label: "Logistics / Operations" },
  { key: "food_hospitality", label: "Food / Hospitality" },
  { key: "fashion", label: "Fashion" },
  { key: "other", label: "Other" },
];

export const INTEREST_STRENGTH_LABELS: Record<number, string> = {
  1: "Curious",
  2: "Somewhat interested",
  3: "Interested",
  4: "Very interested",
  5: "Passionate about this",
};

export const TECHNICAL_SKILL_OPTIONS: OptionDef[] = [
  { key: "programming", label: "Programming" },
  { key: "python", label: "Python" },
  { key: "javascript", label: "JavaScript" },
  { key: "cad", label: "CAD" },
  { key: "solidworks", label: "SolidWorks" },
  { key: "autocad", label: "AutoCAD" },
  { key: "matlab", label: "MATLAB" },
  { key: "excel", label: "Excel" },
  { key: "data_analysis", label: "Data analysis" },
  { key: "electronics", label: "Electronics" },
  { key: "mechanical_design", label: "Mechanical design" },
  { key: "writing", label: "Writing" },
  { key: "graphic_design", label: "Graphic design" },
  { key: "video_editing", label: "Video editing" },
];

export const TRANSFERABLE_SKILL_OPTIONS: OptionDef[] = [
  { key: "communication", label: "Communication" },
  { key: "presentation", label: "Presentation" },
  { key: "leadership", label: "Leadership" },
  { key: "teamwork", label: "Teamwork" },
  { key: "problem_solving", label: "Problem solving" },
  { key: "analytical_thinking", label: "Analytical thinking" },
  { key: "creativity", label: "Creativity" },
  { key: "organization", label: "Organization" },
  { key: "negotiation", label: "Negotiation" },
  { key: "research", label: "Research" },
];

export const SKILL_LEVEL_OPTIONS: OptionDef[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

/**
 * Work-preference statements. `key` is the stable scoring key the future
 * recommendation engine will read (e.g. `technical_problem_solving`) — see
 * Milestone 3 summary section "Stable scoring keys".
 */
export const WORK_PREFERENCE_OPTIONS: OptionDef[] = [
  { key: "enjoys_numbers", label: "I enjoy working with numbers." },
  { key: "technical_problem_solving", label: "I enjoy solving technical problems." },
  { key: "enjoys_people", label: "I enjoy working with people." },
  { key: "enjoys_designing_creating", label: "I like designing or creating things." },
  { key: "enjoys_machines", label: "I enjoy working with machines." },
  { key: "prefers_computer_based_work", label: "I prefer computer-based work." },
  { key: "enjoys_research_analysis", label: "I enjoy research and deep analysis." },
  { key: "enjoys_persuading_selling", label: "I enjoy persuading / selling / negotiating." },
  { key: "enjoys_leading_teams", label: "I enjoy leading teams." },
  { key: "likes_field_work", label: "I like field work." },
  { key: "likes_office_work", label: "I like office work." },
  { key: "likes_laboratory_work", label: "I like laboratory work." },
  { key: "prefers_structured_work", label: "I prefer structured work." },
  { key: "prefers_flexible_creative_work", label: "I prefer flexible / creative work." },
  { key: "comfortable_repetitive_tasks", label: "I am comfortable with repetitive tasks." },
  { key: "prefers_independent_work", label: "I prefer working independently." },
  { key: "prefers_teamwork", label: "I prefer teamwork." },
  { key: "enjoys_high_pressure", label: "I enjoy high-pressure environments." },
  { key: "prefers_stable_predictable_work", label: "I prefer predictable/stable work." },
];

export const RATING_SCALE_LABELS: Record<number, string> = {
  1: "Strongly disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly agree",
};

/** Career priorities. `key` is the stable scoring key (e.g. `high_salary`). */
export const CAREER_PRIORITY_OPTIONS: OptionDef[] = [
  { key: "high_salary", label: "High salary" },
  { key: "job_security", label: "Job security" },
  { key: "work_life_balance", label: "Work-life balance" },
  { key: "international_career", label: "International career" },
  { key: "work_abroad_opportunity", label: "Opportunity to work abroad" },
  { key: "creativity", label: "Creativity" },
  { key: "leadership", label: "Leadership" },
  { key: "social_impact", label: "Social impact" },
  { key: "prestige", label: "Prestige" },
  { key: "remote_work", label: "Remote work" },
  { key: "entrepreneurship", label: "Entrepreneurship" },
  { key: "research", label: "Research" },
  { key: "fast_career_growth", label: "Fast career growth" },
  { key: "stable_location", label: "Stable location" },
  { key: "travel", label: "Travel" },
  { key: "government_public_sector", label: "Government/public-sector opportunity" },
];

export const CAREER_GOAL_CLARITY_OPTIONS: OptionDef[] = [
  { key: "clear", label: "Yes, clearly" },
  { key: "some_ideas", label: "I have some ideas" },
  { key: "not_sure", label: "Not sure at all" },
];

export const YES_NO_MAYBE_OPTIONS: OptionDef[] = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
  { key: "maybe", label: "Maybe" },
];

export const COUNTRY_OPTIONS: OptionDef[] = [
  { key: "india", label: "India" },
  { key: "germany", label: "Germany" },
  { key: "uk", label: "UK" },
  { key: "ireland", label: "Ireland" },
  { key: "france", label: "France" },
  { key: "netherlands", label: "Netherlands" },
  { key: "sweden", label: "Sweden" },
  { key: "finland", label: "Finland" },
  { key: "italy", label: "Italy" },
  { key: "usa", label: "USA" },
  { key: "canada", label: "Canada" },
  { key: "australia", label: "Australia" },
  { key: "singapore", label: "Singapore" },
  { key: "uae", label: "UAE" },
  { key: "other", label: "Other" },
];

export const BUDGET_BAND_OPTIONS: OptionDef[] = [
  { key: "below_5l", label: "Below ₹5 lakh" },
  { key: "5_10l", label: "₹5–10 lakh" },
  { key: "10_20l", label: "₹10–20 lakh" },
  { key: "20_30l", label: "₹20–30 lakh" },
  { key: "30_50l", label: "₹30–50 lakh" },
  { key: "50l_plus", label: "₹50 lakh+" },
  { key: "not_sure", label: "Not sure" },
];

export const FUNDING_SOURCE_OPTIONS: OptionDef[] = [
  { key: "family_self_funded", label: "Family / self-funded" },
  { key: "scholarship_dependent", label: "Scholarship dependent" },
  { key: "education_loan_expected", label: "Education loan expected" },
  { key: "combination", label: "Combination" },
  { key: "not_sure", label: "Not sure" },
];

export const LOAN_OPENNESS_OPTIONS: OptionDef[] = YES_NO_MAYBE_OPTIONS;

export const EXPERIENCE_TYPE_OPTIONS: OptionDef[] = [
  { key: "internship", label: "Internship" },
  { key: "project", label: "Project" },
  { key: "competition", label: "Competition" },
  { key: "certification", label: "Certification" },
  { key: "work_experience", label: "Work experience" },
  { key: "extracurricular", label: "Extracurricular activity" },
];

export function labelFor(options: OptionDef[], key: string): string {
  return options.find((o) => o.key === key)?.label ?? key;
}
