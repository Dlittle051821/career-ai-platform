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
    Functions: { [_ in never]: never };
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
    };
  };
}
