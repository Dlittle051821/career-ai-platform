import { describe, expect, it } from "vitest";
import type { ApplicationStage } from "@/types/admin";
import {
  getApplicationBucket,
  getApplicationNextAction,
  getApplicationProgressStages,
  getAvailableStudentActions,
  isTerminalWithoutProgress,
  resolveApplicationDeadline,
  STUDENT_APPLICATION_ACTIONS,
} from "./application-lifecycle";

const ALL_STAGES: ApplicationStage[] = [
  "inquiry",
  "preparing",
  "ready_to_submit",
  "submitted",
  "under_review",
  "interview",
  "decision_pending",
  "offer_received",
  "enrolled",
  "rejected",
  "withdrawn",
];

describe("getAvailableStudentActions / STUDENT_APPLICATION_ACTIONS", () => {
  it("[test 28] offers start_preparing and withdraw from inquiry", () => {
    expect(getAvailableStudentActions("inquiry").sort()).toEqual(["start_preparing", "withdraw"].sort());
  });

  it("offers mark_ready_to_submit and withdraw from preparing", () => {
    expect(getAvailableStudentActions("preparing").sort()).toEqual(["mark_ready_to_submit", "withdraw"].sort());
  });

  it("offers submit and withdraw from ready_to_submit", () => {
    expect(getAvailableStudentActions("ready_to_submit").sort()).toEqual(["submit", "withdraw"].sort());
  });

  it("offers only withdraw from submitted, under_review, and interview", () => {
    expect(getAvailableStudentActions("submitted")).toEqual(["withdraw"]);
    expect(getAvailableStudentActions("under_review")).toEqual(["withdraw"]);
    expect(getAvailableStudentActions("interview")).toEqual(["withdraw"]);
  });

  it("offers no student action at all once a final decision has been reached, or once already closed", () => {
    for (const stage of ["decision_pending", "offer_received", "enrolled", "rejected", "withdrawn"] as ApplicationStage[]) {
      expect(getAvailableStudentActions(stage)).toEqual([]);
    }
  });

  it("never offers a student action that would land on under_review/interview/decision_pending/offer_received/enrolled/rejected — those are never student-settable targets", () => {
    const forbiddenTargets: ApplicationStage[] = ["under_review", "interview", "decision_pending", "offer_received", "enrolled", "rejected"];
    for (const def of Object.values(STUDENT_APPLICATION_ACTIONS)) {
      expect(forbiddenTargets).not.toContain(def.toStage);
    }
  });
});

describe("getApplicationNextAction [test 28]", () => {
  it("gives an honest, non-overclaiming label for every stage without inventing progress", () => {
    for (const stage of ALL_STAGES) {
      const next = getApplicationNextAction(stage);
      expect(next.label.length).toBeGreaterThan(0);
      // Never claims direct university submission (spec §13/§49).
      expect(next.label.toLowerCase()).not.toContain("submitted to the university");
    }
  });

  it("inquiry's next action is to start preparing", () => {
    expect(getApplicationNextAction("inquiry")).toEqual({ label: "Continue preparing", action: "start_preparing" });
  });

  it("a closed/terminal stage has no actionable next step", () => {
    for (const stage of ["enrolled", "rejected", "withdrawn"] as ApplicationStage[]) {
      expect(getApplicationNextAction(stage).action).toBeNull();
    }
  });
});

describe("getApplicationProgressStages [test 33]", () => {
  it("never fabricates a completion percentage — every stage state is one of complete/current/upcoming", () => {
    for (const stage of ALL_STAGES) {
      const stages = getApplicationProgressStages(stage);
      for (const s of stages) {
        expect(["complete", "current", "upcoming"]).toContain(s.state);
      }
    }
  });

  it("orders stages started -> preparing -> submitted -> under_review -> decision, honestly, for a mid-journey application", () => {
    const stages = getApplicationProgressStages("under_review");
    expect(stages.map((s) => s.key)).toEqual(["started", "preparing", "submitted", "under_review", "decision"]);
    expect(stages.map((s) => s.state)).toEqual(["complete", "complete", "complete", "current", "upcoming"]);
  });

  it("a final decision (offer_received) marks the decision stage complete, not merely current", () => {
    const stages = getApplicationProgressStages("offer_received");
    expect(stages[4].state).toBe("complete");
  });

  it("decision_pending marks the decision stage current (a decision has not actually been reached yet)", () => {
    const stages = getApplicationProgressStages("decision_pending");
    expect(stages[4].state).toBe("current");
  });

  it("withdrawn is flagged as having no honest place on the forward progress bar", () => {
    expect(isTerminalWithoutProgress("withdrawn")).toBe(true);
    expect(getApplicationProgressStages("withdrawn").every((s) => s.state === "upcoming")).toBe(true);
  });

  it("every other stage has an honest forward position (not flagged terminal-without-progress)", () => {
    for (const stage of ALL_STAGES) {
      if (stage === "withdrawn") continue;
      expect(isTerminalWithoutProgress(stage)).toBe(false);
    }
  });
});

describe("getApplicationBucket [test 30]", () => {
  it("groups inquiry/preparing/ready_to_submit as active", () => {
    expect(getApplicationBucket("inquiry")).toBe("active");
    expect(getApplicationBucket("preparing")).toBe("active");
    expect(getApplicationBucket("ready_to_submit")).toBe("active");
  });

  it("groups submitted/under_review/interview as submitted", () => {
    expect(getApplicationBucket("submitted")).toBe("submitted");
    expect(getApplicationBucket("under_review")).toBe("submitted");
    expect(getApplicationBucket("interview")).toBe("submitted");
  });

  it("groups decision_pending/offer_received as decision", () => {
    expect(getApplicationBucket("decision_pending")).toBe("decision");
    expect(getApplicationBucket("offer_received")).toBe("decision");
  });

  it("groups enrolled/rejected/withdrawn as closed", () => {
    expect(getApplicationBucket("enrolled")).toBe("closed");
    expect(getApplicationBucket("rejected")).toBe("closed");
    expect(getApplicationBucket("withdrawn")).toBe("closed");
  });

  it("every stage maps to exactly one of the four documented buckets", () => {
    for (const stage of ALL_STAGES) {
      expect(["active", "submitted", "decision", "closed"]).toContain(getApplicationBucket(stage));
    }
  });
});

describe("resolveApplicationDeadline [test 12, 34]", () => {
  it("returns null when no intake is linked — never fabricates a deadline", () => {
    expect(resolveApplicationDeadline(null)).toBeNull();
  });

  it("returns null when the linked intake itself has no deadline fields populated", () => {
    expect(resolveApplicationDeadline({ intakeName: "Fall 2027", priorityDeadline: null, finalDeadline: null, internationalDeadline: null })).toBeNull();
  });

  it("prefers final_deadline when present", () => {
    const resolved = resolveApplicationDeadline({
      intakeName: "Fall 2027",
      priorityDeadline: "2027-05-01",
      finalDeadline: "2027-06-15",
      internationalDeadline: "2027-05-15",
    });
    expect(resolved).toEqual({ label: "Fall 2027 — final deadline", date: "2027-06-15" });
  });

  it("falls back to international_deadline, then priority_deadline, when final_deadline is absent", () => {
    expect(
      resolveApplicationDeadline({ intakeName: "Spring 2027", priorityDeadline: "2026-11-01", finalDeadline: null, internationalDeadline: "2026-11-15" })
    ).toEqual({ label: "Spring 2027 — international deadline", date: "2026-11-15" });

    expect(resolveApplicationDeadline({ intakeName: "Spring 2027", priorityDeadline: "2026-11-01", finalDeadline: null, internationalDeadline: null })).toEqual({
      label: "Spring 2027 — priority deadline",
      date: "2026-11-01",
    });
  });
});
