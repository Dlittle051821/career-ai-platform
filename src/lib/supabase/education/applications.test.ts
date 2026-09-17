import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Milestone 16 — orchestration tests for
 * src/lib/supabase/education/applications.ts, the student-facing side of
 * the application workflow. Mocks every I/O boundary (createClient,
 * getUniversitiesByIds/getCoursesByIds, trackEvent, getNotifier) behind a
 * small hand-rolled in-memory Supabase fake, same pattern as
 * src/lib/supabase/admin/applications.test.ts and
 * src/lib/supabase/admin/refunds.test.ts. Focuses on the two genuinely new
 * surfaces this milestone adds — advanceMyApplication()/
 * updateMyApplicationNote() (both thin, honest wrappers around the two
 * SECURITY DEFINER RPCs, never re-implementing their validation) — plus the
 * ownership/IDOR posture of getMyApplicationById()/getMyApplicationHistory().
 */

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("./universities", () => ({ getUniversitiesByIds: vi.fn().mockResolvedValue([]) }));
vi.mock("./courses", () => ({ getCoursesByIds: vi.fn().mockResolvedValue([]) }));
vi.mock("../analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/notifications/get-notifier", () => ({ getNotifier: vi.fn() }));

import { createClient } from "../server";
import { trackEvent } from "../analytics/track";
import { getNotifier } from "@/lib/notifications/get-notifier";
import { advanceMyApplication, getMyApplicationById, getMyApplicationHistory, listMyApplications, startApplicationFromCourse, updateMyApplicationNote } from "./applications";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeSupabase(tables: Tables, userId: string | null) {
  const rpc = vi.fn<(name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>>();
  const insertErrors: Record<string, { message: string } | undefined> = {};

  function from(table: string) {
    tables[table] = tables[table] ?? [];
    let mode: "select" | "insert" = "select";
    let insertRow: Row | null = null;
    let limitN: number | null = null;
    const filters: ((r: Row) => boolean)[] = [];

    function matched(): Row[] {
      const rows = tables[table].filter((r) => filters.every((f) => f(r)));
      return limitN === null ? rows : rows.slice(0, limitN);
    }

    function runAndReturn(): { rows: Row[]; error: { message: string } | null } {
      if (mode === "insert") {
        const forcedError = insertErrors[table];
        if (forcedError) {
          insertErrors[table] = undefined; // one-shot, like the race hooks elsewhere in this test suite
          return { rows: [], error: forcedError };
        }
        const row: Row = { id: `generated-${tables[table].length + 1}`, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...(insertRow ?? {}) };
        tables[table].push(row);
        return { rows: [row], error: null };
      }
      return { rows: matched(), error: null };
    }

    const builder = {
      select() {
        return builder;
      },
      insert(row: Row) {
        mode = "insert";
        insertRow = row;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      /** Mirrors supabase-js's `.not(col, "in", "(a,b)")` — the only `not(...)` form this codebase's real query uses. */
      not(col: string, op: string, val: unknown) {
        if (op === "in" && typeof val === "string") {
          const excluded = val
            .replace(/^\(/, "")
            .replace(/\)$/, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          filters.push((r) => !excluded.includes(String(r[col])));
        }
        return builder;
      },
      order() {
        return builder;
      },
      limit(n: number) {
        limitN = n;
        return builder;
      },
      maybeSingle() {
        const { rows, error } = runAndReturn();
        return Promise.resolve({ data: rows[0] ?? null, error });
      },
      single() {
        const { rows, error } = runAndReturn();
        if (error) return Promise.resolve({ data: null, error });
        if (rows.length === 0) return Promise.resolve({ data: null, error: { message: "no rows" } });
        return Promise.resolve({ data: rows[0], error: null });
      },
      then(onFulfilled: (v: { data: Row[]; error: { message: string } | null }) => unknown, onRejected?: (e: unknown) => unknown) {
        const { rows, error } = runAndReturn();
        return Promise.resolve({ data: rows, error }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    from,
    rpc,
    _tables: tables,
    _forceNextInsertError(table: string, error: { message: string }) {
      insertErrors[table] = error;
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }),
    },
  };
}

type FakeSupabase = ReturnType<typeof makeFakeSupabase>;
let fake: FakeSupabase;

function setUser(userId: string | null, tables: Tables = {}) {
  fake = makeFakeSupabase(tables, userId);
  vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNotifier).mockReturnValue({ notify: vi.fn().mockResolvedValue(undefined) });
  setUser("student-1");
});

// ---------------------------------------------------------------------------
// Ownership / IDOR (spec tests 13-22)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// v3 — database-boundary hardening. getMyApplicationById()/
// listMyApplications() now call get_my_application()/get_my_applications()
// via RPC instead of a direct .from("applications").select(...) — ownership
// is enforced INSIDE the RPC, so "not my application" and "real Postgres
// returns zero rows" are the same observable behavior from this function's
// point of view: fake.rpc simply resolves with an empty array.
// ---------------------------------------------------------------------------

function fullRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "app-1",
    university_id: null,
    course_id: null,
    course_intake_id: null,
    stage: "inquiry",
    intake: null,
    submission_date: null,
    decision_status: "pending",
    offer_type: null,
    deadlines: [],
    next_action: null,
    next_action_date: null,
    student_note: null,
    submitted_at: null,
    decision_at: null,
    withdrawn_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getMyApplicationById — ownership enforcement", () => {
  it("[test 13] returns null (not another student's data) when the RPC returns zero rows for a mismatched owner", async () => {
    fake.rpc.mockResolvedValue({ data: [], error: null });

    const result = await getMyApplicationById("app-1");

    expect(result).toBeNull();
    expect(fake.rpc).toHaveBeenCalledWith("get_my_application", { p_application_id: "app-1" });
  });

  it("[test 15] returns null when logged out, never throws, never calls the RPC", async () => {
    setUser(null);

    const result = await getMyApplicationById("app-1");

    expect(result).toBeNull();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("returns the application when the RPC genuinely returns it as the caller's own", async () => {
    fake.rpc.mockImplementation((name: string) => {
      if (name === "get_my_application") return Promise.resolve({ data: [fullRow({ student_note: "hello" })], error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const result = await getMyApplicationById("app-1");

    expect(result?.id).toBe("app-1");
    expect(result?.studentNote).toBe("hello");
  });

  it("[v3 patch — RETURNS TABLE structural exclusion] the mapped summary never carries internal_notes/assigned_counsellor_id/last_contact_date even if a misconfigured RPC response included them", async () => {
    fake.rpc.mockImplementation((name: string) => {
      if (name === "get_my_application")
        return Promise.resolve({
          data: [fullRow({ internal_notes: "staff-only text", assigned_counsellor_id: "counsellor-1", last_contact_date: "2026-01-01" })],
          error: null,
        });
      return Promise.resolve({ data: [], error: null });
    });

    const result = await getMyApplicationById("app-1");

    expect(JSON.stringify(result)).not.toContain("staff-only text");
    expect(JSON.stringify(result)).not.toContain("counsellor-1");
  });
});

describe("listMyApplications — v3 RPC boundary", () => {
  it("[v3 patch] calls get_my_applications() with no student id parameter — identity comes from auth.uid() server-side only", async () => {
    fake.rpc.mockResolvedValue({ data: [], error: null });

    await listMyApplications();

    expect(fake.rpc).toHaveBeenCalledWith("get_my_applications");
  });

  it("returns an empty array when logged out, never calls the RPC", async () => {
    setUser(null);

    const result = await listMyApplications();

    expect(result).toEqual([]);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("maps every returned row into a MyApplicationSummary", async () => {
    fake.rpc.mockResolvedValue({ data: [fullRow({ id: "app-1" }), fullRow({ id: "app-2", stage: "preparing" })], error: null });

    const result = await listMyApplications();

    expect(result.map((r) => r.id)).toEqual(["app-1", "app-2"]);
  });
});

describe("getMyApplicationHistory — ownership enforcement and safe columns", () => {
  // Milestone 16 (post-review patch): getMyApplicationHistory() now calls
  // the SECURITY DEFINER RPC get_my_application_status_history() (see
  // 0017_student_application_workflow.sql PART 4.1) instead of querying
  // application_status_history directly — ownership is enforced INSIDE that
  // RPC (application.student_user_id = auth.uid()), so from this function's
  // own point of view "not my application" and "real Postgres returns zero
  // rows for an application that isn't mine" are the same observable
  // behavior: fake.rpc simply resolves with no rows.

  it("[test 16] returns an empty array (not another student's history) when the application isn't theirs", async () => {
    fake.rpc.mockResolvedValue({ data: [], error: null });

    const history = await getMyApplicationHistory("app-1");

    expect(history).toEqual([]);
    expect(fake.rpc).toHaveBeenCalledWith("get_my_application_status_history", { p_application_id: "app-1" });
  });

  it("[test 17] never surfaces the admin-only `note` or `changed_by` fields, only student_visible_message", async () => {
    // The RPC's own RETURNS TABLE structurally excludes note/changed_by (see
    // the migration), but this asserts the TypeScript mapping stays honest
    // even if a future edit accidentally widened the fake/real row shape:
    // only the six documented columns are ever read off the RPC response.
    fake.rpc.mockResolvedValue({
      data: [{ id: "h1", from_status: null, to_status: "inquiry", actor_type: "admin", student_visible_message: "Your application status changed.", created_at: "2026-01-01T00:00:00Z" }],
      error: null,
    });

    const history = await getMyApplicationHistory("app-1");

    expect(history).toEqual([{ id: "h1", fromStatus: null, toStatus: "inquiry", studentVisibleMessage: "Your application status changed.", actorType: "admin", createdAt: "2026-01-01T00:00:00Z" }]);
    expect(JSON.stringify(history)).not.toContain("internal-only text");
    expect(JSON.stringify(history)).not.toContain("admin-1");
  });

  it("[patch] the student-facing history interface cannot expose `note` or `changed_by` even if the RPC response carried them", async () => {
    // Simulates a hypothetically misconfigured/future RPC that (incorrectly)
    // still returned these columns — proves the TypeScript boundary is a
    // second, independent line of defense on top of the RPC's own return
    // shape, not the only thing keeping these fields out.
    fake.rpc.mockResolvedValue({
      data: [
        {
          id: "h1",
          from_status: null,
          to_status: "inquiry",
          actor_type: "admin",
          student_visible_message: "Your application status changed.",
          created_at: "2026-01-01T00:00:00Z",
          note: "internal-only text",
          changed_by: "admin-1",
        },
      ],
      error: null,
    });

    const history = await getMyApplicationHistory("app-1");

    expect(JSON.stringify(history)).not.toContain("internal-only text");
    expect(JSON.stringify(history)).not.toContain("admin-1");
    expect(Object.keys(history[0]).sort()).toEqual(["actorType", "createdAt", "fromStatus", "id", "studentVisibleMessage", "toStatus"].sort());
  });
});

// ---------------------------------------------------------------------------
// advanceMyApplication — delegates entirely to the RPC (spec tests 18-22, 28)
// ---------------------------------------------------------------------------

describe("advanceMyApplication", () => {
  it("[test 18] relays the RPC's own safe, honest error message on failure rather than inventing a new one", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: { message: "This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again." } });

    const result = await advanceMyApplication("app-1", "submit");

    expect(result).toEqual({ success: false, error: "This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again." });
  });

  it("[test 19] a successful 'submit' fires application_submitted analytics and a confirmation notification", async () => {
    fake._tables.profiles = [{ id: "student-1", email: "student@example.com" }];
    fake.rpc.mockResolvedValue({ data: { id: "app-1", stage: "submitted" }, error: null });
    const notify = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getNotifier).mockReturnValue({ notify });

    const result = await advanceMyApplication("app-1", "submit");

    expect(result).toEqual({ success: true });
    expect(vi.mocked(trackEvent)).toHaveBeenCalledWith(expect.objectContaining({ eventName: "application_submitted", entityId: "app-1" }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ to: "student@example.com", template: "application_submitted" }));
  });

  it("[test 20] a successful 'withdraw' fires application_withdrawn analytics but no notification", async () => {
    fake.rpc.mockResolvedValue({ data: { id: "app-1", stage: "withdrawn" }, error: null });
    const notify = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getNotifier).mockReturnValue({ notify });

    await advanceMyApplication("app-1", "withdraw");

    expect(vi.mocked(trackEvent)).toHaveBeenCalledWith(expect.objectContaining({ eventName: "application_withdrawn" }));
    expect(notify).not.toHaveBeenCalled();
  });

  it("[test 21] an intermediate action (start_preparing) fires no analytics event and no notification", async () => {
    fake.rpc.mockResolvedValue({ data: { id: "app-1", stage: "preparing" }, error: null });
    const notify = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getNotifier).mockReturnValue({ notify });

    await advanceMyApplication("app-1", "start_preparing");

    expect(vi.mocked(trackEvent)).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("[test 22] logged out: never calls the RPC, returns a friendly error", async () => {
    setUser(null);

    const result = await advanceMyApplication("app-1", "submit");

    expect(result.success).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("passes the exact application id and action through to the RPC, never a raw stage string", async () => {
    fake.rpc.mockResolvedValue({ data: { id: "app-1" }, error: null });

    await advanceMyApplication("app-1", "mark_ready_to_submit");

    expect(fake.rpc).toHaveBeenCalledWith("student_advance_application", { p_application_id: "app-1", p_action: "mark_ready_to_submit" });
  });
});

describe("updateMyApplicationNote", () => {
  it("relays the RPC's error message on failure", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: { message: "This application could not be updated — it may not be yours." } });

    const result = await updateMyApplicationNote("app-1", "hello");

    expect(result).toEqual({ success: false, error: "This application could not be updated — it may not be yours." });
  });

  it("succeeds and never itself mutates any field other than the note via the RPC boundary", async () => {
    fake.rpc.mockResolvedValue({ data: { id: "app-1", student_note: "hello" }, error: null });

    const result = await updateMyApplicationNote("app-1", "hello");

    expect(result).toEqual({ success: true });
    expect(fake.rpc).toHaveBeenCalledWith("student_update_application_note", { p_application_id: "app-1", p_note: "hello" });
  });

  it("logged out: never calls the RPC", async () => {
    setUser(null);

    const result = await updateMyApplicationNote("app-1", "hello");

    expect(result.success).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// startApplicationFromCourse — v3: now delegates entirely to the
// SECURITY DEFINER RPC student_start_application() (database-authoritative
// creation, ownership, course/university verification, reapplication, and
// concurrency), with a best-effort get_my_applications() pre-check used only
// to decide whether to fire `application_started` analytics (spec test
// 7/14/15/16/17/38).
// ---------------------------------------------------------------------------

/** Wires fake.rpc to answer by RPC name, for tests that need both get_my_applications() (the pre-check) and student_start_application() (the actual call) to behave independently. */
function mockRpc(handlers: Partial<Record<string, (params?: Record<string, unknown>) => { data: unknown; error: { message: string } | null }>>) {
  fake.rpc.mockImplementation((name: string, params?: Record<string, unknown>) => {
    const handler = handlers[name];
    return Promise.resolve(handler ? handler(params) : { data: null, error: null });
  });
}

describe("startApplicationFromCourse", () => {
  it("[test 7 / patch-issue-3.7] maps a duplicate-active-application constraint violation to a friendly error, never a raw Postgres message (the DB partial unique index as the authoritative backstop for a genuine concurrent race)", async () => {
    mockRpc({
      get_my_applications: () => ({ data: [], error: null }),
      student_start_application: () => ({ data: null, error: { message: 'duplicate key value violates unique constraint "applications_one_active_per_student_course_no_intake"' } }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: false, error: "You already have an active application for this course." });
  });

  it("[test 12] a valid course/university pair is accepted — the RPC is called with both ids, and success returns the new application id", async () => {
    mockRpc({
      get_my_applications: () => ({ data: [], error: null }),
      student_start_application: () => ({ data: "new-app-id", error: null }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "new-app-id" });
    expect(fake.rpc).toHaveBeenCalledWith("student_start_application", { p_course_id: "course-1", p_university_id: "university-1" });
    expect(vi.mocked(trackEvent)).toHaveBeenCalledWith(expect.objectContaining({ eventName: "application_started", entityId: "new-app-id" }));
  });

  it("[test 13] a mismatched course/university pair is rejected with a safe, generic error — never a raw constraint/enumeration-revealing message", async () => {
    mockRpc({
      get_my_applications: () => ({ data: [], error: null }),
      student_start_application: () => ({ data: null, error: { message: "This course could not be found or is not currently accepting applications." } }),
    });

    const result = await startApplicationFromCourse("course-1", "university-mismatched");

    expect(result).toEqual({ success: false, error: "This course could not be found or is not currently accepting applications." });
  });

  it("logged out: never calls any RPC, returns a friendly error", async () => {
    setUser(null);

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result.success).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("reuses an existing non-terminal application id (found by the pre-check) rather than calling student_start_application() at all", async () => {
    mockRpc({
      get_my_applications: () => ({ data: [fullRow({ id: "existing-app", course_id: "course-1", stage: "inquiry" })], error: null }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "existing-app" });
    expect(fake.rpc).not.toHaveBeenCalledWith("student_start_application", expect.anything());
    expect(vi.mocked(trackEvent)).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // Patch — Issue 3 (v2, still intact under v3): reapplication after
  // rejected/withdrawn must never be blocked by treating an old terminal
  // application as "the existing application".
  // ---------------------------------------------------------------------

  it("[patch-issue-3.1] an active 'inquiry' application is reused via the pre-check", async () => {
    mockRpc({ get_my_applications: () => ({ data: [fullRow({ id: "existing-app", course_id: "course-1", stage: "inquiry" })], error: null }) });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "existing-app" });
  });

  it("[patch-issue-3.2] an active 'preparing' application is reused via the pre-check", async () => {
    mockRpc({ get_my_applications: () => ({ data: [fullRow({ id: "existing-app", course_id: "course-1", stage: "preparing" })], error: null }) });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "existing-app" });
  });

  it("[patch-issue-3.3] a submitted/under_review/offer_received/enrolled application is not duplicated — the existing one is reused, not re-created", async () => {
    for (const stage of ["submitted", "under_review", "offer_received", "enrolled"]) {
      setUser("student-1");
      mockRpc({ get_my_applications: () => ({ data: [fullRow({ id: `existing-${stage}`, course_id: "course-1", stage })], error: null }) });

      const result = await startApplicationFromCourse("course-1", "university-1");

      expect(result).toEqual({ success: true, applicationId: `existing-${stage}` });
      expect(vi.mocked(trackEvent)).not.toHaveBeenCalled();
    }
  });

  it("[test 15 / patch-issue-3.4] a 'rejected' application does NOT block a new application — student_start_application() is called and a fresh id is returned", async () => {
    mockRpc({
      get_my_applications: () => ({ data: [fullRow({ id: "old-rejected-app", course_id: "course-1", stage: "rejected" })], error: null }),
      student_start_application: () => ({ data: "fresh-app-id", error: null }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "fresh-app-id" });
    expect(vi.mocked(trackEvent)).toHaveBeenCalledWith(expect.objectContaining({ eventName: "application_started" }));
  });

  it("[test 16 / patch-issue-3.5] a 'withdrawn' application does NOT block a new application — student_start_application() is called and a fresh id is returned", async () => {
    mockRpc({
      get_my_applications: () => ({ data: [fullRow({ id: "old-withdrawn-app", course_id: "course-1", stage: "withdrawn" })], error: null }),
      student_start_application: () => ({ data: "fresh-app-id-2", error: null }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "fresh-app-id-2" });
  });

  it("[patch-issue-3.6] multiple historical terminal applications for the same course do not break the pre-check — a fresh application is still created", async () => {
    mockRpc({
      get_my_applications: () => ({
        data: [
          fullRow({ id: "old-rejected-1", course_id: "course-1", stage: "rejected" }),
          fullRow({ id: "old-withdrawn-1", course_id: "course-1", stage: "withdrawn" }),
          fullRow({ id: "old-rejected-2", course_id: "course-1", stage: "rejected" }),
        ],
        error: null,
      }),
      student_start_application: () => ({ data: "fresh-app-id-3", error: null }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "fresh-app-id-3" });
  });

  it("[test 17] a genuine concurrent-creation race is resolved by the RPC itself returning the winning row's id, not a raw constraint error — the pre-check missing it is not a problem", async () => {
    // Simulates the pre-check racing against a concurrent insert: the
    // pre-check sees no existing application, but by the time
    // student_start_application() runs, the RPC's own unique_violation
    // handler has already resolved the race server-side and returns the
    // id of whichever row actually won.
    mockRpc({
      get_my_applications: () => ({ data: [], error: null }),
      student_start_application: () => ({ data: "winning-app-id", error: null }),
    });

    const result = await startApplicationFromCourse("course-1", "university-1");

    expect(result).toEqual({ success: true, applicationId: "winning-app-id" });
  });
});
