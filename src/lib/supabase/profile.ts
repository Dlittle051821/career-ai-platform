import "server-only";
import { createClient } from "./server";
import type { Profile } from "@/types";

function toProfile(row: {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  marketing_consent: boolean;
  account_type: string;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    marketingConsent: row.marketing_consent,
    accountType: row.account_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Reusable server-side "who's logged in" check for Server Components,
 * Route Handlers, and Server Actions. Returns `null` when logged out
 * instead of throwing, so callers can decide how to handle it (most
 * protected pages won't even reach this — the middleware already
 * redirected — but Server Actions and Route Handlers need their own
 * check too, since middleware alone isn't a substitute for authorization
 * at the point where data is actually read or written).
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Fetches the logged-in student's profile row. Returns `null` if the user
 * is logged out, or if the profile row genuinely doesn't exist yet (which
 * should be rare given the signup trigger, but a race is possible in the
 * instant right after registration).
 *
 * Centralizing this here means every protected page/component fetches a
 * profile the same way — no duplicated Supabase query logic to keep in
 * sync as Milestone 3 adds more profile fields.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (error || !data) return null;

  return toProfile(data);
}

/** First name for greetings ("Good evening, Dipam") — falls back gracefully. */
export function firstNameFrom(profile: Profile | null): string {
  if (!profile?.fullName) return "there";
  return profile.fullName.trim().split(/\s+/)[0] || "there";
}
