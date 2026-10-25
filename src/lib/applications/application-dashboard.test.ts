import { describe, expect, it } from "vitest";
import { getUpcomingApplicationDeadlines, mergeRecentApplicationActivity, type UpcomingDeadlineInput, type RecentApplicationActivityInput } from "./application-dashboard";

/**
 * NW06.2 — pure, framework-free unit tests for
 * src/lib/applications/application-dashboard.ts (Abroad Application
 * Dashboard composition logic). Same convention as every other
 * src/lib/applications/*.test.ts file.
 */

describe("getUpcomingApplicationDeadlines", () => {
  const now = new Date("2026-10-25T00:00:00Z");

  it("returns an empty list for no inputs", () => {
    expect(getUpcomingApplicationDeadlines([], now)).toEqual([]);
  });

  it("sorts soonest-first", () => {
    const inputs: UpcomingDeadlineInput[] = [
      { applicationId: "a", label: "A", stage: "preparing", deadline: { label: "Final", date: "2026-12-01" } },
      { applicationId: "b", label: "B", stage: "preparing", deadline: { label: "Final", date: "2026-11-01" } },
      { applicationId: "c", label: "C", stage: "preparing", deadline: { label: "Final", date: "2027-01-01" } },
    ];
    const result = getUpcomingApplicationDeadlines(inputs, now);
    expect(result.map((r) => r.applicationId)).toEqual(["b", "a", "c"]);
  });

  it("excludes closed-bucket applications (enrolled/rejected/withdrawn) even if a deadline is present", () => {
    const inputs: UpcomingDeadlineInput[] = [
      { applicationId: "a", label: "A", stage: "preparing", deadline: { label: "Final", date: "2026-11-01" } },
      { applicationId: "b", label: "B", stage: "enrolled", deadline: { label: "Final", date: "2026-10-26" } },
      { applicationId: "c", label: "C", stage: "rejected", deadline: { label: "Final", date: "2026-10-26" } },
      { applicationId: "d", label: "D", stage: "withdrawn", deadline: { label: "Final", date: "2026-10-26" } },
    ];
    const result = getUpcomingApplicationDeadlines(inputs, now);
    expect(result.map((r) => r.applicationId)).toEqual(["a"]);
  });

  it("flags an already-passed deadline as overdue, but still includes it — never silently hides it", () => {
    const inputs: UpcomingDeadlineInput[] = [{ applicationId: "a", label: "A", stage: "preparing", deadline: { label: "Final", date: "2026-10-01" } }];
    const result = getUpcomingApplicationDeadlines(inputs, now);
    expect(result).toHaveLength(1);
    expect(result[0].isOverdue).toBe(true);
  });

  it("does not flag a future deadline as overdue", () => {
    const inputs: UpcomingDeadlineInput[] = [{ applicationId: "a", label: "A", stage: "preparing", deadline: { label: "Final", date: "2026-12-01" } }];
    expect(getUpcomingApplicationDeadlines(inputs, now)[0].isOverdue).toBe(false);
  });

  it("respects the limit parameter", () => {
    const inputs: UpcomingDeadlineInput[] = Array.from({ length: 10 }, (_, i) => ({
      applicationId: String(i),
      label: String(i),
      stage: "preparing" as const,
      deadline: { label: "Final", date: `2026-11-${String(i + 1).padStart(2, "0")}` },
    }));
    expect(getUpcomingApplicationDeadlines(inputs, now, 3)).toHaveLength(3);
  });
});

describe("mergeRecentApplicationActivity", () => {
  it("returns an empty list for no inputs", () => {
    expect(mergeRecentApplicationActivity([])).toEqual([]);
  });

  it("sorts newest-first across multiple applications, never grouping by application", () => {
    const inputs: RecentApplicationActivityInput[] = [
      { id: "1", applicationId: "a", applicationLabel: "A", message: "oldest", createdAt: "2026-01-01T00:00:00Z" },
      { id: "2", applicationId: "b", applicationLabel: "B", message: "newest", createdAt: "2026-10-01T00:00:00Z" },
      { id: "3", applicationId: "a", applicationLabel: "A", message: "middle", createdAt: "2026-05-01T00:00:00Z" },
    ];
    const result = mergeRecentApplicationActivity(inputs);
    expect(result.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("respects the limit parameter, keeping only the newest entries", () => {
    const inputs: RecentApplicationActivityInput[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      applicationId: "a",
      applicationLabel: "A",
      message: "m",
      createdAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    const result = mergeRecentApplicationActivity(inputs, 8);
    expect(result).toHaveLength(8);
    expect(result[0].id).toBe("11");
  });

  it("never mutates the input array", () => {
    const inputs: RecentApplicationActivityInput[] = [
      { id: "1", applicationId: "a", applicationLabel: "A", message: "m1", createdAt: "2026-01-01T00:00:00Z" },
      { id: "2", applicationId: "a", applicationLabel: "A", message: "m2", createdAt: "2026-02-01T00:00:00Z" },
    ];
    const original = [...inputs];
    mergeRecentApplicationActivity(inputs);
    expect(inputs).toEqual(original);
  });
});
