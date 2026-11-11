import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * CC-24 — a signed-out visitor to the Counsellor Studio (/counsellor) got
 * an "Access denied — your account is signed in" page with HTTP 200 and no
 * way to log in, because /counsellor was missing from the middleware's
 * protected paths. (The layout's role gate still refused access; no data
 * was exposed.) It now redirects to /login with ?next like /admin does.
 */

const state: { user: { id: string } | null } = { user: null };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "http://127.0.0.1:54321", publishableKey: "test" }) }));

const { updateSession } = await import("@/lib/supabase/middleware");
const get = (p: string) => updateSession(new NextRequest(new URL(p, "http://localhost:3023")));

beforeEach(() => {
  state.user = null;
});

describe("CC-24 middleware: Counsellor Studio requires a session", () => {
  it.each(["/counsellor", "/counsellor/discovery-sessions", "/counsellor/discovery-sessions/abc", "/counsellor/students/x/ai-career-intelligence"])(
    "signed-out %s -> /login?next=…",
    async (p) => {
      const res = await get(p);
      expect(res.status).toBe(307);
      const loc = new URL(res.headers.get("location") ?? "", "http://localhost:3023");
      expect(loc.pathname).toBe("/login");
      expect(loc.searchParams.get("next")).toBe(p);
    }
  );

  it("a look-alike public path is not caught by the prefix", async () => {
    const res = await get("/counsellors-faq");
    expect(res.headers.get("location")).toBeNull();
  });

  it("a signed-in user passes through (the layout's role gate decides)", async () => {
    state.user = { id: "u1" };
    const res = await get("/counsellor");
    expect(res.headers.get("location")).toBeNull();
  });
});
