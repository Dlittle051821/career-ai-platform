import "server-only";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getAiConfig } from "@/lib/ai/get-provider";
import { activeModel, type AiConfig } from "@/lib/ai/config";
import { checkDataPolicy } from "@/lib/ai/data-policy";
import { prepareAnalysis } from "@/lib/career-intelligence/pipeline";
import { MATCH_BAND_LABELS, EVIDENCE_LEVEL_LABELS } from "@/lib/recommendations";
import { getCareersForMatching } from "@/lib/supabase/careers";
import { createCareerIntelligenceGateway, listAiRunsForStudent } from "@/lib/supabase/admin/career-intelligence";
import { requestCareerAnalysisAction } from "@/app/counsellor/students/actions";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import { CareerIntelligenceRequestForm } from "./CareerIntelligenceRequestForm";

/**
 * NW09 — "AI Career Intelligence" panel on the Counsellor Studio student
 * page (server component).
 *
 * Shows, WITHOUT calling any AI: which provider mode is active (never a
 * key), the profile-completeness check, and the deterministic catalogue
 * matches the analysis would explain (heuristic bands, never percentages).
 * Then the request form and the history of analyses for this student.
 */
const STATUS_LABELS: Record<string, string> = {
  reserved: "In progress",
  succeeded: "Draft created",
  failed: "Failed",
  refused: "Declined by provider",
  invalid_output: "Discarded (invalid answer)",
  blocked: "Not run",
  expired: "Expired",
};

function modeDescription(config: AiConfig): { label: string; tone: "neutral" | "info" | "warning" | "success"; text: string } {
  switch (config.mode) {
    case "mock":
      return { label: "Mock (development)", tone: "info", text: "Deterministic test provider: offline, free, built only from the profile and catalogue. It is not a real AI analysis." };
    case "gemini":
      return { label: `Gemini free tier · ${config.gemini.model}`, tone: "warning", text: "Development only, and only for fictional test students. Real students' information is never sent to the free tier." };
    case "openai":
      return { label: `OpenAI · ${config.openai.model}`, tone: "success", text: "Approved paid provider. Requests are stateless (store: false) and use a minimised profile." };
    default:
      return { label: "Off", tone: "neutral", text: config.notes[0] ?? "AI is switched off." };
  }
}

export async function CareerIntelligencePanel({ studentUserId, snapshot }: { studentUserId: string; snapshot: StudentProfileSnapshot | null }) {
  const config = getAiConfig();
  const mode = modeDescription(config);
  const [catalogue, runsResult, dataClass] = await Promise.all([
    snapshot ? getCareersForMatching() : Promise.resolve([]),
    listAiRunsForStudent(studentUserId),
    createCareerIntelligenceGateway(config).classifyStudentData(studentUserId),
  ]);
  const prepared = snapshot ? prepareAnalysis({ snapshot, catalogue }) : null;
  const policy = checkDataPolicy(config.mode, dataClass);

  let disabledReason: string | null = null;
  if (!runsResult.available) disabledReason = "Not available yet: the NW07 and NW09 database changes have not been applied.";
  else if (config.mode === "disabled") disabledReason = `AI is switched off. ${config.notes[0] ?? ""}`.trim();
  else if (!policy.allowed) disabledReason = policy.reason;
  else if (!prepared?.assessment.ready) disabledReason = "Complete the student's profile first (see below). No AI is used until it is ready.";
  else if (prepared.candidates.length === 0) disabledReason = "No catalogue career matches this profile with enough evidence yet.";

  const runs = runsResult.available ? runsResult.runs : [];
  const previousRuns = runs.filter((r) => r.status === "succeeded").map((r) => ({ id: r.id, label: `${new Date(r.createdAt).toLocaleString("en-IN")} · ${r.provider}` }));
  const boundAction = requestCareerAnalysisAction.bind(null, studentUserId);

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">AI Career Intelligence</h2>
        </div>
        <Badge tone={mode.tone}>{mode.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        Prepares a first draft for you to check and edit. It explains careers the Nextwise catalogue already matched to this
        profile — it never invents careers, courses, fees or salaries, and nothing reaches the student until another reviewer
        approves it and it is released. {mode.text}
        {dataClass === "fictional" ? " This is a fictional test student." : ""}
      </p>

      {prepared ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Profile check</h3>
            {prepared.assessment.ready ? (
              <p className="mt-1 text-sm text-success">Enough information for an analysis.</p>
            ) : (
              <p className="mt-1 text-sm text-warning">Not enough information yet.</p>
            )}
            {prepared.assessment.missing.length > 0 ? <p className="mt-1 text-sm text-muted">Missing: {prepared.assessment.missing.join(", ")}.</p> : null}
            {prepared.assessment.conflicts.map((c) => (
              <p key={c} className="mt-1 text-sm text-warning">
                {c}
              </p>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">Catalogue matches (heuristic, no AI)</h3>
            {prepared.candidates.length === 0 ? (
              <p className="mt-1 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {prepared.candidates.map((c) => (
                  <li key={c.career.id}>
                    <Link href={`/careers/${c.career.slug}`} className="font-medium text-text hover:text-primary hover:underline">
                      {c.career.title}
                    </Link>{" "}
                    <span className="text-muted">
                      — {MATCH_BAND_LABELS[c.result.matchBand]}, {EVIDENCE_LEVEL_LABELS[c.result.evidenceLevel].toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">The student&apos;s profile could not be loaded with your access.</p>
      )}

      {runs.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text">Earlier analyses</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-text-soft">
                  {new Date(r.createdAt).toLocaleString("en-IN")} · {r.provider} · {r.model}
                  {r.status === "succeeded" ? ` · ${r.inputTokens + r.outputTokens} tokens · est. $${r.estimatedCostUsd.toFixed(4)}` : ""}
                  {r.regenerationReason ? ` · regenerated: “${r.regenerationReason}”` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={r.status === "succeeded" ? "success" : r.status === "reserved" ? "info" : "neutral"}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                  {r.draftId ? (
                    <Link href={`/counsellor/recommendations/${r.draftId}`} className="font-medium text-secondary-dark hover:text-primary">
                      Draft
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 border-t border-border pt-5">
        <CareerIntelligenceRequestForm
          action={boundAction}
          idempotencyKey={randomUUID().replace(/-/g, "")}
          previousRuns={previousRuns}
          disabledReason={disabledReason}
        />
        {config.mode !== "disabled" ? <p className="mt-2 text-xs text-muted">Model: {activeModel(config)}. Usage and estimated cost are recorded for every analysis.</p> : null}
      </div>
    </Card>
  );
}
