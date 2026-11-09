import { describe, expect, it } from "vitest";
import { InvalidIstDateTimeError, istDateTimeLocalToUtcIso, utcIsoToIstDateTimeLocal } from "./ist";
import { formatDiscoverySessionDateTime } from "./format";

/**
 * CC-22B — staff-entered Discovery Session times are IST regardless of the
 * server's timezone. This file is also run under TZ=UTC, TZ=Asia/Kolkata
 * and TZ=America/New_York by the CC-22B verification (see the test report);
 * nothing here may depend on the host zone.
 */
describe("Discovery Session IST scheduling", () => {
  it("10:00 IST is stored as 04:30 UTC", () => {
    expect(istDateTimeLocalToUtcIso("2026-11-18T10:00")).toBe("2026-11-18T04:30:00.000Z");
  });

  it("10:00 IST entered by staff is shown to the student as 10:00 am IST", () => {
    const stored = istDateTimeLocalToUtcIso("2026-11-18T10:00");
    expect(formatDiscoverySessionDateTime(stored)).toMatch(/10:00\s?am IST$/i);
  });

  it("round-trips back into the staff form unchanged", () => {
    for (const value of ["2026-11-18T10:00", "2026-11-18T00:15", "2026-12-31T23:59", "2027-03-01T05:29", "2027-03-01T05:30"]) {
      expect(utcIsoToIstDateTimeLocal(istDateTimeLocalToUtcIso(value))).toBe(value);
    }
  });

  it("crosses the UTC day boundary correctly", () => {
    expect(istDateTimeLocalToUtcIso("2026-11-18T03:00")).toBe("2026-11-17T21:30:00.000Z");
    expect(utcIsoToIstDateTimeLocal("2026-11-17T21:30:00.000Z")).toBe("2026-11-18T03:00");
  });

  it("does not depend on the host timezone", () => {
    // The result is a pure function of the input string — compare against the arithmetic definition.
    const expected = new Date(Date.UTC(2026, 10, 18, 10, 0) - 330 * 60_000).toISOString();
    expect(istDateTimeLocalToUtcIso("2026-11-18T10:00")).toBe(expected);
  });

  it("an existing stored value pre-fills as its IST wall-clock time (no stored data is rewritten)", () => {
    expect(utcIsoToIstDateTimeLocal("2026-11-18T10:00:00.000Z")).toBe("2026-11-18T15:30");
    expect(utcIsoToIstDateTimeLocal(null)).toBe("");
    expect(utcIsoToIstDateTimeLocal("not a date")).toBe("");
  });

  it.each(["", "2026-11-18", "18/11/2026 10:00", "2026-02-30T10:00", "2026-11-18T24:00", "2026-11-18T10:60", "2026-11-18T10:00Z"])(
    "rejects %j",
    (value) => {
      expect(() => istDateTimeLocalToUtcIso(value)).toThrow(InvalidIstDateTimeError);
    },
  );
});
