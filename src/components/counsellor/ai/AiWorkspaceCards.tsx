import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, HelpCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { INPUT_SOURCE_LABELS, INPUT_VERIFICATION_LABELS, type InputProvenance } from "@/lib/career-intelligence/provenance";
import { formatCount, formatUsd, type Gate, type UsageView, type WorkflowStep } from "@/lib/career-intelligence/workspace";

/**
 * NW09.2 — the Counsellor Studio AI workspace's read-only cards. Every value
 * rendered here arrives as a prop computed from application data (see
 * src/lib/career-intelligence/workspace.ts). Nothing here holds a fixed
 * model name, percentage, cost or status.
 */

export function StudentCaseTabs({ studentId, active }: { studentId: string; active: "overview" | "ai" | "recommendations" }) {
  const tabs = [
    { key: "overview", label: "Overview", href: `/counsellor/students/${studentId}` },
    { key: "ai", label: "AI Career Intelligence", href: `/counsellor/students/${studentId}/ai-career-intelligence` },
    { key: "recommendations", label: "Reports", href: `/counsellor/students/${studentId}#recommendations` },
  ] as const;
  return (
    <nav aria-label="Student case sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            t.key === active ? "border-secondary text-primary" : "border-transparent text-muted hover:text-primary",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

const GATE_TONE = { pass: "success", fail: "error", unknown: "warning" } as const;
const GATE_ICON = { pass: CheckCircle2, fail: XCircle, unknown: HelpCircle } as const;

export function AiProviderStatusBar({ providerLabel, model, mode, gates, dataClassLabel }: { providerLabel: string; model: string | null; mode: string; gates: Gate[]; dataClassLabel: string }) {
  const chips = gates.filter((g) => g.key === "consent" || g.key === "entitlement" || g.key === "usage" || g.key === "data_policy");
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">AI provider (configured)</p>
          <p className="mt-1 text-base font-semibold text-primary">{providerLabel}</p>
          <p className="mt-0.5 text-xs text-muted">
            {model ? `Model: ${model}` : "No model configured"} · {mode === "openai" ? "Stateless requests (store: false), minimised profile, structured output" : mode === "disabled" ? "No AI requests are possible" : "Development provider"} · {dataClassLabel}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Request checks">
          {chips.map((g) => {
            const Icon = GATE_ICON[g.state];
            return (
              <li key={g.key}>
                <Badge tone={GATE_TONE[g.state]}>
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>
                    {g.label}: {g.state === "pass" ? "OK" : g.state === "fail" ? "Blocked" : "Unknown"}
                  </span>
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

export function AiGateList({ gates }: { gates: Gate[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {gates.map((g) => {
        const Icon = GATE_ICON[g.state];
        return (
          <li key={g.key} className="flex gap-2">
            <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", g.state === "pass" ? "text-success" : g.state === "fail" ? "text-error" : "text-warning")} />
            <span>
              <span className="font-medium text-text">{g.label}.</span> <span className="text-text-soft">{g.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AiReadinessCard({ percent, inputs }: { percent: number; inputs: InputProvenance[] }) {
  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold text-primary">Profile readiness</h2>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-primary">{percent}%</span>
        <span className="text-xs text-muted">profile completion</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
        <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {inputs.map((i) => (
          <li key={i.section} className="flex items-start gap-2">
            {i.completeness === "complete" ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : i.completeness === "partial" ? (
              <CircleDot aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            ) : (
              <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            )}
            <span className="min-w-0">
              <span className="block text-text">{i.label}</span>
              <span className={cn("block text-xs", i.verification === "verified" ? "text-success" : "text-muted")}>
                {i.verification === "missing" ? INPUT_VERIFICATION_LABELS.missing : `${INPUT_SOURCE_LABELS[i.source]} · ${INPUT_VERIFICATION_LABELS[i.verification]}${i.completeness === "partial" ? " · partial" : ""}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AiProfileSnapshotCard({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold text-primary">Key profile snapshot</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">The profile could not be loaded with your access.</p>
      ) : (
        <dl className="mt-3 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-text">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

const STEP_ICON = { done: CheckCircle2, current: CircleDot, pending: Circle, attention: AlertTriangle } as const;
const STEP_COLOR = { done: "text-success", current: "text-secondary-dark", pending: "text-muted", attention: "text-warning" } as const;

export function AiWorkflowCard({ steps, draftHref, draftStatusLabel }: { steps: WorkflowStep[]; draftHref: string | null; draftStatusLabel: string | null }) {
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">Analysis workflow</h2>
        {draftStatusLabel ? <Badge tone="neutral">{draftStatusLabel}</Badge> : null}
      </div>
      <ol className="mt-3 space-y-3">
        {steps.map((s) => {
          const Icon = STEP_ICON[s.state];
          return (
            <li key={s.key} className="flex gap-2 text-sm">
              <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", STEP_COLOR[s.state])} />
              <span>
                <span className={cn("font-medium", s.state === "pending" ? "text-muted" : "text-text")}>{s.label}</span>
                {s.detail ? <span className="block text-xs text-muted">{s.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {draftHref ? (
        <Link href={draftHref} className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
          Open the full report page
        </Link>
      ) : null}
      <p className="mt-3 text-xs text-muted">The student sees the report only after an independent reviewer approves it and it is released.</p>
    </Card>
  );
}

export function AiUsageCard({ usage, isPaid, lastRun }: { usage: UsageView; isPaid: boolean; lastRun: { inputTokens: number; outputTokens: number; costUsd: number } | null }) {
  const rows: Array<[string, string]> = [
    ["Your analyses today", usage.available ? `${formatCount(usage.staffToday)} of ${usage.staffLimit}` : "Not available"],
    ["This student today", usage.studentToday === null ? "Not available" : `${formatCount(usage.studentToday)} of ${usage.studentLimit}`],
    ["Organisation today", usage.available ? `${formatCount(usage.globalToday)} of ${usage.globalLimit}` : "Not available"],
    ["Estimated spend this month", usage.available ? `${formatUsd(usage.monthCostUsd)} of ${formatUsd(usage.monthBudgetUsd)}` : "Not available"],
  ];
  if (isPaid) {
    rows.push(["Paid pilot analyses (all time)", usage.available ? `${formatCount(usage.paidRunsTotal)} of ${usage.paidMaxRuns}` : "Not available"]);
    rows.push(["Paid pilot spend (estimated)", usage.available ? `${formatUsd(usage.paidCostTotalUsd)} of ${formatUsd(usage.paidBudgetUsd)}` : "Not available"]);
  }
  if (lastRun) {
    rows.push(["Latest analysis tokens", `${formatCount(lastRun.inputTokens)} in · ${formatCount(lastRun.outputTokens)} out`]);
    rows.push(["Latest analysis cost (estimated)", formatUsd(lastRun.costUsd)]);
  }
  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold text-primary">AI usage</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-text-soft">{k}</dt>
            <dd className="text-right font-medium tabular-nums text-text">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Limits shown are the lower of the application and database settings. Costs are estimates from token counts and published rates; the OpenAI dashboard is authoritative.</p>
    </Card>
  );
}
