import type { AiErrorKind } from "@/lib/ai/types";
import type { RequestOutcome } from "./service";

/**
 * NW09 — what the counsellor sees after asking for an AI-assisted draft.
 * Plain wording, no provider error text (which can echo request content),
 * and never a raw model response. NW09.2: provider failures are reported
 * by category, truthfully — a failed request never looks like a success,
 * and nothing is ever substituted from the mock provider.
 */
export interface CareerAnalysisActionState {
  error: string | null;
  notice: string | null;
  draftId: string | null;
  followUpQuestions: string[];
}

export const INITIAL_CAREER_ANALYSIS_STATE: CareerAnalysisActionState = { error: null, notice: null, draftId: null, followUpQuestions: [] };

/** Safe, specific explanation of a provider failure (no provider message, no key, no request content). */
export function describeProviderFailure(kind: AiErrorKind | undefined): string {
  switch (kind) {
    case "billing":
      return "OpenAI refused the request for a billing reason (no API credit, or a spend/usage limit reached on the OpenAI project). An administrator must add credit or raise the limit in the OpenAI dashboard. Nothing was saved as a draft.";
    case "auth":
      return "OpenAI rejected the API credentials (invalid, revoked or not authorised for this project). An administrator must check the server's OPENAI_API_KEY. Nothing was saved as a draft.";
    case "model_unavailable":
      return "The configured OpenAI model is not available to this API project (wrong model id, or the project is not allowed to use it). An administrator must check AI_OPENAI_MODEL and the project's model access. Nothing was saved as a draft.";
    case "rate_limited":
      return "OpenAI is rate-limiting requests right now. Nothing was saved as a draft — please try again in a few minutes.";
    case "timeout":
      return "OpenAI did not respond in time. Nothing was saved as a draft. Check the usage dashboard before retrying: a timed-out request may still have been processed.";
    case "unavailable":
      return "OpenAI could not be reached or reported a server error. Nothing was saved as a draft — please try again later.";
    case "bad_request":
      return "OpenAI rejected the request as invalid. This is a configuration or code problem, not something a retry will fix. Nothing was saved as a draft.";
    default:
      return "The AI provider could not complete the request. Nothing was saved as a draft — please try again later.";
  }
}

export function describeOutcome(outcome: RequestOutcome): CareerAnalysisActionState {
  const base = { error: null, notice: null, draftId: null, followUpQuestions: [] as string[] };
  switch (outcome.kind) {
    case "draft_created": {
      const live = outcome.report.generation.provider === "openai";
      return {
        ...base,
        notice: `${live ? "OpenAI analysis complete" : `Analysis complete (${outcome.report.generation.provider} provider — not OpenAI)`}: an AI-assisted first draft was created with ${outcome.report.careers.length} catalogue career${outcome.report.careers.length === 1 ? "" : "s"}. Review and edit it before submitting it for independent approval — nothing has been shared with the student.`,
        draftId: outcome.draftId,
      };
    }
    case "duplicate":
      return { ...base, notice: "This request was already received — no second analysis was run.", draftId: outcome.draftId };
    case "not_authorised":
    case "not_entitled":
    case "needs_consent":
    case "real_student_not_approved":
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
        case "input_too_large":
          return { ...base, error: o.reason };
        case "failed":
          return {
            ...base,
            error:
              o.status === "refused"
                ? "The AI provider declined to produce an analysis. Nothing was saved as a draft."
                : o.status === "invalid_output"
                  ? "The AI answer did not pass validation, so it was discarded (it was not retried, to avoid a second paid request). Nothing was saved as a draft."
                  : o.status === "incomplete"
                    ? o.reason === "model_mismatch"
                      ? "The answer came from a different model than the one configured, so it was discarded. Nothing was saved as a draft."
                      : "The AI answer was incomplete (for example, it reached the output-token limit), so it was discarded. Nothing was saved as a draft."
                    : describeProviderFailure(o.errorKind),
          };
      }
      return { ...base, error: "The analysis could not be completed." };
    }
  }
}
