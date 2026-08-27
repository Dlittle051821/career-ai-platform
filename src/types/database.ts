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
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
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
        Insert: Omit<UniversitiesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<UniversitiesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
        Relationships: [];
      };

      courses: {
        Row: CoursesRow;
        Insert: Omit<CoursesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
        Update: Partial<Omit<CoursesRow, "id" | "created_at" | "updated_at">> & TimestampedInsert;
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
        Insert: Omit<InvoicesRow, "id" | "created_at" | "updated_at"> & TimestampedInsert & { id?: string };
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
    };
  };
}
