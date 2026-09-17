import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminValidationError } from "@/lib/admin/form-state";

/**
 * Milestone 16 — orchestration tests for
 * src/lib/supabase/admin/applications.ts, focused on the two things that
 * genuinely changed in this milestone: updateApplication()'s new
 * database-authoritative conditional update (closing the stale-write race
 * the M13 FINAL FINANCIAL SAFETY PATCH pattern already closed for refunds —
 * see src/lib/supabase/admin/refunds.test.ts, whose hand-rolled in-memory
 * Supabase fake this file's fake mirrors) and the new
 * submitted_at/decision_at/withdrawn_at timestamp stamping. There is no
 * live Postgres in this test environment — see
 * application-workflow-migration-security.test.ts for the SQL layer's own
 * static-analysis coverage.
 */

vi.mock("../server", () => ({ createClient: vi.fn() }));
vi.mock("../admin-auth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("./audit", () => ({ recordAuditLog: vi.fn() }));
vi.mock("../analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/notifications/get-notifier", () => ({ getNotifier: vi.fn() }));

import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { trackEvent } from "../analytics/track";
import { getNotifier } from "@/lib/notifications/get-notifier";
import { getApplicationById, updateApplication } from "./applications";

// ---------------------------------------------------------------------------
// Hand-rolled in-memory fake Supabase client — same shape as
// refunds.test.ts's own fake (supports exactly the chains applications.ts
// uses: .select().eq().maybeSingle(), .select().in(), .update().eq().eq()
// .select().maybeSingle(), .insert(), and a plain awaited select via
// .then()).
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

interface RaceHook {
  table: string;
  id: string;
  mutate: (tables: Tables) => void;
}

function makeFakeSupabase(tables: Tables) {
  const pendingRaces: RaceHook[] = [];

  function from(table: string) {
    tables[table] = tables[table] ?? [];
    let mode: "select" | "update" | "insert" = "select";
    let updatePatch: Row | null = null;
    let insertRow: Row | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    let filterIds: string[] = [];

    function currentRows(): Row[] {
      return tables[table];
    }

    function matched(): Row[] {
      return currentRows().filter((r) => filters.every((f) => f(r)));
    }

    function applyRaceIfSelecting(): Row[] {
      if (mode !== "select") return matched();
      const idFilter = filterIds[0];
      if (idFilter) {
        const hookIdx = pendingRaces.findIndex((h) => h.table === table && h.id === idFilter);
        if (hookIdx !== -1) {
          const snapshot = matched().map((r) => ({ ...r }));
          const [hook] = pendingRaces.splice(hookIdx, 1);
          hook.mutate(tables);
          return snapshot;
        }
      }
      return matched();
    }

    function runMutationAndReturn(): Row[] {
      if (mode === "update") {
        const targets = matched();
        for (const row of targets) Object.assign(row, updatePatch);
        return targets;
      }
      if (mode === "insert") {
        const row: Row = { id: `generated-${currentRows().length + 1}`, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...(insertRow ?? {}) };
        currentRows().push(row);
        return [row];
      }
      return applyRaceIfSelecting();
    }

    const builder = {
      select(_cols?: unknown, opts?: { count?: string }) {
        void opts;
        return builder;
      },
      update(patch: Row) {
        mode = "update";
        updatePatch = patch;
        return builder;
      },
      insert(row: Row) {
        mode = "insert";
        insertRow = row;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        if (col === "id" && typeof val === "string") filterIds.push(val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      or() {
        return builder;
      },
      order() {
        return builder;
      },
      range() {
        const rows = runMutationAndReturn();
        return Promise.resolve({ data: rows, error: null, count: rows.length });
      },
      maybeSingle() {
        const rows = runMutationAndReturn();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        const rows = runMutationAndReturn();
        if (rows.length === 0) return Promise.resolve({ data: null, error: { message: "no rows" } });
        return Promise.resolve({ data: rows[0], error: null });
      },
      then(onFulfilled: (v: { data: Row[]; error: null }) => unknown, onRejected?: (e: unknown) => unknown) {
        const rows = runMutationAndReturn();
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    from,
    _tables: tables,
    _raceOnNextRead(table: string, id: string, mutate: (tables: Tables) => void) {
      pendingRaces.push({ table, id, mutate });
    },
  };
}

type FakeSupabase = ReturnType<typeof makeFakeSupabase>;

const ADMIN = { userId: "admin-1", email: "admin@example.com", role: "admin" as const, counsellorId: null };

function baseApplicationRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "app-1",
    student_user_id: "student-1",
    university_id: null,
    course_id: null,
    course_intake_id: null,
    assigned_counsellor_id: null,
    stage: "inquiry",
    intake: null,
    submission_date: null,
    decision_status: "pending",
    offer_type: null,
    deadlines: [],
    next_action: null,
    next_action_date: null,
    last_contact_date: null,
    internal_notes: null,
    student_note: null,
    submitted_at: null,
    decision_at: null,
    withdrawn_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("studentUserId", "student-1");
  fd.set("decisionStatus", "pending");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

let fake: FakeSupabase;

beforeEach(() => {
  vi.clearAllMocks();
  fake = makeFakeSupabase({});
  vi.mocked(createClient).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(requireAdminPermission).mockResolvedValue(ADMIN);
  vi.mocked(recordAuditLog).mockResolvedValue(undefined);
  vi.mocked(getNotifier).mockReturnValue({ notify: vi.fn().mockResolvedValue(undefined) });
});

describe("updateApplication — atomic conditional update (spec: concurrent status updates)", () => {
  it("[test 23] a stale admin update cannot overwrite an application some other actor has already moved on", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "preparing" })];
    // Admin's read of `preparing` races against the student's own
    // student_advance_application() RPC moving the row to ready_to_submit
    // in between the admin's read and their write.
    fake._raceOnNextRead("applications", "app-1", (tables) => {
      const row = tables.applications.find((r) => r.id === "app-1")!;
      row.stage = "ready_to_submit";
    });

    await expect(updateApplication("app-1", makeFormData({ stage: "ready_to_submit" }))).rejects.toThrow(AdminValidationError);
    expect(fake._tables.applications[0].stage).toBe("ready_to_submit");
  });

  it("[test 24] a valid, non-raced transition still succeeds and records history", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "inquiry" })];

    await updateApplication("app-1", makeFormData({ stage: "preparing" }));

    expect(fake._tables.applications[0].stage).toBe("preparing");
    expect(fake._tables.application_status_history).toHaveLength(1);
    expect(fake._tables.application_status_history[0]).toMatchObject({ from_status: "inquiry", to_status: "preparing", actor_type: "admin" });
  });

  it("[test 25] an admin cannot move an application through a transition the graph forbids, even before touching the database", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "preparing" })];

    await expect(updateApplication("app-1", makeFormData({ stage: "submitted" }))).rejects.toThrow(AdminValidationError);
    expect(fake._tables.applications[0].stage).toBe("preparing");
  });

  it("[test 26] moving to 'submitted' stamps submitted_at atomically", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "ready_to_submit" })];

    await updateApplication("app-1", makeFormData({ stage: "submitted" }));

    expect(fake._tables.applications[0].stage).toBe("submitted");
    expect(fake._tables.applications[0].submitted_at).toBeTruthy();
  });

  it("[test 27] moving to a terminal decision stamps decision_at, and moving to withdrawn stamps withdrawn_at — never both at once", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "decision_pending" })];
    await updateApplication("app-1", makeFormData({ stage: "offer_received" }));
    expect(fake._tables.applications[0].decision_at).toBeTruthy();
    expect(fake._tables.applications[0].withdrawn_at).toBeNull();

    fake._tables.applications = [baseApplicationRow({ id: "app-2", stage: "preparing" })];
    await updateApplication("app-2", makeFormData({ stage: "withdrawn" }));
    expect(fake._tables.applications[0].withdrawn_at).toBeTruthy();
    expect(fake._tables.applications[0].decision_at).toBeNull();
  });

  it("a no-op save (same stage, other fields changed) does not require the stage to be unchanged in the database at write time, and records no history event", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "preparing" })];

    await updateApplication("app-1", makeFormData({ stage: "preparing", offerType: "Conditional" }));

    expect(fake._tables.applications[0].stage).toBe("preparing");
    expect(fake._tables.applications[0].offer_type).toBe("Conditional");
    expect(fake._tables.application_status_history ?? []).toHaveLength(0);
  });

  it("fires application_status_changed and notifies the student on offer_received / rejected, but not on every intermediate move", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "decision_pending" })];
    fake._tables.profiles = [{ id: "student-1", email: "student@example.com", account_type: "student" }];
    const notify = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getNotifier).mockReturnValue({ notify });

    await updateApplication("app-1", makeFormData({ stage: "offer_received" }));

    expect(vi.mocked(trackEvent)).toHaveBeenCalledWith(expect.objectContaining({ eventName: "application_status_changed" }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ to: "student@example.com", template: "application_offer_received" }));
  });

  it("does not notify the student for an intermediate move like inquiry -> preparing", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1", stage: "inquiry" })];
    fake._tables.profiles = [{ id: "student-1", email: "student@example.com", account_type: "student" }];
    const notify = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getNotifier).mockReturnValue({ notify });

    await updateApplication("app-1", makeFormData({ stage: "preparing" }));

    expect(notify).not.toHaveBeenCalled();
  });
});

describe("getApplicationById — student-visible history mapping", () => {
  it("[test 14] surfaces actorType and studentVisibleMessage on every history entry, defaulting actorType to 'system'", async () => {
    fake._tables.applications = [baseApplicationRow({ id: "app-1" })];
    fake._tables.application_status_history = [
      { id: "h1", application_id: "app-1", from_status: null, to_status: "inquiry", changed_by: "admin-1", note: "internal", actor_type: null, student_visible_message: null, created_at: "2026-01-01T00:00:00Z" },
    ];

    const detail = await getApplicationById("app-1");

    expect(detail?.statusHistory[0].actorType).toBe("system");
    expect(detail?.statusHistory[0].note).toBe("internal");
  });
});
