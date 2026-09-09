import { describe, expect, it } from "vitest";
import { computeJourneyProgress, type JourneyProgressInput } from "./journey-progress";

const BASE: JourneyProgressInput = {
  profileStatus: "not_started",
  profilePercent: 0,
  careerReadinessLevel: null,
  savedItemCount: 0,
  applicationCount: 0,
};

function stageOf(progress: ReturnType<typeof computeJourneyProgress>, key: string) {
  const stage = progress.stages.find((s) => s.key === key);
  if (!stage) throw new Error(`stage ${key} not found`);
  return stage;
}

describe("computeJourneyProgress", () => {
  it("brand-new student: every stage upcoming/current, Explore is the current stage, nothing falsely complete", () => {
    const progress = computeJourneyProgress(BASE);
    expect(progress.currentStage).toBe("explore");
    expect(progress.completedStages).toEqual([]);
    expect(stageOf(progress, "explore").state).toBe("current");
    for (const key of ["build_profile", "recommendations", "saved_options", "apply"]) {
      expect(stageOf(progress, key).state).toBe("upcoming");
    }
  });

  it("incomplete profile: Build Profile becomes current, Explore auto-completes only once real activity exists", () => {
    const progress = computeJourneyProgress({ ...BASE, profileStatus: "in_progress", profilePercent: 40 });
    // No saved items/applications/readiness yet — Explore is not yet satisfied by any downstream signal.
    expect(stageOf(progress, "explore").state).toBe("current");
    expect(stageOf(progress, "build_profile").state).toBe("upcoming");

    const withSavedItem = computeJourneyProgress({ ...BASE, profileStatus: "in_progress", profilePercent: 40, savedItemCount: 1 });
    expect(stageOf(withSavedItem, "explore").state).toBe("complete");
    expect(stageOf(withSavedItem, "build_profile").state).toBe("current");
    expect(withSavedItem.currentStage).toBe("build_profile");
    expect(stageOf(withSavedItem, "build_profile").description).toContain("40%");
  });

  it("recommendation-ready journey: profile complete + READY marks Recommendations complete and moves current stage to Saved Options", () => {
    const progress = computeJourneyProgress({
      ...BASE,
      profileStatus: "completed",
      profilePercent: 100,
      careerReadinessLevel: "READY",
    });
    expect(stageOf(progress, "explore").state).toBe("complete");
    expect(stageOf(progress, "build_profile").state).toBe("complete");
    expect(stageOf(progress, "recommendations").state).toBe("complete");
    expect(stageOf(progress, "recommendations").description).toMatch(/ready to view/i);
    expect(progress.currentStage).toBe("saved_options");
  });

  it("COUNSELLOR_VERIFIED also counts Recommendations as complete (not just READY)", () => {
    const progress = computeJourneyProgress({
      ...BASE,
      profileStatus: "completed",
      careerReadinessLevel: "COUNSELLOR_VERIFIED",
    });
    expect(stageOf(progress, "recommendations").state).toBe("complete");
  });

  it("PRELIMINARY/NOT_READY never mark Recommendations complete", () => {
    for (const level of ["NOT_READY", "PRELIMINARY"] as const) {
      const progress = computeJourneyProgress({ ...BASE, profileStatus: "completed", careerReadinessLevel: level });
      expect(stageOf(progress, "recommendations").state).not.toBe("complete");
    }
  });

  it("saved-item journey behaviour: saving an item completes Saved Options and never claims Decide is complete", () => {
    const progress = computeJourneyProgress({ ...BASE, savedItemCount: 3 });
    expect(stageOf(progress, "saved_options").state).toBe("complete");
    expect(stageOf(progress, "saved_options").description).toContain("3");
    expect(stageOf(progress, "decide").state).not.toBe("complete");
  });

  it("Decide is always informational and never complete, no matter how far along the journey is", () => {
    const progress = computeJourneyProgress({
      profileStatus: "completed",
      profilePercent: 100,
      careerReadinessLevel: "COUNSELLOR_VERIFIED",
      savedItemCount: 5,
      applicationCount: 2,
    });
    const decide = stageOf(progress, "decide");
    expect(decide.state).toBe("upcoming");
    expect(decide.informational).toBe(true);
    expect(progress.completedStages).not.toContain("decide");
  });

  it("Decide never blocks Apply from becoming the current stage", () => {
    const progress = computeJourneyProgress({
      profileStatus: "completed",
      profilePercent: 100,
      careerReadinessLevel: "READY",
      savedItemCount: 2,
      applicationCount: 0,
    });
    expect(progress.currentStage).toBe("apply");
    expect(stageOf(progress, "apply").state).toBe("current");
  });

  it("existing-application journey: an application completes Apply and is described honestly, without claiming submission", () => {
    const progress = computeJourneyProgress({
      profileStatus: "completed",
      profilePercent: 100,
      careerReadinessLevel: "READY",
      savedItemCount: 1,
      applicationCount: 1,
    });
    const apply = stageOf(progress, "apply");
    expect(apply.state).toBe("complete");
    expect(apply.description).toContain("1 application");
    expect(apply.description).not.toMatch(/submit/i);
  });

  it("fully-complete journey: every gating stage complete, currentStage settles on the last gating stage (Apply)", () => {
    const progress = computeJourneyProgress({
      profileStatus: "completed",
      profilePercent: 100,
      careerReadinessLevel: "READY",
      savedItemCount: 4,
      applicationCount: 2,
    });
    expect(progress.currentStage).toBe("apply");
    expect(progress.completedStages).toEqual(["explore", "build_profile", "recommendations", "saved_options", "apply"]);
  });

  it("never marks a stage complete on partial/negative data (no false completion)", () => {
    const progress = computeJourneyProgress(BASE);
    for (const stage of progress.stages) {
      if (stage.key === "explore") continue; // guarded by its own dedicated test above
      expect(stage.state).not.toBe("complete");
    }
  });

  it("stage keys are stable and cover exactly the six journey stages in spec order", () => {
    const progress = computeJourneyProgress(BASE);
    expect(progress.stages.map((s) => s.key)).toEqual(["explore", "build_profile", "recommendations", "saved_options", "decide", "apply"]);
  });
});
