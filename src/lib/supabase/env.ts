/**
 * Central place that reads and validates the two required Supabase
 * environment variables. Every Supabase client factory in this project
 * goes through this file rather than reading `process.env` directly, so a
 * missing/misconfigured `.env.local` fails with one clear message instead
 * of a confusing runtime error deep inside a component.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your Supabase " +
        "project's Settings -> API page."
    );
  }

  return { url, publishableKey };
}
