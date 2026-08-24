/**
 * Hand-written typing for the Milestone 2 database shape (just the
 * `profiles` table). Structured to match what the Supabase CLI's
 * `supabase gen types typescript` command would generate, so this file can
 * be swapped for a generated one later without touching call sites.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          marketing_consent: boolean;
          account_type: string;
          created_at: string;
          updated_at: string;
        };
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
      };
    };
  };
}
