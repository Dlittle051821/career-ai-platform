import type { RequestOutcome } from "./service";

/**
 * NW09 — what the counsellor sees after asking for an AI-assisted draft.
 * Plain wording, no provider error text (which can echo request content),
 * and never a raw model response.
 */
export interface CareerAnalysisActionState {
  error: string | null;
  notice: string | null;
  draftId: string | null;
  followUpQuestions: string[];
}

export const INITIAL_CAREER_ANALYSIS_STATE: CareerAnalysisActionState = { error: null, notice: null, draftId: null, followUpQuestions: [] };

export function describeOutcome(outcome: RequestOutcome): CareerAnalysisActionState {
  const base = { error: null, notice: null, draftId: null, followUpQuestions: [] as string[] };
  switch (outcome.kind) {
    case "draft_created":
      return {
        ...base,
        notice: `AI-assisted first draft created with ${outcome.report.careers.length} catalogue career${outcome.report.careers.length === 1 ? "" : "s"}. Review and edit it before submitting it for independent approval — nothing has been shared with the student.`,
        draftId: outcome.draftId,
      };
    case "duplicate":
      return { ...base, notice: "This request was already received — no second analysis was run.", draftId: outcome.draftId };
    case "not_authorised":
    case "not_entitled":
    case "needs_consent":
    case "invalid_request":
    case "limit_reached":
      return { ...base, error: outcome.reason };
    case "not_generated": {
      const o = outcome.outcome;
      switch (o.kind) {
        case "needs_profile":
          return {
            ...base,
            error: `The profile is not complete enough for an analysis yet. Missing: ${o.assessment.missing.join(", ") || "core profile sections"}. No AI was used.`,
            followUpQuestions: o.assessment.followUpQuestions,
          };
        case "no_candidates":
          return { ...base, error: "No catalogue career matched this profile with enough evidence. No AI was used — talk to the student and add more detail to the profile." };
        case "disabled":
          return { ...base, error: `AI is not available: ${o.reason}` };
        case "policy_blocked":
          return { ...base, error: o.reason };
        case "input_too_large":
          return { ...base, error: o.reason };
        case "failed":
          return {
            ...base,
            error:
              o.status === "refused"
                ? "The AI provider declined to produce an analysis. Nothing was saved as a draft."
                : o.status === "invalid_output"
                  ? "The AI answer did not pass validation, so it was discarded. Nothing was saved as a draft."
                  : o.status === "incomplete"
                    ? "The AI answer was incomplete, so it was discarded. Nothing was saved as a draft."
                    : "The AI provider could not be reached. Nothing was saved as a draft — please try again later.",
          };
      }
    }
  }
}
