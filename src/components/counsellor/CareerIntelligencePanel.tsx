import "server-only";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getAiConfig } from "@/lib/ai/get-provider";
import { listAiRunsForStudent } from "@/lib/supabase/admin/career-intelligence";
import { formatDateTime, providerLabel, runProviderLabel } from "@/lib/career-intelligence/workspace";

/**
 * NW09 / NW09.2 — compact "AI Career Intelligence" card on the Student Case
 * page. The full workspace (readiness, recorded consent, gates, generate,
 * analysis, report editing, workflow and usage) lives on its own route:
 * /counsellor/students/[studentId]/ai-career-intelligence. This card only
 * reads the configured provider and the latest ledger entry — no AI call.
 */
export async function CareerIntelligencePanel({ studentUserId }: { studentUserId: string }) {
  const config = getAiConfig();
  const runs = await listAiRunsForStudent(studentUserId);
  const latest = runs.available ? runs.runs[0] : undefined;
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">AI Career Intelligence</h2>
        </div>
        <Badge tone={config.mode === "disabled" ? "neutral" : "info"}>{providerLabel(config)}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        {!runs.available
          ? "Not available yet: the NW07 and NW09 database changes have not been applied."
          : latest
            ? `Latest analysis: ${formatDateTime(latest.createdAt)} · ${runProviderLabel(latest.provider, latest.model)} · ${latest.status}.`
            : "No analysis has been requested for this student yet."}
      </p>
      <Link href={`/counsellor/students/${studentUserId}/ai-career-intelligence`} className="mt-3 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
        Open the AI Career Intelligence workspace
      </Link>
    </Card>
  );
}
