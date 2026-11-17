"use server";

import { createClient } from "@/lib/supabase/server";
import { getUniversityAccess } from "@/lib/supabase/education/university-access";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";

/**
 * Re-reads the caller's real access state for the Verified dialog. Takes no
 * arguments: identity comes only from the session cookie. Returns a state
 * name and nothing else (no ids, no records).
 *
 * A failure to reach the auth service is thrown, not reported as "signed
 * out", so the dialog can say "we couldn't check your account" instead of
 * telling a signed-in student that their session has expired.
 */
export async function refreshUniversityAccessAction(): Promise<{ state: UniversityAccessState }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.getUser();
  if (error) {
    const status = (error as { status?: number }).status;
    const sessionMissing = error.name === "AuthSessionMissingError" || status === 400 || status === 401 || status === 403;
    if (!sessionMissing) throw new Error("auth_unavailable");
  }
  return { state: await getUniversityAccess() };
}
