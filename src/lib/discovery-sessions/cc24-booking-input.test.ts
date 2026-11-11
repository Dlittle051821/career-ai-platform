import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOVERY_SESSION_LANGUAGES,
  DISCOVERY_SESSION_NOTES_MAX_LENGTH,
  DISCOVERY_SESSION_TIME_RANGES,
  normalizeBookingInput,
} from "./booking-input";

/**
 * CC-24 — regression for CC-23 F8: the Discovery Session request action
 * stored a 20,000-character note and a 5,000-character "language" sent
 * directly to the Server Action. The pure normalizer is tested first, then
 * the real I/O function with only Supabase replaced, to prove nothing
 * reaches the database when input is rejected.
 */

const valid = { preferredContactMethod: "whatsapp", preferredTimeRange: "evening", preferredLanguage: "Odia", studentNotes: "  Unsure between design and CS.  " };

describe("normalizeBookingInput", () => {
  it("accepts the form's own choices and trims the note", () => {
    const r = normalizeBookingInput(valid);
    expect(r).toEqual({
      ok: true,
      value: { preferredContactMethod: "whatsapp", preferredTimeRange: "evening", preferredLanguage: "Odia", studentNotes: "Unsure between design and CS." },
    });
  });

  it("treats missing, null and empty values as 'no preference'", () => {
    expect(normalizeBookingInput({})).toEqual({
      ok: true,
      value: { preferredContactMethod: null, preferredTimeRange: null, preferredLanguage: null, studentNotes: null },
    });
    expect(normalizeBookingInput({ preferredTimeRange: "", studentNotes: "   " })).toMatchObject({ ok: true, value: { preferredTimeRange: null, studentNotes: null } });
  });

  it("offers exactly the options the booking form shows", () => {
    expect(DISCOVERY_SESSION_TIME_RANGES).toEqual(["morning", "afternoon", "evening"]);
    expect(DISCOVERY_SESSION_LANGUAGES).toEqual(["English", "Odia", "Hindi"]);
  });

  it.each([
    ["contact method", { preferredContactMethod: "carrier-pigeon" }],
    ["contact method type", { preferredContactMethod: 42 }],
    ["time range", { preferredTimeRange: "3am" }],
    ["language", { preferredLanguage: "x".repeat(5000) }],
    ["language casing", { preferredLanguage: "english" }],
    ["note type", { studentNotes: { html: "<b>" } }],
  ])("rejects an invalid %s", (_label, input) => {
    expect(normalizeBookingInput(input).ok).toBe(false);
  });

  it("rejects a note over the limit and accepts one exactly at it", () => {
    expect(normalizeBookingInput({ studentNotes: "a".repeat(20000) })).toEqual({
      ok: false,
      reason: `Please keep your note to ${DISCOVERY_SESSION_NOTES_MAX_LENGTH} characters or fewer.`,
    });
    expect(normalizeBookingInput({ studentNotes: "a".repeat(DISCOVERY_SESSION_NOTES_MAX_LENGTH) }).ok).toBe(true);
  });

  it.each([[null], [undefined], ["string"], [["array"]], [7]])("rejects a non-object payload %p", (payload) => {
    expect(normalizeBookingInput(payload).ok).toBe(false);
  });

  it("never echoes the submitted value in its reason", () => {
    const r = normalizeBookingInput({ preferredLanguage: "<script>alert(1)</script>" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).not.toContain("<script>");
  });
});

const db = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn() }));

vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "student-fixture" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      insert: (row: unknown) => {
        db.insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "session-1" }, error: null }) }) };
      },
    }),
  }),
}));

describe("bookDiscoverySession (server side)", () => {
  beforeEach(() => db.insert.mockReset());

  it("refuses an over-long note before anything is written", async () => {
    const { bookDiscoverySession } = await import("@/lib/supabase/discovery-sessions/book");
    await expect(
      bookDiscoverySession({ preferredContactMethod: "phone", preferredTimeRange: null, preferredLanguage: null, studentNotes: "a".repeat(20000) })
    ).rejects.toThrow(/1000 characters or fewer/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("refuses a value outside the allow-list sent directly to the action", async () => {
    const { bookDiscoverySession } = await import("@/lib/supabase/discovery-sessions/book");
    const forged = { preferredContactMethod: "phone", preferredTimeRange: "midnight", preferredLanguage: null, studentNotes: null } as never;
    await expect(bookDiscoverySession(forged)).rejects.toThrow(/morning, afternoon, evening/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("stores only the normalized values for a valid request", async () => {
    const { bookDiscoverySession } = await import("@/lib/supabase/discovery-sessions/book");
    await expect(bookDiscoverySession(valid as never)).resolves.toBe("session-1");
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "requested",
        assigned_counsellor_id: null,
        preferred_contact_method: "whatsapp",
        preferred_time_range: "evening",
        preferred_language: "Odia",
        student_notes: "Unsure between design and CS.",
      })
    );
  });
});
