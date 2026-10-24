import { describe, expect, it } from "vitest";
import { formatDiscoverySessionDateTime, formatDiscoverySessionDate } from "./format";

/**
 * NW01 Part G — regression coverage for the confirmed "no timezone shown"
 * defect. A UTC instant that lands on a different calendar day/hour in
 * IST (Asia/Kolkata is UTC+5:30) is used deliberately below so a
 * regression that silently drops the explicit `timeZone` option (and
 * falls back to the runtime's default, typically UTC in CI) is caught by
 * a wrong hour/day, not just a missing "IST" suffix.
 */
describe("formatDiscoverySessionDateTime", () => {
  it("always ends with an explicit IST label", () => {
    expect(formatDiscoverySessionDateTime("2026-01-15T04:30:00.000Z")).toMatch(/IST$/);
  });

  it("formats in Asia/Kolkata (UTC+5:30), not the runtime default — 04:30 UTC is 10:00 IST, the same calendar day", () => {
    const formatted = formatDiscoverySessionDateTime("2026-01-15T04:30:00.000Z");
    expect(formatted).toContain("10:00");
    expect(formatted).toMatch(/15 Jan/);
  });

  it("correctly rolls the calendar day forward in IST when the UTC instant is late enough (18:30 UTC -> 00:00 IST the next day)", () => {
    const formatted = formatDiscoverySessionDateTime("2026-01-15T18:30:00.000Z");
    expect(formatted).toMatch(/16 Jan/);
    expect(formatted).toContain("12:00");
  });
});

describe("formatDiscoverySessionDate", () => {
  it("always ends with an explicit IST label", () => {
    expect(formatDiscoverySessionDate("2026-01-15T04:30:00.000Z")).toMatch(/IST$/);
  });

  it("formats the calendar date in Asia/Kolkata, not the runtime default", () => {
    expect(formatDiscoverySessionDate("2026-01-15T20:00:00.000Z")).toContain("16 Jan 2026");
  });
});
