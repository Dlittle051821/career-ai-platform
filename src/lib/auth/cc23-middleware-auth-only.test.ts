import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * CC-23 — regression for the P0 "login always shows 'Something went wrong'"
 * defect. LoginForm posts a Server Action to /login immediately after
 * signInWithPassword; the middleware must not 307-redirect that POST just
 * because the request now carries a session.
 */

const state: { user: { id: string } | null; role: string | null } = { user: null, role: null };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.role ? { role: state.role } : null, error: null }) }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "http://127.0.0.1:54321", publishableKey: "test" }) }));

const { updateSession, isPageNavigation } = await import("@/lib/supabase/middleware");

function req(path: string, init: { method?: string; action?: boolean } = {}) {
  const headers = new Headers();
  if (init.action) headers.set("next-action", "00d780d589c91ca1efabbee29c7f0b2379ae476b90");
  return new NextRequest(new URL(path, "http://localhost:3023"), { method: init.method ?? "GET", headers });
}

beforeEach(() => {
  state.user = null;
  state.role = null;
});

describe("CC-23 middleware: auth-only pages vs Server Actions", () => {
  it("does not redirect a signed-in Server Action POST to /login (the login defect)", async () => {
    state.user = { id: "u1" };
    const res = await updateSession(req("/login", { method: "POST", action: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect any signed-in POST to /register", async () => {
    state.user = { id: "u1" };
    const res = await updateSession(req("/register", { method: "POST" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("still bounces a signed-in student's page visit to /login and /register to /dashboard", async () => {
    state.user = { id: "u1" };
    for (const p of ["/login", "/register", "/login?next=/studio"]) {
      const res = await updateSession(req(p));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard");
    }
  });

  it("still sends a signed-in staff account's page visit to /admin", async () => {
    state.user = { id: "u2" };
    state.role = "counsellor";
    const res = await updateSession(req("/login"));
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/admin");
  });

  it("protected routes are unchanged: signed-out GET and POST both go to /login", async () => {
    for (const r of [req("/dashboard"), req("/studio/career", { method: "POST", action: true })]) {
      const res = await updateSession(r);
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    }
  });

  it("classifies requests", () => {
    expect(isPageNavigation(req("/login"))).toBe(true);
    expect(isPageNavigation(req("/login", { method: "HEAD" }))).toBe(true);
    expect(isPageNavigation(req("/login", { method: "POST" }))).toBe(false);
    expect(isPageNavigation(req("/login", { action: true }))).toBe(false);
  });
});
