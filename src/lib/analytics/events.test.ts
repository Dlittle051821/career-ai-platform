import { describe, expect, it } from "vitest";
import { EVENT_NAMES, IMPLEMENTED_EVENT_NAMES, PRODUCT_EVENTS, isImplementedEventName } from "./events";

describe("PRODUCT_EVENTS registry", () => {
  it("has no duplicate event names", () => {
    const unique = new Set(EVENT_NAMES);
    expect(unique.size).toBe(EVENT_NAMES.length);
  });

  it("every entry's own .name matches its registry key", () => {
    for (const name of EVENT_NAMES) {
      expect(PRODUCT_EVENTS[name].name).toBe(name);
    }
  });

  it("every entry is snake_case (lowercase letters, digits, underscores only)", () => {
    for (const name of EVENT_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("every entry has a non-empty reason", () => {
    for (const name of EVENT_NAMES) {
      expect(PRODUCT_EVENTS[name].reason.length).toBeGreaterThan(0);
    }
  });

  it("status is either implemented or reserved, nothing else", () => {
    for (const name of EVENT_NAMES) {
      expect(["implemented", "reserved"]).toContain(PRODUCT_EVENTS[name].status);
    }
  });

  it("IMPLEMENTED_EVENT_NAMES is exactly the subset with status 'implemented'", () => {
    const expected = EVENT_NAMES.filter((n) => PRODUCT_EVENTS[n].status === "implemented");
    expect([...IMPLEMENTED_EVENT_NAMES].sort()).toEqual([...expected].sort());
  });

  it("reserved assessment_* events are all present and reserved (no quiz/assessment feature exists)", () => {
    const assessmentNames = ["assessment_started", "assessment_answered", "assessment_completed", "assessment_result_viewed"] as const;
    for (const name of assessmentNames) {
      expect(PRODUCT_EVENTS[name].status).toBe("reserved");
    }
  });

  it("package_viewed/package_selected are reserved (satisfied by pricing_analytics_events instead)", () => {
    expect(PRODUCT_EVENTS.package_viewed.status).toBe("reserved");
    expect(PRODUCT_EVENTS.package_selected.status).toBe("reserved");
  });
});

describe("isImplementedEventName", () => {
  it("accepts every implemented event name", () => {
    for (const name of IMPLEMENTED_EVENT_NAMES) {
      expect(isImplementedEventName(name)).toBe(true);
    }
  });

  it("rejects a reserved event name", () => {
    expect(isImplementedEventName("assessment_completed")).toBe(false);
  });

  it("rejects an unknown string", () => {
    expect(isImplementedEventName("not_a_real_event")).toBe(false);
    expect(isImplementedEventName("")).toBe(false);
  });
});
