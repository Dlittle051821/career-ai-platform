/**
 * Hand-written typing for the database shape — Milestone 2's `profiles`
 * table plus Milestone 3's `student_*` tables. Structured to match what the
 * Supabase CLI's `supabase gen types typescript` command would generate, so
 * this file can be swapped for a generated one later without touching call
 * sites.
 *
 * Each table's Row/Insert/Update is built from a standalone named type
 * rather than indexing back into `Database[...]` from within its own
 * declaration — this is simply the cleaner pattern and matches generated
 * output. Every table also carries `Relationships: []`, and the schema
 * carries empty `Views`/`Functions` (`{ [_ in never]: never }`): the
 * Supabase client's generic inference requires this exact shape
 * (`GenericTable`/`GenericSchema` from `@supabase/postgrest-js`) to resolve
 * `Database["public"]["Tables"][...]` at all — get any of it wrong and
 * every table in the schema silently collapses to `never` with no error at
 * the `Database` declaration itself (only at each call site that reads a
 * row field or inserts a row, far from the real cause). See
 * `TimestampedInsert` below for the specific mistake that caused this here.
 *
 * Row/Insert/Update shapes are snake_case, matching the database exactly.
 * Application code works with the camelCase domain types in
 * src/types/student-profile.ts instead — the mapping between the two lives
 * only in src/lib/supabase/student-profile.ts.
 */

// A plain `type` alias, not an `interface` — intersecting an `interface`
// into a table's `Insert`/`Update` (e.g. `Omit<Row, ...> & TimestampedInsert`)
// silently breaks the Supabase client's whole-schema `Tables extends
// Record<string, GenericTable>` check (interfaces don't get the same
// implicit-index-signature treatment type literals do), which is what
// collapsed every table to `never` even though each one looked correct in
// isolation. Keep this a `type`, not an `interface`.
type TimestampedInsert = {
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// profiles (Milestone 2)
// ---------------------------------------------------------------------------
type ProfilesRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  marketing_consent: boolean;
  account_type: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_profiles (Milestone 3)
// ---------------------------------------------------------------------------
type StudentProfilesRow = {
  user_id: string;
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  country: string;
  preferred_language: string | null;
  current_status: string | null;
  profile_status: string;
  profile_completion_percent: number;
  onboarding_current_step: number;
  // Milestone 11-B — see 0013_assisted_onboarding_and_recommendation_readiness.sql PART 1.
  onboarding_path: string | null;
  onboarding_path_chosen_at: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_education
// ---------------------------------------------------------------------------
type StudentEducationRow = {
  id: string;
  user_id: string;
  education_level: string;
  institution_name: string | null;
  board_or_university: string | null;
  field_of_study: string | null;
  specialization: string | null;
  start_year: number | null;
  end_year: number | null;
  status: string;
  score_type: string | null;
  score_value: number | null;
  backlogs: number | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_subject_strengths
// ---------------------------------------------------------------------------
type StudentSubjectStrengthsRow = {
  id: string;
  user_id: string;
  subject_key: string;
  rating: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_interests
// ---------------------------------------------------------------------------
type StudentInterestsRow = {
  id: string;
  user_id: string;
  interest_key: string;
  strength: number | null;
  other_text: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_skills
// ---------------------------------------------------------------------------
type StudentSkillsRow = {
  id: string;
  user_id: string;
  skill_key: string;
  level: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_work_preferences
// ---------------------------------------------------------------------------
type StudentWorkPreferencesRow = {
  id: string;
  user_id: string;
  preference_key: string;
  rating: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_career_priorities
// ---------------------------------------------------------------------------
type StudentCareerPrioritiesRow = {
  id: string;
  user_id: string;
  priority_key: string;
  rating: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_career_goals
// ---------------------------------------------------------------------------
type StudentCareerGoalsRow = {
  user_id: string;
  clarity: string | null;
  dream_job_title: string | null;
  dream_industry: string | null;
  dream_reason: string | null;
  career_ideas: string[];
  life_goals_text: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_study_preferences
// ---------------------------------------------------------------------------
type StudentStudyPreferencesRow = {
  user_id: string;
  study_further: string | null;
  study_abroad: string | null;
  preferred_study_destinations: string[];
  preferred_work_destinations: string[];
  relocate_within_india: string | null;
  relocate_international: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_funding_preferences
// ---------------------------------------------------------------------------
type StudentFundingPreferencesRow = {
  user_id: string;
  budget_band: string | null;
  funding_source: string | null;
  loan_openness: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// student_experience
// ---------------------------------------------------------------------------
type StudentExperienceRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  organization: string | null;
  description: string | null;
  year: number | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// career_families (Milestone 4)
// ---------------------------------------------------------------------------
type CareerFamiliesRow = {
  id: string;
  family_key: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// careers
// ---------------------------------------------------------------------------
type CareersRow = {
  id: string;
  career_key: string;
  family_id: string;
  title: string;
  short_title: string | null;
  slug: string;
  summary: string;
  what_you_do: string;
  typical_environment: string;
  career_outlook_summary: string | null;
  typical_entry_level: string;
  minimum_education_key: string | null;
  international_mobility_score: number | null;
  remote_work_score: number | null;
  entrepreneurship_score: number | null;
  salary_potential_score: number | null;
  job_security_score: number | null;
  creativity_score: number | null;
  social_impact_score: number | null;
  leadership_opportunity_score: number | null;
  travel_score: number | null;
  research_intensity_score: number | null;
  technical_depth_score: number | null;
  is_active: boolean;
  is_featured: boolean;
  data_quality_status: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// career_subject_requirements
// ---------------------------------------------------------------------------
type CareerSubjectRequirementsRow = {
  id: string;
  career_id: string;
  subject_key: string;
  importance: number;
  minimum_strength: number | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_interest_requirements
// ---------------------------------------------------------------------------
type CareerInterestRequirementsRow = {
  id: string;
  career_id: string;
  interest_key: string;
  importance: number;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_skill_requirements
// ---------------------------------------------------------------------------
type CareerSkillRequirementsRow = {
  id: string;
  career_id: string;
  skill_key: string;
  importance: number;
  recommended_level: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_work_preference_profile
// ---------------------------------------------------------------------------
type CareerWorkPreferenceProfileRow = {
  id: string;
  career_id: string;
  preference_key: string;
  score: number;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_priority_profile
// ---------------------------------------------------------------------------
type CareerPriorityProfileRow = {
  id: string;
  career_id: string;
  priority_key: string;
  score: number;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_education_routes
// ---------------------------------------------------------------------------
type CareerEducationRoutesRow = {
  id: string;
  career_id: string;
  education_level: string;
  field_key: string;
  specialization_key: string | null;
  relevance: string;
  notes: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// industries
// ---------------------------------------------------------------------------
type IndustriesRow = {
  id: string;
  industry_key: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// career_industries (junction, composite PK — no id column)
// ---------------------------------------------------------------------------
type CareerIndustriesRow = {
  career_id: string;
  industry_id: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_tags
// ---------------------------------------------------------------------------
type CareerTagsRow = {
  id: string;
  tag_key: string;
  label: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_tag_map (junction, composite PK — no id column)
// ---------------------------------------------------------------------------
type CareerTagMapRow = {
  career_id: string;
  tag_id: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_aliases
// ---------------------------------------------------------------------------
type CareerAliasesRow = {
  id: string;
  career_id: string;
  alias: string;
  normalized_alias: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// career_related (junction, composite PK — no id column)
// ---------------------------------------------------------------------------
type CareerRelatedRow = {
  career_id: string;
  related_career_id: string;
  display_order: number;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Generic JSON type for jsonb columns (Milestone 7 uses this for
// admin_audit_log.changes/context and applications.deadlines).
// ---------------------------------------------------------------------------
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// admin_roles (Milestone 7)
// ---------------------------------------------------------------------------
type AdminRolesRow = {
  user_id: string;
  role: string;
  granted_by: string | null;
  granted_at: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// counsellors (Milestone 7)
// ---------------------------------------------------------------------------
type CounsellorsRow = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  specializations: string[];
  regions: string[];
  is_active: boolean;
  capacity: number | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// universities (Milestone 7)
// ---------------------------------------------------------------------------
type UniversitiesRow = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  website: string | null;
  institution_type: string | null;
  summary: string | null;
  accreditation_status: string;
  is_active: boolean;
  is_visible: boolean;
  internal_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Milestone 9 additions (supabase/migrations/0006_global_university_course_data.sql PART 2):
  country_id: string | null;
  state_region: string | null;
  street_address: string | null;
  postal_code: string | null;
  admissions_url: string | null;
  international_admissions_url: string | null;
  ownership_type: string | null;
  founding_year: number | null;
  accreditation_organization: string | null;
  ranking: Json;
  study_levels: string[];
  study_modes: string[];
  campus_info: string | null;
  logo_url: string | null;
  international_student_support: string | null;
  scholarships_available: boolean | null;
  application_fee_minor_units: number | null;
  application_fee_currency: string | null;
  publication_status: string;
  data_source: string | null;
  source_url: string | null;
  source_access_date: string | null;
  last_verified_at: string | null;
  verification_status: string;
  merged_into_id: string | null;
  search_vector: unknown;
};

// ---------------------------------------------------------------------------
// courses (Milestone 7)
// ---------------------------------------------------------------------------
type CoursesRow = {
  id: string;
  university_id: string;
  name: string;
  slug: string;
  education_level: string | null;
  field_of_study: string | null;
  duration_text: string | null;
  delivery_mode: string | null;
  campus_location: string | null;
  intake_info: string | null;
  tuition_amount_minor_units: number | null;
  tuition_currency: string;
  tuition_period: string | null;
  entry_requirements_summary: string | null;
  application_url: string | null;
  is_active: boolean;
  is_visible: boolean;
  data_quality_status: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  // Milestone 9 additions (supabase/migrations/0006_global_university_course_data.sql PART 4):
  campus_id: string | null;
  program_code: string | null;
  subject_area: string | null;
  discipline: string | null;
  qualification_title: string | null;
  award: string | null;
  duration_value: number | null;
  duration_unit: string | null;
  study_pace: string | null;
  teaching_language: string | null;
  tuition_domestic_or_international: string | null;
  additional_fees_summary: string | null;
  application_fee_minor_units: number | null;
  application_fee_currency: string | null;
  course_url: string | null;
  intake_periods: string[];
  min_academic_requirement: string | null;
  english_requirements: Json;
  standardized_test_requirements: Json;
  work_experience_required: string | null;
  portfolio_required: boolean | null;
  interview_required: boolean | null;
  study_gap_policy: string | null;
  additional_documents_required: string[];
  scholarships_available: boolean | null;
  career_outcomes: string | null;
  professional_accreditation: string | null;
  publication_status: string;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  verification_status: string;
  merged_into_id: string | null;
  search_vector: unknown;
};

// ---------------------------------------------------------------------------
// Milestone 9 — Global University and Course Data Platform
// (supabase/migrations/0006_global_university_course_data.sql)
// ---------------------------------------------------------------------------

type CountriesRow = {
  id: string;
  iso_alpha2: string;
  iso_alpha3: string;
  name: string;
  region: string | null;
  subregion: string | null;
  currency_code: string | null;
  default_language: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CampusesRow = {
  id: string;
  university_id: string;
  name: string;
  country_id: string | null;
  state_region: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_main: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type CourseIntakesRow = {
  id: string;
  course_id: string;
  intake_name: string;
  start_month: number | null;
  start_year: number | null;
  applications_open_at: string | null;
  priority_deadline: string | null;
  final_deadline: string | null;
  international_deadline: string | null;
  capacity_status: string;
  intake_status: string;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type CourseTuitionFeesRow = {
  id: string;
  course_id: string;
  student_category: string;
  amount_minor_units: number;
  currency_code: string;
  academic_year: string;
  billing_period: string | null;
  mandatory_fees_minor_units: number;
  estimated_living_costs_minor_units: number | null;
  estimated_living_costs_period: string | null;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type CourseAdmissionRequirementsRow = {
  id: string;
  course_id: string;
  country_context_id: string | null;
  accepted_qualification: string;
  minimum_grade: string | null;
  minimum_gpa: number | null;
  required_subjects: string[];
  language_test: string | null;
  language_test_min_score: number | null;
  standardized_test: string | null;
  standardized_test_min_score: number | null;
  work_experience_required: string | null;
  portfolio_required: boolean;
  interview_required: boolean;
  additional_documents: string[];
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type ScholarshipsRow = {
  id: string;
  scope: string;
  university_id: string | null;
  course_id: string | null;
  name: string;
  eligibility: string | null;
  award_amount_minor_units: number | null;
  award_description: string | null;
  currency_code: string | null;
  deadline: string | null;
  scholarship_url: string | null;
  international_eligible: boolean | null;
  is_active: boolean;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type EducationDataProvenanceRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  source_provider: string | null;
  source_type: string;
  source_url: string | null;
  source_record_id: string | null;
  retrieved_at: string | null;
  last_verified_at: string | null;
  import_batch_id: string | null;
  raw_record_checksum: string | null;
  verification_status: string;
  data_quality_status: string;
  created_at: string;
  updated_at: string;
};

type EducationImportBatchesRow = {
  id: string;
  entity_type: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  total_records: number;
  successful_records: number;
  rejected_records: number;
  warning_count: number;
  dry_run: boolean;
  duplicate_strategy: string;
  started_at: string | null;
  completed_at: string | null;
  initiated_by: string | null;
  raw_file_checksum: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type EducationImportRowsRow = {
  id: string;
  import_batch_id: string;
  row_number: number;
  raw_data: Json;
  status: string;
  errors: Json;
  warnings: Json;
  duplicate_of_entity_id: string | null;
  resulting_entity_id: string | null;
  created_at: string;
};

type EducationDuplicateCandidatesRow = {
  id: string;
  entity_type: string;
  primary_entity_id: string;
  candidate_entity_id: string;
  match_score: number;
  match_signals: Json;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
};

type EducationSavedItemsRow = {
  id: string;
  student_user_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
};

type EducationIntakeInterestsRow = {
  id: string;
  student_user_id: string;
  course_intake_id: string;
  created_at: string;
};

type EducationCourseSharesRow = {
  id: string;
  student_user_id: string;
  course_id: string;
  counsellor_id: string | null;
  message: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// admin_student_meta / admin_student_notes (Milestone 7)
// ---------------------------------------------------------------------------
type AdminStudentMetaRow = {
  student_user_id: string;
  status: string;
  assigned_counsellor_id: string | null;
  created_at: string;
  updated_at: string;
};

type AdminStudentNotesRow = {
  id: string;
  student_user_id: string;
  author_user_id: string | null;
  note: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// leads / lead_status_history (Milestone 7)
// ---------------------------------------------------------------------------
type LeadsRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  campaign: string | null;
  stage: string;
  priority: string;
  assigned_counsellor_id: string | null;
  next_follow_up_date: string | null;
  last_contact_date: string | null;
  consent_marketing: boolean;
  notes: string | null;
  converted_student_user_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string | null;
  created_at: string;
  updated_at: string;
};

type LeadStatusHistoryRow = {
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// applications / application_status_history (Milestone 7)
// ---------------------------------------------------------------------------
type ApplicationsRow = {
  id: string;
  student_user_id: string;
  university_id: string | null;
  course_id: string | null;
  assigned_counsellor_id: string | null;
  stage: string;
  intake: string | null;
  submission_date: string | null;
  decision_status: string;
  offer_type: string | null;
  deadlines: Json;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_date: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicationStatusHistoryRow = {
  id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// payments (Milestone 7 — operational tracking only, see 0004 migration)
// ---------------------------------------------------------------------------
type PaymentsRow = {
  id: string;
  student_user_id: string | null;
  application_id: string | null;
  invoice_reference: string | null;
  amount_minor_units: number;
  currency: string;
  payment_type: string | null;
  payment_method_label: string | null;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  external_transaction_reference: string | null;
  refund_status: string;
  refund_amount_minor_units: number | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// agreements (Milestone 7)
// ---------------------------------------------------------------------------
type AgreementsRow = {
  id: string;
  agreement_type: string;
  student_user_id: string | null;
  lead_id: string | null;
  counsellor_id: string | null;
  university_id: string | null;
  version: string | null;
  status: string;
  effective_date: string | null;
  expiry_date: string | null;
  document_reference_url: string | null;
  signature_status: string;
  // Milestone 11-A (F-123) — see 0012_electronic_stamping_and_assisted_onboarding.sql PART 2.
  stamp_sign_sequence: string | null;
  stamp_status: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// agreement_versions / signature_requests / signature_webhook_events
// (Milestone 10 — Electronic Signature Integration, F-122)
// ---------------------------------------------------------------------------
type AgreementVersionsRow = {
  id: string;
  agreement_id: string;
  version_number: number;
  content_reference_url: string | null;
  content_notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SignatureRequestsRow = {
  id: string;
  agreement_id: string;
  agreement_version_id: string;
  provider: string;
  provider_request_id: string | null;
  status: string;
  signer_user_id: string | null;
  signer_name: string;
  signer_email: string;
  requested_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  signed_document_storage_path: string | null;
  provider_metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SignatureWebhookEventsRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  processing_status: string;
  related_signature_request_id: string | null;
  related_agreement_id: string | null;
  diagnostic_message: string | null;
  payload_summary: Json | null;
  created_at: string;
  processed_at: string | null;
};

// ---------------------------------------------------------------------------
// stamp_requests / stamp_webhook_events (Milestone 11-A — Electronic
// Stamping, F-123). See 0012_electronic_stamping_and_assisted_onboarding.sql.
// ---------------------------------------------------------------------------
type StampRequestsRow = {
  id: string;
  agreement_id: string;
  agreement_version_id: string;
  provider: string;
  provider_request_id: string | null;
  status: string;
  jurisdiction: string | null;
  state: string | null;
  document_type: string | null;
  stamp_value: number | null;
  currency: string;
  requested_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  stamped_document_storage_path: string | null;
  provider_metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type StampWebhookEventsRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  processing_status: string;
  related_stamp_request_id: string | null;
  related_agreement_id: string | null;
  diagnostic_message: string | null;
  payload_summary: Json | null;
  created_at: string;
  processed_at: string | null;
};

// ---------------------------------------------------------------------------
// discovery_sessions / discovery_session_workspace /
// student_profile_section_provenance / student_recommendation_verifications
// (Milestone 11-B/C — Assisted Onboarding Revision). See
// 0013_assisted_onboarding_and_recommendation_readiness.sql.
// ---------------------------------------------------------------------------
type DiscoverySessionsRow = {
  id: string;
  student_user_id: string;
  session_type: string;
  status: string;
  assigned_counsellor_id: string | null;
  preferred_contact_method: string | null;
  preferred_time_range: string | null;
  preferred_language: string | null;
  student_notes: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
};

type DiscoverySessionWorkspaceRow = {
  session_id: string;
  student_basics: Json;
  academics: Json;
  interests: Json;
  goals: Json;
  budget_financial: Json;
  parent_sponsor_input: Json;
  student_uncertainty: Json;
  counsellor_notes: string | null;
  recommendation_readiness_notes: Json;
  missing_information: string[];
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type StudentProfileSectionProvenanceRow = {
  student_user_id: string;
  section_key: string;
  provenance: string;
  verified_by_counsellor_id: string | null;
  verified_at: string | null;
  last_updated_by: string | null;
  note: string | null;
  updated_at: string;
};

type StudentRecommendationVerificationsRow = {
  student_user_id: string;
  recommendation_type: string;
  verified_by_counsellor_id: string;
  verified_at: string;
  note: string | null;
};

// ---------------------------------------------------------------------------
// content_items (Milestone 7 CMS)
// ---------------------------------------------------------------------------
type ContentItemsRow = {
  id: string;
  content_type: string;
  slug: string;
  content_key: string | null;
  locale: string;
  title: string;
  body: string;
  status: string;
  sort_order: number;
  published_at: string | null;
  editor_user_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// conversion_events (Milestone 7)
// ---------------------------------------------------------------------------
type ConversionEventsRow = {
  id: string;
  lead_id: string | null;
  student_user_id: string | null;
  event_name: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landing_page: string | null;
  referral_label: string | null;
  occurred_at: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// admin_audit_log (Milestone 7)
// ---------------------------------------------------------------------------
type AdminAuditLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  changes: Json | null;
  context: Json | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Milestone 8 — Payments, Invoicing and Receipts (0005_payments_billing.sql)
// ---------------------------------------------------------------------------
type BillingSettingsRow = {
  id: number;
  legal_entity_name: string | null;
  business_address: string | null;
  support_email: string | null;
  support_phone: string | null;
  gst_registered: boolean;
  gstin: string | null;
  default_tax_rate_bps: number | null;
  invoice_footer_note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type InvoicesRow = {
  id: string;
  invoice_number: string | null;
  student_user_id: string | null;
  application_id: string | null;
  status: string;
  currency: string;
  subtotal_minor_units: number;
  discount_minor_units: number;
  tax_minor_units: number;
  total_minor_units: number;
  issue_date: string | null;
  due_date: string | null;
  internal_notes: string | null;
  student_notes: string | null;
  billing_snapshot: Json | null;
  void_reason: string | null;
  created_by: string | null;
  issued_by: string | null;
  issued_at: string | null;
  paid_at: string | null;
  voided_by: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  // Milestone 10 — additive, nullable (0007_nextwise_pricing_offers.sql PART 6).
  pricing_plan_id: string | null;
  pricing_offer_id: string | null;
};

type InvoiceLineItemsRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount_minor_units: number;
  discount_minor_units: number;
  tax_rate_bps: number | null;
  tax_minor_units: number;
  line_total_minor_units: number;
  sort_order: number;
  created_at: string;
};

type PaymentAttemptsRow = {
  id: string;
  invoice_id: string;
  provider: string;
  provider_order_id: string | null;
  idempotency_key: string;
  status: string;
  amount_minor_units: number;
  currency: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentTransactionsRow = {
  id: string;
  payment_attempt_id: string;
  provider_payment_id: string | null;
  is_manual: boolean;
  status: string;
  amount_minor_units: number;
  amount_refunded_minor_units: number;
  currency: string;
  method_category: string | null;
  captured_at: string | null;
  failure_reason: string | null;
  raw_status: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

type RefundsRow = {
  id: string;
  payment_transaction_id: string;
  invoice_id: string;
  provider_refund_id: string | null;
  amount_minor_units: number;
  status: string;
  reason: string | null;
  initiated_by: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentWebhookEventsRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  processing_status: string;
  related_invoice_id: string | null;
  related_payment_attempt_id: string | null;
  related_payment_transaction_id: string | null;
  diagnostic_message: string | null;
  payload_summary: Json | null;
  created_at: string;
  processed_at: string | null;
};

type PaymentRequestTokensRow = {
  id: string;
  invoice_id: string;
  token_hash: string;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
};

// ---------------------------------------------------------------------------
// Milestone 9 — Audit + Outcome Instrumentation (0010_product_events_and_outcomes.sql)
// ---------------------------------------------------------------------------

type ProductEventsRow = {
  id: string;
  event_name: string;
  user_id: string | null;
  session_id: string | null;
  anonymous_id: string | null;
  source: string | null;
  path: string | null;
  feature: string | null;
  entity_type: string | null;
  entity_id: string | null;
  properties: Json;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  occurred_at: string;
  created_at: string;
};

type StudentOutcomesRow = {
  id: string;
  student_user_id: string;
  journey_stage: string;
  outcome_status: string;
  target_career_id: string | null;
  target_course_id: string | null;
  target_university_id: string | null;
  final_application_id: string | null;
  destination_country: string | null;
  application_count: number;
  offer_count: number;
  final_decision_status: string | null;
  outcome_source: string;
  recorded_by: string | null;
  metadata: Json;
  recorded_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Milestone 10 — NextWise Pricing & Offers (0007_nextwise_pricing_offers.sql)
// ---------------------------------------------------------------------------

type PricingPlansRow = {
  id: string;
  slug: string;
  category: string;
  internal_name: string;
  display_order: number;
  is_recommended: boolean;
  is_active: boolean;
  current_version_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type PricingPlanVersionsRow = {
  id: string;
  plan_id: string;
  version_number: number;
  public_title: string;
  short_description: string | null;
  detailed_description: string | null;
  currency: string;
  amount_minor_units: number;
  payment_type: string;
  billing_interval: string | null;
  included_services: Json;
  exclusions: Json;
  cta_text: string | null;
  tax_status: string;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Milestone 11 — 0008_pricing_inclusions_and_presentation.sql PART 2.
  session_count: number | null;
  session_duration_note: string | null;
  audience_label: string | null;
  university_shortlist_limit: number | null;
  application_support_limit: number | null;
  sop_review_rounds: number | null;
  scholarship_support_note: string | null;
  mock_interview_count: number | null;
  counsellor_tier: string | null;
  support_duration_note: string | null;
};

// Milestone 11 — 0008_pricing_inclusions_and_presentation.sql PART 1.
type PricingPlanInclusionsRow = {
  id: string;
  plan_version_id: string;
  display_order: number;
  title: string;
  explanation: string | null;
  category: string | null;
  numeric_allowance: number | null;
  unit: string | null;
  is_highlight: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type PricingOffersRow = {
  id: string;
  plan_id: string;
  public_offer_name: string;
  internal_description: string | null;
  discount_type: string;
  discount_percent_bps: number | null;
  discount_amount_minor_units: number | null;
  discount_currency: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  status: string;
  coupon_code: string | null;
  max_redemptions: number | null;
  per_user_limit: number | null;
  redemption_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type PricingPurchasesRow = {
  id: string;
  student_user_id: string | null;
  plan_id: string | null;
  plan_version_id: string | null;
  plan_name_at_purchase: string;
  included_services_at_purchase: Json;
  original_amount_minor_units: number;
  discount_minor_units: number;
  tax_minor_units: number;
  final_amount_minor_units: number;
  currency: string;
  offer_id: string | null;
  coupon_code_used: string | null;
  invoice_id: string | null;
  purchased_at: string;
  // Milestone 11 — 0008_pricing_inclusions_and_presentation.sql PART 4.
  session_count_at_purchase: number | null;
  inclusions_at_purchase: Json;
  presentation_limits_at_purchase: Json;
};

type PricingAnalyticsEventsRow = {
  id: string;
  event_type: string;
  plan_id: string | null;
  offer_id: string | null;
  student_user_id: string | null;
  session_ref: string | null;
  occurred_at: string;
};

// ---------------------------------------------------------------------------
// Trusted Global Course Search — 0009_trusted_course_search.sql
// ---------------------------------------------------------------------------
type ExternalSearchProvidersRow = {
  id: string;
  slug: string;
  display_name: string;
  country_code: string | null;
  region: string | null;
  provider_type: string;
  official_domain: string;
  base_url: string;
  fallback_url: string | null;
  strategy: string;
  description: string | null;
  warning_text: string | null;
  warning_effective_at: string | null;
  warning_review_at: string | null;
  language: string | null;
  active: boolean;
  last_verified_at: string | null;
  verified_by: string | null;
  supported_degree_levels: string[];
  created_at: string;
  updated_at: string;
};

type ExternalSearchMappingsRow = {
  id: string;
  provider_id: string;
  canonical_subject_id: string;
  degree_level: string;
  destination_country_code: string;
  verified_url: string | null;
  provider_subject_code: string | null;
  provider_degree_code: string | null;
  search_term: string | null;
  manual_instructions: string | null;
  mapping_status: string;
  last_verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
};

type ExternalSearchClicksRow = {
  id: string;
  provider_id: string;
  mapping_id: string | null;
  canonical_subject_id: string | null;
  degree_level: string | null;
  destination_country_code: string | null;
  source_page: string;
  event_type: string;
  user_id: string | null;
  session_ref: string | null;
  occurred_at: string;
};

export interface Database {
  public: {
    // No views or functions are defined for this project — these two
    // entries still have to exist (with exactly this shape) for the
    // Supabase client's generic inference to resolve `Tables` correctly.
    // Omitting them makes the whole `public` schema fail its internal
    // `extends GenericSchema` check and every table silently collapses to
    // `never`, which is what caused every `student_*` query result and
    // insert/update payload to type-error while `profiles` (whose call
    // sites never destructured a row field directly) stayed silent.
    Views: { [_ in never]: never };
    // Milestone 7 adds exactly one RPC: record_admin_audit_log (the only
    // write path into admin_audit_log — see 0004_admin_system.sql PART 11
    // and src/lib/admin/audit.ts). Args/Returns here match its SQL
    // signature exactly.
    Functions: {
      record_admin_audit_log: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id: string | null;
          p_summary: string;
          p_changes?: Json | null;
          p_context?: Json | null;
        };
        Returns: string;
      };
      // Milestone 8 — see 0005_payments_billing.sql for full documentation
      // of each function's authorization/verification behavior.
      next_invoice_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      recompute_invoice_status: {
        Args: { p_invoice_id: string };
        Returns: InvoicesRow;
      };
      verify_checkout_payment: {
        Args: {
          p_payment_attempt_id: string;
          p_provider_payment_id: string;
          p_provider_order_id: string;
          p_signature: string;
        };
        Returns: PaymentAttemptsRow;
      };
      apply_webhook_event: {
        Args: { p_raw_body: string; p_signature: string };
        Returns: Json;
      };
      // Milestone 10 — see 0007_nextwise_pricing_offers.sql PART 7.
      purchase_pricing_plan: {
        Args: {
          p_plan_id: string;
          p_offer_id?: string | null;
          p_coupon_code?: string | null;
        };
        Returns: Json;
      };
      // Milestone 10 — Electronic Signature Integration (F-122) — see
      // 0011_electronic_signature.sql for full documentation of each
      // function's authorization/verification behavior.
      create_signature_request: {
        Args: {
          p_agreement_version_id: string;
          p_signer_name: string;
          p_signer_email: string;
          p_provider?: string;
        };
        Returns: SignatureRequestsRow;
      };
      apply_signature_webhook_event: {
        Args: { p_raw_body: string; p_signature: string };
        Returns: Json;
      };
      set_signature_document_path: {
        Args: { p_provider: string; p_provider_request_id: string; p_storage_path: string };
        Returns: Json;
      };
      // Milestone 11-A — Electronic Stamping (F-123) — see
      // 0012_electronic_stamping_and_assisted_onboarding.sql for full
      // documentation of each function's authorization/verification
      // behavior.
      create_stamp_request: {
        Args: {
          p_agreement_version_id: string;
          p_jurisdiction?: string | null;
          p_state?: string | null;
          p_document_type?: string | null;
          p_provider?: string;
        };
        Returns: StampRequestsRow;
      };
      apply_stamp_webhook_event: {
        Args: { p_raw_body: string; p_signature: string };
        Returns: Json;
      };
      set_stamp_document_path: {
        Args: { p_provider: string; p_provider_request_id: string; p_storage_path: string };
        Returns: Json;
      };
    };
    Tables: {
      profiles: {
        Row: ProfilesRow;
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          marketing_consent?: boolean;
          account_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          phone?: string | null;
          marketing_consent?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      student_profiles: {
        Row: StudentProfilesRow;
        Insert: Partial<StudentProfilesRow> & { user_id: string };
        Update: Partial<Omit<StudentProfilesRow, "user_id">>;
        Relationships: [];
      };

      student_education: {
        Row: StudentEducationRow;
        Insert: Omit<StudentEducationRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentEducationRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_subject_strengths: {
        Row: StudentSubjectStrengthsRow;
        Insert: Omit<StudentSubjectStrengthsRow, "id" | "created_at" | "updated_at"> &
          TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentSubjectStrengthsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_interests: {
        Row: StudentInterestsRow;
        Insert: Omit<StudentInterestsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentInterestsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_skills: {
        Row: StudentSkillsRow;
        Insert: Omit<StudentSkillsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentSkillsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_work_preferences: {
        Row: StudentWorkPreferencesRow;
        Insert: Omit<StudentWorkPreferencesRow, "id" | "created_at" | "updated_at"> &
          TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentWorkPreferencesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_career_priorities: {
        Row: StudentCareerPrioritiesRow;
        Insert: Omit<StudentCareerPrioritiesRow, "id" | "created_at" | "updated_at"> &
          TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentCareerPrioritiesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_career_goals: {
        Row: StudentCareerGoalsRow;
        Insert: Partial<StudentCareerGoalsRow> & { user_id: string };
        Update: Partial<Omit<StudentCareerGoalsRow, "user_id">>;
        Relationships: [];
      };

      student_study_preferences: {
        Row: StudentStudyPreferencesRow;
        Insert: Partial<StudentStudyPreferencesRow> & { user_id: string };
        Update: Partial<Omit<StudentStudyPreferencesRow, "user_id">>;
        Relationships: [];
      };

      student_funding_preferences: {
        Row: StudentFundingPreferencesRow;
        Insert: Partial<StudentFundingPreferencesRow> & { user_id: string };
        Update: Partial<Omit<StudentFundingPreferencesRow, "user_id">>;
        Relationships: [];
      };

      student_experience: {
        Row: StudentExperienceRow;
        Insert: Omit<StudentExperienceRow, "id" | "created_at" | "updated_at"> &
          TimestampedInsert & { id?: string };
        Update: Partial<Omit<StudentExperienceRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      // -----------------------------------------------------------------
      // Milestone 4 — Career Knowledge Base. Master data, not student-owned:
      // read-only from the app (see 0003_career_database.sql RLS). Insert/
      // Update types exist for completeness and any future admin tooling.
      // -----------------------------------------------------------------
      career_families: {
        Row: CareerFamiliesRow;
        Insert: Omit<CareerFamiliesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CareerFamiliesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      careers: {
        Row: CareersRow;
        Insert: Omit<CareersRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CareersRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      career_subject_requirements: {
        Row: CareerSubjectRequirementsRow;
        Insert: Omit<CareerSubjectRequirementsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerSubjectRequirementsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_interest_requirements: {
        Row: CareerInterestRequirementsRow;
        Insert: Omit<CareerInterestRequirementsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerInterestRequirementsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_skill_requirements: {
        Row: CareerSkillRequirementsRow;
        Insert: Omit<CareerSkillRequirementsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerSkillRequirementsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_work_preference_profile: {
        Row: CareerWorkPreferenceProfileRow;
        Insert: Omit<CareerWorkPreferenceProfileRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerWorkPreferenceProfileRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_priority_profile: {
        Row: CareerPriorityProfileRow;
        Insert: Omit<CareerPriorityProfileRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerPriorityProfileRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_education_routes: {
        Row: CareerEducationRoutesRow;
        Insert: Omit<CareerEducationRoutesRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerEducationRoutesRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      industries: {
        Row: IndustriesRow;
        Insert: Omit<IndustriesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<IndustriesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      career_industries: {
        Row: CareerIndustriesRow;
        Insert: Omit<CareerIndustriesRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<CareerIndustriesRow, "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_tags: {
        Row: CareerTagsRow;
        Insert: Omit<CareerTagsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerTagsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_tag_map: {
        Row: CareerTagMapRow;
        Insert: Omit<CareerTagMapRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<CareerTagMapRow, "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_aliases: {
        Row: CareerAliasesRow;
        Insert: Omit<CareerAliasesRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<CareerAliasesRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      career_related: {
        Row: CareerRelatedRow;
        Insert: Omit<CareerRelatedRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<CareerRelatedRow, "created_at">> & { created_at?: string };
        Relationships: [];
      };

      // -----------------------------------------------------------------
      // Milestone 7 — Full Admin System
      // -----------------------------------------------------------------
      admin_roles: {
        Row: AdminRolesRow;
        Insert: Partial<AdminRolesRow> & { user_id: string; role: string };
        Update: Partial<Omit<AdminRolesRow, "user_id">>;
        Relationships: [];
      };

      counsellors: {
        Row: CounsellorsRow;
        Insert: Omit<CounsellorsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CounsellorsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      universities: {
        Row: UniversitiesRow;
        Insert: Omit<UniversitiesRow, "id" | "created_at" | "updated_at" | "search_vector"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<UniversitiesRow, "id" | "created_at" | "updated_at" | "search_vector">> & TimestampedInsert;
        Relationships: [];
      };

      courses: {
        Row: CoursesRow;
        Insert: Omit<CoursesRow, "id" | "created_at" | "updated_at" | "search_vector"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CoursesRow, "id" | "created_at" | "updated_at" | "search_vector">> & TimestampedInsert;
        Relationships: [];
      };

      countries: {
        Row: CountriesRow;
        Insert: Omit<CountriesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CountriesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      campuses: {
        Row: CampusesRow;
        Insert: Omit<CampusesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CampusesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      course_intakes: {
        Row: CourseIntakesRow;
        Insert: Omit<CourseIntakesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CourseIntakesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      course_tuition_fees: {
        Row: CourseTuitionFeesRow;
        Insert: Omit<CourseTuitionFeesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CourseTuitionFeesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      course_admission_requirements: {
        Row: CourseAdmissionRequirementsRow;
        Insert: Omit<CourseAdmissionRequirementsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CourseAdmissionRequirementsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      scholarships: {
        Row: ScholarshipsRow;
        Insert: Omit<ScholarshipsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<ScholarshipsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      education_data_provenance: {
        Row: EducationDataProvenanceRow;
        Insert: Omit<EducationDataProvenanceRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<EducationDataProvenanceRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      education_import_batches: {
        Row: EducationImportBatchesRow;
        Insert: Omit<EducationImportBatchesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<EducationImportBatchesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      education_import_rows: {
        Row: EducationImportRowsRow;
        Insert: Omit<EducationImportRowsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<EducationImportRowsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      education_duplicate_candidates: {
        Row: EducationDuplicateCandidatesRow;
        Insert: Omit<EducationDuplicateCandidatesRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<EducationDuplicateCandidatesRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      education_saved_items: {
        Row: EducationSavedItemsRow;
        Insert: Omit<EducationSavedItemsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<EducationSavedItemsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      education_intake_interests: {
        Row: EducationIntakeInterestsRow;
        Insert: Omit<EducationIntakeInterestsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<EducationIntakeInterestsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      education_course_shares: {
        Row: EducationCourseSharesRow;
        Insert: Omit<EducationCourseSharesRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<EducationCourseSharesRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      admin_student_meta: {
        Row: AdminStudentMetaRow;
        Insert: Partial<AdminStudentMetaRow> & { student_user_id: string };
        Update: Partial<Omit<AdminStudentMetaRow, "student_user_id">>;
        Relationships: [];
      };

      admin_student_notes: {
        Row: AdminStudentNotesRow;
        Insert: Omit<AdminStudentNotesRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<AdminStudentNotesRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      leads: {
        Row: LeadsRow;
        Insert: Omit<LeadsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<LeadsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      lead_status_history: {
        Row: LeadStatusHistoryRow;
        Insert: Omit<LeadStatusHistoryRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<LeadStatusHistoryRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      applications: {
        Row: ApplicationsRow;
        Insert: Omit<ApplicationsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<ApplicationsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      application_status_history: {
        Row: ApplicationStatusHistoryRow;
        Insert: Omit<ApplicationStatusHistoryRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<ApplicationStatusHistoryRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      payments: {
        Row: PaymentsRow;
        Insert: Omit<PaymentsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<PaymentsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      agreements: {
        Row: AgreementsRow;
        Insert: Omit<AgreementsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<AgreementsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      // -----------------------------------------------------------------
      // Milestone 10 — Electronic Signature Integration (F-122)
      // -----------------------------------------------------------------
      agreement_versions: {
        Row: AgreementVersionsRow;
        Insert: Omit<AgreementVersionsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<AgreementVersionsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      signature_requests: {
        Row: SignatureRequestsRow;
        Insert: Omit<SignatureRequestsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<SignatureRequestsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      signature_webhook_events: {
        Row: SignatureWebhookEventsRow;
        Insert: Omit<SignatureWebhookEventsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<SignatureWebhookEventsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      // -----------------------------------------------------------------
      // Milestone 11-A — Electronic Stamping (F-123)
      // -----------------------------------------------------------------
      stamp_requests: {
        Row: StampRequestsRow;
        Insert: Omit<StampRequestsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<StampRequestsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      stamp_webhook_events: {
        Row: StampWebhookEventsRow;
        Insert: Omit<StampWebhookEventsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<StampWebhookEventsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      // -----------------------------------------------------------------
      // Milestone 11-B/C — Assisted Onboarding Revision
      // -----------------------------------------------------------------
      discovery_sessions: {
        Row: DiscoverySessionsRow;
        Insert: Omit<DiscoverySessionsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<DiscoverySessionsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      discovery_session_workspace: {
        Row: DiscoverySessionWorkspaceRow;
        Insert: Omit<DiscoverySessionWorkspaceRow, "created_at" | "updated_at"> & TimestampedInsert;
        Update: Partial<Omit<DiscoverySessionWorkspaceRow, "session_id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      student_profile_section_provenance: {
        Row: StudentProfileSectionProvenanceRow;
        Insert: Omit<StudentProfileSectionProvenanceRow, "updated_at"> & { updated_at?: string };
        Update: Partial<Omit<StudentProfileSectionProvenanceRow, "student_user_id" | "section_key" | "updated_at">> & { updated_at?: string };
        Relationships: [];
      };

      student_recommendation_verifications: {
        Row: StudentRecommendationVerificationsRow;
        Insert: Omit<StudentRecommendationVerificationsRow, "verified_at"> & { verified_at?: string };
        Update: Partial<Omit<StudentRecommendationVerificationsRow, "student_user_id" | "recommendation_type">>;
        Relationships: [];
      };

      content_items: {
        Row: ContentItemsRow;
        Insert: Omit<ContentItemsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<ContentItemsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      conversion_events: {
        Row: ConversionEventsRow;
        Insert: Omit<ConversionEventsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<ConversionEventsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      admin_audit_log: {
        Row: AdminAuditLogRow;
        Insert: Omit<AdminAuditLogRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<AdminAuditLogRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      // -----------------------------------------------------------------
      // Milestone 8 — Payments, Invoicing and Receipts
      // -----------------------------------------------------------------
      billing_settings: {
        Row: BillingSettingsRow;
        Insert: Partial<BillingSettingsRow> & { id?: number };
        Update: Partial<Omit<BillingSettingsRow, "id">>;
        Relationships: [];
      };

      invoices: {
        Row: InvoicesRow;
        // pricing_plan_id/pricing_offer_id (Milestone 10) are optional on
        // insert — every pre-existing admin-issued-invoice call site never
        // sets either, and both columns are nullable with an implicit
        // Postgres default of null.
        Insert: Omit<InvoicesRow, "id" | "created_at" | "updated_at" | "pricing_plan_id" | "pricing_offer_id"> &
          TimestampedInsert & { id?: string; pricing_plan_id?: string | null; pricing_offer_id?: string | null };
        Update: Partial<Omit<InvoicesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      invoice_line_items: {
        Row: InvoiceLineItemsRow;
        Insert: Omit<InvoiceLineItemsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<InvoiceLineItemsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      payment_attempts: {
        Row: PaymentAttemptsRow;
        Insert: Omit<PaymentAttemptsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<PaymentAttemptsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      payment_transactions: {
        Row: PaymentTransactionsRow;
        Insert: Omit<PaymentTransactionsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<PaymentTransactionsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      refunds: {
        Row: RefundsRow;
        Insert: Omit<RefundsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<RefundsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      payment_webhook_events: {
        Row: PaymentWebhookEventsRow;
        Insert: Omit<PaymentWebhookEventsRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<PaymentWebhookEventsRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      payment_request_tokens: {
        Row: PaymentRequestTokensRow;
        Insert: Omit<PaymentRequestTokensRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<PaymentRequestTokensRow, "id" | "created_at">> & { created_at?: string };
        Relationships: [];
      };

      // ---------------------------------------------------------------
      // Milestone 10 — NextWise Pricing & Offers
      // ---------------------------------------------------------------
      pricing_plans: {
        Row: PricingPlansRow;
        Insert: Omit<PricingPlansRow, "id" | "created_at" | "updated_at" | "current_version_id"> & TimestampedInsert & { id?: string; current_version_id?: string | null };
        Update: Partial<Omit<PricingPlansRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      pricing_plan_versions: {
        Row: PricingPlanVersionsRow;
        Insert: Omit<PricingPlanVersionsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<PricingPlanVersionsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      // Milestone 11 — 0008_pricing_inclusions_and_presentation.sql PART 1.
      pricing_plan_inclusions: {
        Row: PricingPlanInclusionsRow;
        Insert: Omit<PricingPlanInclusionsRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<PricingPlanInclusionsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      pricing_offers: {
        Row: PricingOffersRow;
        Insert: Omit<PricingOffersRow, "id" | "created_at" | "updated_at" | "redemption_count"> & TimestampedInsert & { id?: string; redemption_count?: number };
        Update: Partial<Omit<PricingOffersRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      pricing_purchases: {
        Row: PricingPurchasesRow;
        Insert: Omit<PricingPurchasesRow, "id" | "purchased_at"> & { id?: string; purchased_at?: string };
        Update: Partial<Omit<PricingPurchasesRow, "id">>;
        Relationships: [];
      };

      pricing_analytics_events: {
        Row: PricingAnalyticsEventsRow;
        Insert: Omit<PricingAnalyticsEventsRow, "id" | "occurred_at" | "student_user_id"> & { id?: string; occurred_at?: string; student_user_id?: string | null };
        Update: Partial<Omit<PricingAnalyticsEventsRow, "id">>;
        Relationships: [];
      };

      external_search_providers: {
        Row: ExternalSearchProvidersRow;
        Insert: Omit<ExternalSearchProvidersRow, "id" | "created_at" | "updated_at" | "active" | "supported_degree_levels"> &
          TimestampedInsert & { id?: string; active?: boolean; supported_degree_levels?: string[] };
        Update: Partial<Omit<ExternalSearchProvidersRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      external_search_mappings: {
        Row: ExternalSearchMappingsRow;
        Insert: Omit<ExternalSearchMappingsRow, "id" | "created_at" | "updated_at" | "mapping_status"> &
          TimestampedInsert & { id?: string; mapping_status?: string };
        Update: Partial<Omit<ExternalSearchMappingsRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      external_search_clicks: {
        Row: ExternalSearchClicksRow;
        Insert: Omit<ExternalSearchClicksRow, "id" | "occurred_at" | "user_id" | "source_page" | "event_type" | "session_ref"> & {
          id?: string;
          occurred_at?: string;
          user_id?: string | null;
          source_page?: string;
          event_type?: string;
          session_ref?: string | null;
        };
        Update: Partial<Omit<ExternalSearchClicksRow, "id">>;
        Relationships: [];
      };

      // ---------------------------------------------------------------
      // Milestone 9 — Audit + Outcome Instrumentation
      // ---------------------------------------------------------------
      product_events: {
        Row: ProductEventsRow;
        Insert: Omit<ProductEventsRow, "id" | "occurred_at" | "created_at" | "user_id" | "properties"> & {
          id?: string;
          occurred_at?: string;
          created_at?: string;
          user_id?: string | null;
          properties?: Json;
        };
        Update: Partial<Omit<ProductEventsRow, "id">>;
        Relationships: [];
      };

      student_outcomes: {
        Row: StudentOutcomesRow;
        Insert: Omit<StudentOutcomesRow, "id" | "recorded_at" | "updated_at" | "journey_stage" | "outcome_status" | "outcome_source" | "application_count" | "offer_count" | "metadata"> & {
          id?: string;
          recorded_at?: string;
          updated_at?: string;
          journey_stage?: string;
          outcome_status?: string;
          outcome_source?: string;
          application_count?: number;
          offer_count?: number;
          metadata?: Json;
        };
        Update: Partial<Omit<StudentOutcomesRow, "id">>;
        Relationships: [];
      };
    };
  };
}
