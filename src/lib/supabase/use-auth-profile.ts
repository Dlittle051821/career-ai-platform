"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

export interface AuthProfile {
  id: string;
  fullName: string | null;
  email: string | null;
  accountType: string | null;
}

export interface AuthProfileState {
  user: User | null;
  profile: AuthProfile | null;
  /** Convenience alias for `profile?.accountType ?? null` — the value AccountMenu's role logic (src/lib/navigation/account-menu.ts) actually reads. */
  accountType: string | null;
  ready: boolean;
}

/**
 * Role-aware counterpart to `useAuthUser` (./use-auth-user.ts). That hook
 * only ever resolved `supabase.auth.getUser()`, which carries no role — it
 * is why AccountMenu couldn't tell a student from an admin. This hook adds
 * one extra read of the caller's own `public.profiles` row (RLS-scoped to
 * `auth.uid()` — see supabase/migrations/0001_profiles.sql) so presentation
 * code can render the right role label/links without duplicating that query
 * itself.
 *
 * `useAuthUser`/`firstNameOf` are left in place and still used by
 * MobileNav — this hook is additive, not a replacement, keeping this fix
 * scoped to the components that actually need role-awareness (AccountMenu).
 *
 * This is presentation only. `profiles.account_type` is NOT the admin
 * authorization boundary — that's the separate `admin_roles` table, checked
 * server-side by getCurrentAdmin()/requireAdminPermission()
 * (src/lib/supabase/admin-auth.ts) and enforced independently by RLS on
 * every admin table. Nothing here grants access to anything; it only
 * decides what a nav link says and points at — see
 * src/lib/navigation/account-menu.ts for the full explanation.
 */
export function useAuthProfile(): AuthProfileState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Tracks which signed-in user's profile we last fetched, so
    // onAuthStateChange events that don't actually change *who* is signed
    // in (e.g. TOKEN_REFRESHED, fired roughly every 50 minutes for the
    // same user) don't trigger a redundant profiles round trip — only a
    // real sign-in/sign-out/account-switch does.
    let lastLoadedUserId: string | null = null;
    const supabase = createClient();

    async function loadProfile(currentUser: User | null) {
      lastLoadedUserId = currentUser?.id ?? null;

      if (!currentUser) {
        if (!cancelled) setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, account_type")
        .eq("id", currentUser.id)
        .single();

      if (cancelled) return;
      setProfile(
        data
          ? { id: data.id, fullName: data.full_name, email: data.email, accountType: data.account_type }
          : null
      );
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      await loadProfile(data.user);
      if (!cancelled) setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser?.id !== lastLoadedUserId) {
        void loadProfile(nextUser);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, accountType: profile?.accountType ?? null, ready };
}
