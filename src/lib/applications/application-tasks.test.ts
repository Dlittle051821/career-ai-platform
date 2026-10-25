import { describe, expect, it } from "vitest";
import {
  APPLICATION_TASK_STATUSES,
  APPLICATION_TASK_TYPES,
  getAllowedStaffTaskTransitions,
  isApplicationTaskActionableByStudent,
  isApplicationTaskOpenForStudent,
  isApplicationTaskOverdue,
  isApplicationTaskStatus,
  isApplicationTaskType,
  summarizeApplicationTasks,
  type ApplicationTaskStatus,
} from "./application-tasks";

/**
 * NW06.6 — pure, framework-free unit tests for
 * src/lib/applications/application-tasks.ts. Same "pure logic lives in
 * src/lib/applications/" convention as application-lifecycle.test.ts/
 * application-work-queue.test.ts; the database-authoritative transition
 * table these tests mirror lives in staff_update_application_task_status()
 * (see application-tasks-migration-security.test.ts for that side).
 */

describe("isApplicationTaskType / isApplicationTaskStatus", () => {
  it("accepts every value in the fixed vocabularies", () => {
    for (const type of APPLICATION_TASK_TYPES) expect(isApplicationTaskType(type)).toBe(true);
    for (const status of APPLICATION_TASK_STATUSES) expect(isApplicationTaskStatus(status)).toBe(true);
  });

  it("rejects an unrecognized value for either vocabulary", () => {
    expect(isApplicationTaskType("refund_request")).toBe(false);
    expect(isApplicationTaskStatus("archived")).toBe(false);
  });
});

describe("getAllowedStaffTaskTransitions — mirrors the DB-authoritative transition table", () => {
  it("open -> in_progress or cancelled", () => {
    expect(getAllowedStaffTaskTransitions("open").sort()).toEqual(["cancelled", "in_progress"]);
  });

  it("in_progress -> open or cancelled", () => {
    expect(getAllowedStaffTaskTransitions("in_progress").sort()).toEqual(["cancelled", "open"]);
  });

  it("student_completed -> verified_complete, open, in_progress, or cancelled", () => {
    expect(getAllowedStaffTaskTransitions("student_completed").sort()).toEqual(["cancelled", "in_progress", "open", "verified_complete"]);
  });

  it("verified_complete and cancelled are both terminal — no outgoing transition", () => {
    expect(getAllowedStaffTaskTransitions("verified_complete")).toEqual([]);
    expect(getAllowedStaffTaskTransitions("cancelled")).toEqual([]);
  });

  it("every status in the fixed vocabulary has a defined (possibly empty) transition list — the switch is exhaustive by construction", () => {
    for (const status of APPLICATION_TASK_STATUSES) {
      expect(() => getAllowedStaffTaskTransitions(status)).not.toThrow();
    }
  });
});

describe("isApplicationTaskOpenForStudent / isApplicationTaskActionableByStudent", () => {
  it("open/in_progress/student_completed are all 'open for student' (amendable before verification)", () => {
    expect(isApplicationTaskOpenForStudent("open")).toBe(true);
    expect(isApplicationTaskOpenForStudent("in_progress")).toBe(true);
    expect(isApplicationTaskOpenForStudent("student_completed")).toBe(true);
  });

  it("verified_complete/cancelled are not 'open for student'", () => {
    expect(isApplicationTaskOpenForStudent("verified_complete")).toBe(false);
    expect(isApplicationTaskOpenForStudent("cancelled")).toBe(false);
  });

  it("[deliberate] student_completed is NOT actionable — the student already acted; it is now waiting on staff", () => {
    expect(isApplicationTaskActionableByStudent("student_completed")).toBe(false);
  });

  it("only open/in_progress are actionable", () => {
    expect(isApplicationTaskActionableByStudent("open")).toBe(true);
    expect(isApplicationTaskActionableByStudent("in_progress")).toBe(true);
    expect(isApplicationTaskActionableByStudent("verified_complete")).toBe(false);
    expect(isApplicationTaskActionableByStudent("cancelled")).toBe(false);
  });
});

describe("isApplicationTaskOverdue", () => {
  const now = new Date("2026-10-25T00:00:00Z");

  it("false when there is no due date", () => {
    expect(isApplicationTaskOverdue("open", null, now)).toBe(false);
  });

  it("true for an actionable task whose due date has passed", () => {
    expect(isApplicationTaskOverdue("open", "2026-10-01", now)).toBe(true);
    expect(isApplicationTaskOverdue("in_progress", "2026-10-24", now)).toBe(true);
  });

  it("false for an actionable task whose due date is still in the future", () => {
    expect(isApplicationTaskOverdue("open", "2026-12-01", now)).toBe(false);
  });

  it("[deliberate] never overdue once the status is no longer actionable — a verified/cancelled/student_completed task is never flagged overdue even with a past due date", () => {
    expect(isApplicationTaskOverdue("student_completed", "2026-01-01", now)).toBe(false);
    expect(isApplicationTaskOverdue("verified_complete", "2026-01-01", now)).toBe(false);
    expect(isApplicationTaskOverdue("cancelled", "2026-01-01", now)).toBe(false);
  });
});

describe("summarizeApplicationTasks", () => {
  const now = new Date("2026-10-25T00:00:00Z");

  it("counts zero for an empty list", () => {
    expect(summarizeApplicationTasks([], now)).toEqual({ actionableCount: 0, overdueCount: 0, awaitingVerificationCount: 0 });
  });

  it("tallies actionable, overdue, and awaiting-verification counts independently, never double-counting a task across buckets", () => {
    const tasks: { id: string; status: ApplicationTaskStatus; dueDate: string | null }[] = [
      { id: "1", status: "open", dueDate: "2026-10-01" }, // actionable + overdue
      { id: "2", status: "in_progress", dueDate: "2026-12-01" }, // actionable, not overdue
      { id: "3", status: "student_completed", dueDate: "2026-01-01" }, // awaiting verification only
      { id: "4", status: "verified_complete", dueDate: "2026-01-01" }, // counted nowhere
      { id: "5", status: "cancelled", dueDate: null }, // counted nowhere
    ];
    expect(summarizeApplicationTasks(tasks, now)).toEqual({ actionableCount: 2, overdueCount: 1, awaitingVerificationCount: 1 });
  });
});
