import "server-only";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getAiAnalysisForDraft } from "@/lib/supabase/admin/career-intelligence";
import { MATCH_BAND_LABELS, EVIDENCE_LEVEL_LABELS } from "@/lib/recommendations";
import { SUITABILITY_LABELS, type CareerIntelligenceReport } from "@/lib/career-intelligence/schema";

/**
 * NW09 — STAFF-ONLY view of the analysis behind an AI-assisted draft:
 * evidence, heuristic engine bands, gaps, assumptions to verify, flags and
 * generation metadata. None of this is in the student-facing draft text;
 * the reviewer uses it to challenge or override the draft.
 */
const FLAG_LABELS: Record<CareerIntelligenceReport["counsellorFlags"][number]["code"], string> = {
  verify_profile_fact: "Verify a profile fact",
  conflicting_preferences: "Conflicting preferences",
  budget_constraint: "Budget constraint",
  minor_student: "Under 18",
  limited_evidence: "Limited evidence",
  education_requirement_unclear: "Education requirement unclear",
  student_text_contained_instructions: "Instruction-like text in profile",
  removed_unsupported_claim: "Unsupported claims removed",
  other: "Note",
};

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text-soft">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export async function CareerIntelligenceAnalysisCard({ draftId }: { draftId: string }) {
  const found = await getAiAnalysisForDraft(draftId);
  if (!found) return null;
  const { run, report } = found;
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-primary">AI analysis behind this draft (staff only)</h2>
        <Badge tone="info">
          {run.provider} · {run.model}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        Careers came from the Nextwise catalogue via the deterministic matching engine; the bands are heuristic estimates, not
        measurements. Challenge or override anything here — the student never sees this panel.
        {` Generated ${new Date(run.createdAt).toLocaleString("en-IN")} · ${run.inputTokens + run.outputTokens} tokens · est. $${run.estimatedCostUsd.toFixed(4)}.`}
      </p>
      {!report ? (
        <p className="mt-3 text-sm text-muted">The detailed analysis is no longer stored (retention period) or uses an unrecognised format.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {report.counsellorFlags.length > 0 ? (
            <div className="space-y-1">
              {report.counsellorFlags.map((f, i) => (
                <p key={`${f.code}-${i}`} className="text-sm text-warning">
                  <span className="font-semibold">{FLAG_LABELS[f.code]}:</span> {f.note}
                </p>
              ))}
            </div>
          ) : null}
          {report.careers.map((c) => (
            <div key={c.careerId} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/careers/${c.slug}`} className="font-semibold text-text hover:text-primary hover:underline">
                  {c.title}
                </Link>
                <span className="text-xs text-muted">
                  Engine: {MATCH_BAND_LABELS[c.matchBand]} · {EVIDENCE_LEVEL_LABELS[c.evidenceLevel]} · AI: {SUITABILITY_LABELS[c.suitability]}
                </span>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <List title="Profile evidence" items={c.supportingEvidence} />
                <List title="Engine reasons" items={c.engineReasons} />
                <List title="Gaps / unmet requirements" items={[...c.engineGaps, ...c.unmetRequirements]} />
                <List title="Assumptions to verify" items={c.assumptionsToVerify} />
              </div>
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <List title="Uncertainties" items={report.uncertainties} />
            <List title="Missing information" items={report.missingInformation} />
          </div>
          <p className="text-xs text-muted">{report.courseRecommendations.reason}</p>
        </div>
      )}
    </Card>
  );
}
