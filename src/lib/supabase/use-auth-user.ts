"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

/**
 * Shared client-side "who's logged in" hook for nav components
 * (AccountMenu, MobileNav). Resolves the current user once on mount and
 * stays in sync via Supabase's onAuthStateChange, so a login/register/
 * logout elsewhere in the app updates every subscriber without a page
 * reload.
 */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, ready };
}

export function firstNameOf(user: User | null): string {
  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return fullName.trim().split(/\s+/)[0] || "Student";
}
