import type { CareerMatchProfile } from "@/types/career";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import type { AiConfig } from "@/lib/ai/config";
import { checkDataPolicy } from "@/lib/ai/data-policy";
import { estimateCostUsd } from "@/lib/ai/cost";
import { toProviderJsonSchema } from "@/lib/ai/json-schema";
import { runStructured, type RunOptions } from "@/lib/ai/run";
import type { AiDataClass, AiErrorKind, AiProvider, AiUsage } from "@/lib/ai/types";
import type { RecommendationDraftContent } from "@/lib/recommendations/drafts";
import { assessProfile, type ProfileAssessment } from "./completeness";
import { selectCandidates, toPacket } from "./candidates";
import { minimiseProfile } from "./minimise";
import { buildPrompt, INSTRUCTIONS } from "./prompt";
import { assembleReport, fingerprint, toDraftContent } from "./report";
import { buildModelOutputSchema, type CareerIntelligenceReport } from "./schema";
import { classifyInputs, provenanceForPrompt } from "./provenance";
import type { ProfileSectionKey, ProvenanceValue } from "@/types/profile-provenance";

/**
 * NW09 — the Career Intelligence pipeline (pure orchestration; every I/O
 * dependency is passed in):
 *
 *   profile → completeness → catalogue candidates (deterministic engine)
 *   → data policy → minimised, bounded prompt → provider (structured)
 *   → runtime validation → claim screening → report (catalogue-joined)
 *   → student-facing draft content
 *
 * Stops BEFORE calling any provider when the profile is too thin, the
 * catalogue yields no candidates, AI is disabled, or the data policy
 * forbids this provider for this data — so those cases cost nothing.
 */
export type PipelineOutcome =
  | { kind: "needs_profile"; assessment: ProfileAssessment }
  | { kind: "no_candidates"; assessment: ProfileAssessment }
  | { kind: "disabled"; reason: string }
  | { kind: "policy_blocked"; reason: string }
  | { kind: "input_too_large"; reason: string }
  | {
      kind: "failed";
      status: "refused" | "incomplete" | "invalid_output" | "failed";
      reason: string;
      /** NW09.2 — the provider failure category (billing, auth, model_unavailable, rate_limited, unavailable, timeout …) when status is "failed". */
      errorKind?: AiErrorKind;
      usage: AiUsage | null;
      estimatedCostUsd: number;
      attempts: number;
      model: string;
      latencyMs?: number;
      responseId?: string | null;
    }
  | { kind: "ok"; report: CareerIntelligenceReport; draftContent: RecommendationDraftContent; usage: AiUsage | null; estimatedCostUsd: number; attempts: number; model: string };

export interface PipelineInput {
  studentUserId: string;
  snapshot: StudentProfileSnapshot;
  catalogue: CareerMatchProfile[];
  dataClass: AiDataClass;
  /** NW09.2 — section provenance (null = could not be read: everything provided counts as self-reported, unverified). */
  provenance?: Partial<Record<ProfileSectionKey, ProvenanceValue>> | null;
}

export interface PipelineDeps {
  config: AiConfig;
  provider: AiProvider | null;
  now?: () => Date;
  run?: Pick<RunOptions, "sleep" | "now">;
}

/** Steps that need no provider — exported so the UI can show readiness without generating anything. */
export function prepareAnalysis(input: Pick<PipelineInput, "snapshot" | "catalogue">) {
  const assessment = assessProfile(input.snapshot);
  const candidates = assessment.ready ? selectCandidates(input.snapshot, input.catalogue) : [];
  return { assessment, candidates };
}

export async function generateCareerIntelligence(input: PipelineInput, deps: PipelineDeps): Promise<PipelineOutcome> {
  const now = deps.now ?? (() => new Date());
  const { assessment, candidates } = prepareAnalysis(input);
  if (!assessment.ready) return { kind: "needs_profile", assessment };
  if (candidates.length === 0) return { kind: "no_candidates", assessment };

  if (deps.config.mode === "disabled" || !deps.provider) return { kind: "disabled", reason: deps.config.notes[0] ?? "AI is disabled." };
  const policy = checkDataPolicy(deps.config.mode, input.dataClass);
  if (!policy.allowed) return { kind: "policy_blocked", reason: policy.reason };

  const minimised = minimiseProfile(input.snapshot, now());
  const inputs = classifyInputs(input.snapshot, input.provenance ?? null);
  const packets = candidates.map(toPacket);
  const prompt = buildPrompt(minimised.profile, packets, assessment, minimised.isMinor, deps.config.limits.maxInputChars, provenanceForPrompt(inputs));
  if (!prompt.ok) return { kind: "input_too_large", reason: prompt.reason };
  const used = candidates.slice(0, packets.length - prompt.droppedCandidates);
  const refs = used.map((c) => c.ref);
  const schema = buildModelOutputSchema(refs);

  const result = await runStructured(
    deps.provider,
    {
      task: "career_intelligence.v1",
      instructions: INSTRUCTIONS,
      input: prompt.input,
      jsonSchema: toProviderJsonSchema(schema),
      schemaName: "career_intelligence_report",
      payload: prompt.payload,
      maxOutputTokens: deps.config.limits.maxOutputTokens,
      dataClass: input.dataClass,
    },
    schema,
    {
      timeoutMs: deps.config.limits.timeoutMs,
      maxAttempts: deps.config.limits.maxAttempts,
      // NW09.2: a malformed answer from the PAID provider is never retried (no second paid call).
      retryInvalidOutput: deps.provider.name !== "openai",
      ...deps.run,
    },
  );
  const cost = estimateCostUsd(deps.provider.name, result.model, result.usage, deps.config);
  if (result.status !== "ok") {
    return {
      kind: "failed",
      status: result.status,
      reason: result.reason,
      errorKind: result.status === "failed" ? result.errorKind : undefined,
      usage: result.usage,
      estimatedCostUsd: cost,
      attempts: result.attempts,
      model: result.model,
      latencyMs: result.latencyMs,
      responseId: result.responseId,
    };
  }

  const extraFlags: CareerIntelligenceReport["counsellorFlags"] = [];
  if (minimised.isMinor && !result.data.counsellorFlags.some((f) => f.code === "minor_student")) extraFlags.push({ code: "minor_student", note: "The student appears to be under 18 — involve a parent or guardian in decisions." });
  if (minimised.instructionLikeText) extraFlags.push({ code: "student_text_contained_instructions", note: "Some of the student's free text looked like instructions to an AI. It was treated only as data — review the profile text." });
  if (used.some((c) => c.catalogueTextFlagged)) extraFlags.push({ code: "other", note: "A catalogue description looked like instructions to an AI and was withheld from the analysis — report it to the catalogue team." });
  for (const c of assessment.conflicts.slice(0, 3)) if (!result.data.counsellorFlags.some((f) => f.note === c)) extraFlags.push({ code: "conflicting_preferences", note: c.slice(0, 240) });

  const report = assembleReport(
    result.data,
    used,
    {
      provider: deps.provider.name,
      model: result.model,
      dataClass: input.dataClass,
      usage: result.usage,
      estimatedCostUsd: cost,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
      generatedAt: now(),
      responseId: result.responseId,
    },
    { studentUserId: input.studentUserId, profileFingerprint: fingerprint(minimised.profile), extraFlags, inputProvenance: inputs },
  );
  return { kind: "ok", report, draftContent: toDraftContent(report), usage: result.usage, estimatedCostUsd: cost, attempts: result.attempts, model: result.model };
}
