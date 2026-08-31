import { describe, expect, it } from "vitest";
import { buildEventInsert, type TrackEventInput } from "./track";

function input(overrides: Partial<TrackEventInput> = {}): TrackEventInput {
  return {
    eventName: "career_viewed",
    ...overrides,
  } as TrackEventInput;
}

describe("buildEventInsert — valid events", () => {
  it("builds an insert shape for a minimal valid event", () => {
    const result = buildEventInsert(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.event_name).toBe("career_viewed");
    expect(result.insert.properties).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  it("carries through source/path/feature/entityType/entityId/utm", () => {
    const result = buildEventInsert(
      input({
        source: "career_detail_page",
        path: "/careers/ev-systems-engineer",
        feature: "career_explorer",
        entityType: "career",
        entityId: "11111111-1111-1111-1111-111111111111",
        utm: { source: "google", medium: "cpc" },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.source).toBe("career_detail_page");
    expect(result.insert.path).toBe("/careers/ev-systems-engineer");
    expect(result.insert.feature).toBe("career_explorer");
    expect(result.insert.entity_type).toBe("career");
    expect(result.insert.entity_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.insert.utm_source).toBe("google");
    expect(result.insert.utm_medium).toBe("cpc");
  });

  it("trims and clamps overlong string fields rather than rejecting the event", () => {
    const longSource = "x".repeat(500);
    const result = buildEventInsert(input({ source: longSource }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.source?.length).toBeLessThanOrEqual(64);
  });

  it("treats blank/whitespace-only optional strings as null", () => {
    const result = buildEventInsert(input({ source: "   ", path: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.source).toBeNull();
    expect(result.insert.path).toBeNull();
  });
});

describe("buildEventInsert — invalid event name is rejected", () => {
  it("rejects an unknown event name", () => {
    const result = buildEventInsert(input({ eventName: "not_a_real_event" as TrackEventInput["eventName"] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not_a_real_event");
  });

  it("rejects a reserved (not-yet-implemented) event name", () => {
    const result = buildEventInsert(input({ eventName: "assessment_completed" as TrackEventInput["eventName"] }));
    expect(result.ok).toBe(false);
  });

  it("rejects a missing eventName", () => {
    // @ts-expect-error — deliberately testing a malformed call site
    const result = buildEventInsert({});
    expect(result.ok).toBe(false);
  });
});

describe("buildEventInsert — oversized/malformed properties are handled safely, never crash, never reject the whole event", () => {
  it("drops a non-object properties value and still succeeds", () => {
    const result = buildEventInsert(input({ properties: "not an object" as unknown as Record<string, unknown> }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.properties).toEqual({});
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("drops an array passed as properties", () => {
    const result = buildEventInsert(input({ properties: [1, 2, 3] as unknown as Record<string, unknown> }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.properties).toEqual({});
  });

  it("strips keys that look like they might carry sensitive data", () => {
    const result = buildEventInsert(
      input({
        properties: { password: "hunter2", authToken: "abc", homeAddress: "1 Main St", safeCount: 3 },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.properties).toEqual({ safeCount: 3 });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("truncates an overlong string property value instead of dropping the whole event", () => {
    const result = buildEventInsert(input({ properties: { note: "x".repeat(1000) } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.insert.properties.note;
    // "note" itself is in the denylist pattern (ends with "note"/"notes"),
    // so it is dropped entirely — confirm that, and separately confirm
    // truncation on a non-denylisted long key.
    expect(value).toBeUndefined();
  });

  it("truncates a long value under a safe key name", () => {
    const result = buildEventInsert(input({ properties: { description: "y".repeat(1000) } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.insert.properties.description as string).length).toBeLessThanOrEqual(300);
  });

  it("drops nested objects/functions inside properties, keeps primitives", () => {
    const result = buildEventInsert(
      input({
        properties: {
          nested: { a: 1 },
          fn: () => 1,
          ok: "value",
          num: 42,
          flag: true,
          nil: null,
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.properties).toEqual({ ok: "value", num: 42, flag: true, nil: null });
  });

  it("caps the number of property keys", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 50; i++) many[`key${i}`] = i;
    const result = buildEventInsert(input({ properties: many }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.insert.properties).length).toBeLessThanOrEqual(20);
  });

  it("drops the whole properties object if it is still too large after sanitization", () => {
    const props: Record<string, string> = {};
    for (let i = 0; i < 20; i++) props[`k${i}`] = "z".repeat(300);
    const result = buildEventInsert(input({ properties: props }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.properties).toEqual({});
  });

  it("drops an entityId that is not a valid uuid rather than rejecting the event", () => {
    const result = buildEventInsert(input({ entityId: "not-a-uuid" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.entity_id).toBeNull();
  });

  it("accepts a well-formed uuid entityId", () => {
    const result = buildEventInsert(input({ entityId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insert.entity_id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
