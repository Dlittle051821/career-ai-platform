/**
 * Milestone 4 — Career Knowledge Base taxonomy.
 *
 * Two kinds of keys are used across the career dataset:
 *
 * 1. REUSED FROM MILESTONE 3 (student profile): subject_key, interest_key,
 *    skill_key, preference_key (work preferences), priority_key (career
 *    priorities). These come directly from `src/data/profile-options.ts` —
 *    re-exported here for convenience — so that a future Milestone 5
 *    scoring engine can compare a student's M3 answers against a career's
 *    M4 profile using the exact same keys, with zero mapping layer. Never
 *    invent a new key for these five concepts; if M3 is missing a concept
 *    a career genuinely needs, that's a taxonomy gap to raise, not
 *    something to route around here.
 *
 * 2. NEW IN MILESTONE 4 (M3 has no equivalent, so these are centralized
 *    here rather than improvised per career): field_key (degree/education
 *    field), industry_key, tag_key, and the career family taxonomy itself.
 *
 * `src/data/careers/*.ts` seed files must only use keys defined in this
 * file (or the M3 option lists) — `scripts/validate-career-data.ts`
 * enforces this and fails loudly on anything else.
 */

import {
  CAREER_PRIORITY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  INTEREST_OPTIONS,
  SUBJECT_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  type OptionDef,
} from "@/data/profile-options";

// ---------------------------------------------------------------------------
// Re-exported M3 taxonomy — the single source of truth stays profile-options.ts;
// this just saves every career-data file an extra import.
// ---------------------------------------------------------------------------
export const VALID_SUBJECT_KEYS: readonly string[] = SUBJECT_OPTIONS.map((o) => o.key);
export const VALID_INTEREST_KEYS: readonly string[] = INTEREST_OPTIONS.map((o) => o.key);
export const VALID_SKILL_KEYS: readonly string[] = [...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS].map(
  (o) => o.key
);
export const VALID_WORK_PREFERENCE_KEYS: readonly string[] = WORK_PREFERENCE_OPTIONS.map((o) => o.key);
export const VALID_CAREER_PRIORITY_KEYS: readonly string[] = CAREER_PRIORITY_OPTIONS.map((o) => o.key);
export const VALID_EDUCATION_LEVEL_KEYS: readonly string[] = EDUCATION_LEVEL_OPTIONS.map((o) => o.key);

// ---------------------------------------------------------------------------
// Career families (Milestone 4 §4) — stable, curated, matches migration
// 0003's career_families seed. `display_order` controls Explorer ordering.
// ---------------------------------------------------------------------------
export interface CareerFamilySeed {
  key: string;
  name: string;
  description: string;
  order: number;
}

export const CAREER_FAMILIES: CareerFamilySeed[] = [
  { key: "engineering", name: "Engineering", description: "Designing, building, and maintaining physical systems and machines.", order: 10 },
  { key: "automotive_mobility", name: "Automotive & Mobility", description: "Vehicles, electric mobility, and the systems that move people and goods on land.", order: 20 },
  { key: "marine_maritime", name: "Marine & Maritime", description: "Ships, ports, offshore structures, and life at sea.", order: 30 },
  { key: "aviation_aerospace", name: "Aviation & Aerospace", description: "Aircraft, spacecraft, and the systems that keep them flying safely.", order: 40 },
  { key: "technology_computing", name: "Technology & Computing", description: "Software, infrastructure, and the systems that power digital products.", order: 50 },
  { key: "data_ai", name: "Data & AI", description: "Extracting insight and building intelligent systems from data.", order: 60 },
  { key: "business_management", name: "Business & Management", description: "Running, growing, and improving organizations.", order: 70 },
  { key: "finance_economics", name: "Finance & Economics", description: "Managing money, risk, and capital for people and organizations.", order: 80 },
  { key: "healthcare_medicine", name: "Healthcare & Medicine", description: "Diagnosing, treating, and caring for patients.", order: 90 },
  { key: "life_sciences", name: "Life Sciences", description: "Studying living systems, from cells to ecosystems.", order: 100 },
  { key: "physical_sciences", name: "Physical Sciences", description: "Studying matter, energy, and the physical laws that govern them.", order: 110 },
  { key: "environment_sustainability", name: "Environment & Sustainability", description: "Protecting and managing the natural environment.", order: 120 },
  { key: "energy", name: "Energy", description: "Generating, storing, and distributing power — conventional and renewable.", order: 130 },
  { key: "architecture_built_environment", name: "Architecture & Built Environment", description: "Designing and planning buildings, cities, and infrastructure.", order: 140 },
  { key: "design_creative", name: "Design & Creative", description: "Shaping how products, brands, and experiences look and feel.", order: 150 },
  { key: "media_communication", name: "Media & Communication", description: "Telling stories and sharing information at scale.", order: 160 },
  { key: "law_legal", name: "Law & Legal", description: "Interpreting and applying the law.", order: 170 },
  { key: "government_public_policy", name: "Government & Public Policy", description: "Public administration and shaping policy that affects society.", order: 180 },
  { key: "education", name: "Education", description: "Teaching, training, and shaping how others learn.", order: 190 },
  { key: "psychology_human_services", name: "Psychology & Human Services", description: "Understanding and supporting people's mental health and wellbeing.", order: 200 },
  { key: "sales_marketing", name: "Sales & Marketing", description: "Understanding customers and growing demand for products and services.", order: 210 },
  { key: "operations_supply_chain", name: "Operations & Supply Chain", description: "Making sure the right things get to the right place, efficiently.", order: 220 },
  { key: "hospitality_tourism", name: "Hospitality & Tourism", description: "Hosting, travel, and guest experience.", order: 230 },
  { key: "sports", name: "Sports", description: "Performance, coaching, and the business of sport.", order: 240 },
  { key: "research_academia", name: "Research & Academia", description: "Advancing knowledge through research and higher education.", order: 250 },
  { key: "entrepreneurship", name: "Entrepreneurship", description: "Building new ventures from the ground up.", order: 260 },
];

export const VALID_FAMILY_KEYS: readonly string[] = CAREER_FAMILIES.map((f) => f.key);

// ---------------------------------------------------------------------------
// Fields of study (Milestone 4 only — M3 stores free-text field_of_study,
// so there is no existing controlled vocabulary to reuse). Used by
// `career_education_routes.field_key` / `specialization_key`.
// ---------------------------------------------------------------------------
export const FIELD_OF_STUDY_OPTIONS: OptionDef[] = [
  // Engineering
  { key: "mechanical_engineering", label: "Mechanical Engineering" },
  { key: "electrical_engineering", label: "Electrical Engineering" },
  { key: "electronics_engineering", label: "Electronics & Communication Engineering" },
  { key: "computer_science_engineering", label: "Computer Science Engineering" },
  { key: "information_technology", label: "Information Technology" },
  { key: "civil_engineering", label: "Civil Engineering" },
  { key: "chemical_engineering", label: "Chemical Engineering" },
  { key: "industrial_engineering", label: "Industrial Engineering" },
  { key: "mechatronics_engineering", label: "Mechatronics Engineering" },
  { key: "robotics_engineering", label: "Robotics Engineering" },
  { key: "automotive_engineering", label: "Automotive Engineering" },
  { key: "electric_mobility", label: "Electric Mobility / EV Engineering" },
  { key: "aerospace_engineering", label: "Aerospace Engineering" },
  { key: "aeronautical_engineering", label: "Aeronautical Engineering" },
  { key: "marine_engineering", label: "Marine Engineering" },
  { key: "naval_architecture", label: "Naval Architecture & Ocean Engineering" },
  { key: "biomedical_engineering", label: "Biomedical Engineering" },
  { key: "instrumentation_engineering", label: "Instrumentation Engineering" },
  { key: "production_engineering", label: "Production / Manufacturing Engineering" },
  { key: "metallurgical_engineering", label: "Metallurgical & Materials Engineering" },
  { key: "environmental_engineering", label: "Environmental Engineering" },
  { key: "control_systems", label: "Control Systems Engineering" },
  { key: "energy_engineering", label: "Energy Engineering" },

  // Computing
  { key: "computer_science", label: "Computer Science" },
  { key: "software_engineering", label: "Software Engineering" },
  { key: "data_science", label: "Data Science" },
  { key: "artificial_intelligence", label: "Artificial Intelligence & Machine Learning" },
  { key: "cybersecurity", label: "Cybersecurity" },

  // Business / finance
  { key: "business_administration", label: "Business Administration (BBA/MBA)" },
  { key: "commerce", label: "Commerce (B.Com/M.Com)" },
  { key: "accounting_finance", label: "Accounting & Finance" },
  { key: "economics", label: "Economics" },
  { key: "chartered_accountancy", label: "Chartered Accountancy (CA)" },
  { key: "actuarial_science", label: "Actuarial Science" },
  { key: "company_secretary", label: "Company Secretary (CS)" },

  // Sciences
  { key: "physics", label: "Physics" },
  { key: "chemistry", label: "Chemistry" },
  { key: "mathematics", label: "Mathematics" },
  { key: "statistics", label: "Statistics" },
  { key: "biology", label: "Biology" },
  { key: "biotechnology", label: "Biotechnology" },
  { key: "microbiology", label: "Microbiology" },
  { key: "environmental_science", label: "Environmental Science" },
  { key: "geology", label: "Geology" },
  { key: "marine_science", label: "Marine Science / Oceanography" },
  { key: "food_science", label: "Food Science & Technology" },

  // Design / architecture
  { key: "architecture", label: "Architecture (B.Arch)" },
  { key: "urban_planning", label: "Urban & Regional Planning" },
  { key: "industrial_design", label: "Industrial / Product Design" },
  { key: "interior_design", label: "Interior Design" },
  { key: "fashion_design", label: "Fashion Design" },
  { key: "graphic_design", label: "Graphic / Visual Design" },
  { key: "ux_design", label: "UX / Interaction Design" },
  { key: "fine_arts", label: "Fine Arts" },

  // Medicine / health
  { key: "medicine_mbbs", label: "Medicine (MBBS)" },
  { key: "dentistry_bds", label: "Dentistry (BDS)" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "physiotherapy", label: "Physiotherapy" },
  { key: "nursing", label: "Nursing" },
  { key: "public_health", label: "Public Health" },
  { key: "veterinary_science", label: "Veterinary Science" },

  // Law / social / humanities
  { key: "law_llb", label: "Law (LLB)" },
  { key: "political_science", label: "Political Science" },
  { key: "public_administration", label: "Public Administration" },
  { key: "psychology", label: "Psychology" },
  { key: "sociology", label: "Sociology" },
  { key: "journalism_mass_communication", label: "Journalism & Mass Communication" },
  { key: "international_relations", label: "International Relations" },
  { key: "education_bed", label: "Education (B.Ed)" },

  // Other applied fields
  { key: "hospitality_management", label: "Hotel & Hospitality Management" },
  { key: "aviation_management", label: "Aviation Management" },
  { key: "supply_chain_management", label: "Supply Chain / Logistics Management" },
  { key: "agriculture", label: "Agriculture" },
  { key: "other", label: "Other / Not education-specific" },
];

export const VALID_FIELD_KEYS: readonly string[] = FIELD_OF_STUDY_OPTIONS.map((o) => o.key);

// ---------------------------------------------------------------------------
// Industries (Milestone 4 §12)
// ---------------------------------------------------------------------------
export const INDUSTRY_OPTIONS: OptionDef[] = [
  { key: "automotive", label: "Automotive" },
  { key: "ev_mobility", label: "EV / Mobility" },
  { key: "aerospace", label: "Aerospace" },
  { key: "marine", label: "Marine" },
  { key: "shipping", label: "Shipping" },
  { key: "energy", label: "Energy" },
  { key: "renewable_energy", label: "Renewable Energy" },
  { key: "oil_gas", label: "Oil & Gas" },
  { key: "manufacturing", label: "Manufacturing" },
  { key: "robotics", label: "Robotics" },
  { key: "software", label: "Software" },
  { key: "ai", label: "AI" },
  { key: "data", label: "Data" },
  { key: "cybersecurity", label: "Cybersecurity" },
  { key: "banking", label: "Banking" },
  { key: "investment", label: "Investment" },
  { key: "consulting", label: "Consulting" },
  { key: "healthcare", label: "Healthcare" },
  { key: "pharma", label: "Pharma" },
  { key: "biotechnology", label: "Biotechnology" },
  { key: "construction", label: "Construction" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "architecture", label: "Architecture" },
  { key: "logistics", label: "Logistics" },
  { key: "supply_chain", label: "Supply Chain" },
  { key: "government", label: "Government" },
  { key: "education", label: "Education" },
  { key: "media", label: "Media" },
  { key: "retail", label: "Retail" },
  { key: "hospitality", label: "Hospitality" },
  { key: "research", label: "Research" },
];

export const VALID_INDUSTRY_KEYS: readonly string[] = INDUSTRY_OPTIONS.map((o) => o.key);

// ---------------------------------------------------------------------------
// Career tags (Milestone 4 §13) — deliberately small and generic.
// ---------------------------------------------------------------------------
export const CAREER_TAG_OPTIONS: OptionDef[] = [
  { key: "stem", label: "STEM" },
  { key: "non_stem", label: "Non-STEM" },
  { key: "technical", label: "Technical" },
  { key: "creative", label: "Creative" },
  { key: "people_focused", label: "People-focused" },
  { key: "analytical", label: "Analytical" },
  { key: "field_based", label: "Field-based" },
  { key: "office_based", label: "Office-based" },
  { key: "high_growth", label: "High-growth" },
  { key: "international", label: "International" },
  { key: "research_heavy", label: "Research-heavy" },
  { key: "management", label: "Management" },
  { key: "client_facing", label: "Client-facing" },
  { key: "regulated_profession", label: "Regulated profession" },
];

export const VALID_TAG_KEYS: readonly string[] = CAREER_TAG_OPTIONS.map((o) => o.key);

// ---------------------------------------------------------------------------
// CareerSeed — the shape every src/data/careers/*.ts file's array must match.
// This is intentionally NOT the database row shape (snake_case Insert
// types live in src/types/database.ts) — this is the authoring shape;
// scripts/generate-career-seed-sql.ts converts it to SQL.
// ---------------------------------------------------------------------------
export type DataQualityStatus = "draft" | "reviewed" | "approved";
export type FitRelevance = "primary" | "common" | "alternative";
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface CareerScores {
  internationalMobility?: number;
  remoteWork?: number;
  entrepreneurship?: number;
  salaryPotential?: number;
  jobSecurity?: number;
  creativity?: number;
  socialImpact?: number;
  leadershipOpportunity?: number;
  travel?: number;
  researchIntensity?: number;
  technicalDepth?: number;
}

export interface CareerSubjectFit {
  subjectKey: string;
  importance: number;
  minimumStrength?: number;
}

export interface CareerInterestFit {
  interestKey: string;
  importance: number;
}

export interface CareerSkillFit {
  skillKey: string;
  importance: number;
  recommendedLevel: SkillLevel;
}

export interface CareerWorkPreferenceFit {
  preferenceKey: string;
  score: number;
}

export interface CareerPriorityFit {
  priorityKey: string;
  score: number;
}

export interface CareerEducationRoute {
  educationLevel: string;
  fieldKey: string;
  specializationKey?: string;
  relevance: FitRelevance;
  notes?: string;
}

export interface CareerSeed {
  /** Stable, unique, snake_case. Never renamed once approved (M5 will key off this). */
  careerKey: string;
  familyKey: string;
  title: string;
  shortTitle?: string;
  /** Unique, kebab-case, used in /careers/[slug]. */
  slug: string;
  summary: string;
  whatYouDo: string;
  typicalEnvironment: string;
  careerOutlookSummary?: string;
  typicalEntryLevel: string;
  minimumEducationKey?: string;
  scores?: CareerScores;
  isFeatured?: boolean;
  dataQualityStatus: DataQualityStatus;
  subjects: CareerSubjectFit[];
  interests: CareerInterestFit[];
  skills: CareerSkillFit[];
  workPreferences: CareerWorkPreferenceFit[];
  careerPriorities: CareerPriorityFit[];
  educationRoutes: CareerEducationRoute[];
  industryKeys: string[];
  tagKeys: string[];
  aliases?: string[];
  /** Optional manual curation — career_key values of related careers. Falls back to same-family lookup if omitted. */
  relatedCareerKeys?: string[];
}
