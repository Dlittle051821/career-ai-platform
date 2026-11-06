"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { AnalysisCareerView, AnalysisView } from "@/lib/career-intelligence/workspace";

/**
 * NW09.2 — the tabbed view of ONE stored AI analysis (client component for
 * tab switching only). It receives a plain view model built on the server
 * from the run ledger and the schema-validated report; it fetches nothing
 * and holds no fixed values. Match bands are the deterministic engine's
 * heuristic labels — Nextwise shows no percentage "match scores".
 */

const TABS = [
  { key: "summary", label: "Summary" },
  { key: "careers", label: "Recommended careers" },
  { key: "comparison", label: "Comparison" },
  { key: "education", label: "Education pathways" },
  { key: "plan", label: "Action plan" },
  { key: "gaps", label: "Gaps & questions" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function List({ items, empty = "None noted." }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-text-soft">
      {items.map((x, i) => (
        <li key={`${i}-${x.slice(0, 24)}`}>{x}</li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      {children}
    </div>
  );
}

export function AiAnalysisView({ view }: { view: AnalysisView }) {
  const [tab, setTab] = useState<TabKey>("summary");
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">AI career analysis</h2>
          <p className="mt-0.5 text-xs text-muted">
            Generated {view.generatedAt} · {view.providerLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="tabular-nums">
            {(view.tokens.input + view.tokens.output).toLocaleString("en-IN")} tokens ({view.tokens.input.toLocaleString("en-IN")} in · {view.tokens.output.toLocaleString("en-IN")} out
            {view.tokens.reasoning > 0 ? ` · ${view.tokens.reasoning.toLocaleString("en-IN")} reasoning` : ""}
            {view.tokens.cached > 0 ? ` · ${view.tokens.cached.toLocaleString("en-IN")} cached` : ""})
          </span>
          <span>·</span>
          <span className="tabular-nums">est. {view.costLabel}</span>
          {view.isLiveOpenAi ? <Badge tone={view.responseIdRecorded ? "success" : "warning"}>{view.responseIdRecorded ? "Provider response recorded" : "Response id not recorded"}</Badge> : null}
        </div>
      </div>

      <div role="tablist" aria-label="Analysis sections" className="mt-4 flex flex-wrap gap-x-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`ai-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`ai-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", tab === t.key ? "border-secondary text-primary" : "border-transparent text-muted hover:text-primary")}
          >
            {t.label}
            {t.key === "careers" ? ` (${view.careers.length})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ai-panel-${tab}`} aria-labelledby={`ai-tab-${tab}`} className="mt-4 space-y-4">
        {tab === "summary" ? <SummaryTab view={view} /> : null}
        {tab === "careers" ? <CareersTab careers={view.careers} /> : null}
        {tab === "comparison" ? <ComparisonTab view={view} /> : null}
        {tab === "education" ? <EducationTab view={view} /> : null}
        {tab === "plan" ? <PlanTab view={view} /> : null}
        {tab === "gaps" ? <GapsTab view={view} /> : null}
      </div>
    </div>
  );
}

function SummaryTab({ view }: { view: AnalysisView }) {
  const i = view.interpretation;
  return (
    <>
      {view.outcome === "insufficient_data" ? (
        <p className="rounded-md border border-warning/25 bg-warning-light px-3 py-2 text-sm text-warning">The analysis found the profile too thin for career recommendations. See “Gaps &amp; questions”.</p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm text-text">{view.overview}</p>
      {i ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Block title="Academic background">
            <p className="text-sm text-text-soft">{i.academicBackground}</p>
          </Block>
          <Block title="Financial considerations">
            <p className="text-sm text-text-soft">{i.financialConsiderations}</p>
          </Block>
          <Block title="Strengths">
            <List items={i.strengths} />
          </Block>
          <Block title="Interests">
            <List items={i.interests} />
          </Block>
          <Block title="Motivations">
            <List items={i.motivations} />
          </Block>
          <Block title="Priorities">
            <List items={i.priorities} />
          </Block>
        </div>
      ) : (
        <p className="text-sm text-muted">This analysis was produced with an earlier report version that has no profile interpretation.</p>
      )}
      {view.observations.length > 0 ? (
        <div className="rounded-md border border-info/25 bg-info-light px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-info">AI observations for the counsellor (not conclusions)</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-info">
            {view.observations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function CareersTab({ careers }: { careers: AnalysisCareerView[] }) {
  if (careers.length === 0) return <p className="text-sm text-muted">No catalogue careers were recommended in this analysis.</p>;
  return (
    <>
      <p className="text-xs text-muted">Every career below is an existing Nextwise catalogue record. Bands come from the deterministic matching engine — they are heuristic estimates, not percentages or predictions.</p>
      {careers.map((c) => (
        <article key={c.careerId} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-primary">
                <Link href={`/careers/${c.slug}`} className="hover:underline">
                  {c.title}
                </Link>
              </h3>
              <p className="text-xs text-muted">{c.familyName}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="info">{c.matchBandLabel}</Badge>
              <Badge tone="neutral">{c.evidenceLabel}</Badge>
              <Badge tone="accent">{c.suitabilityLabel}</Badge>
            </div>
          </div>
          <p className="mt-3 text-sm text-text">{c.fitExplanation}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Block title="Evidence from the profile">
              <List items={c.supportingEvidence} />
            </Block>
            <Block title="Skills already shown">
              <List items={c.skillsDemonstrated} />
            </Block>
            <Block title="Skill gaps">
              <List items={[...c.skillGaps, ...c.unmetRequirements]} />
            </Block>
            <Block title="Trade-offs">
              <List items={c.tradeOffs} />
            </Block>
            <Block title="Why it may not suit">
              <List items={c.reasonsItMayNotSuit} />
            </Block>
            <Block title="Next steps">
              <List items={c.nextActions} />
            </Block>
          </div>
          {c.assumptionsToVerify.length > 0 ? (
            <div className="mt-3">
              <Block title="Assumptions to verify">
                <List items={c.assumptionsToVerify} />
              </Block>
            </div>
          ) : null}
        </article>
      ))}
    </>
  );
}

function ComparisonTab({ view }: { view: AnalysisView }) {
  const c = view.comparison;
  if (!c) return <p className="text-sm text-muted">No comparison in this analysis (earlier report version, or fewer than two careers).</p>;
  return (
    <>
      <p className="text-sm text-text">{c.summary}</p>
      {c.points.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Career</th>
                <th className="py-2 pr-3 font-medium">Distinctive strength</th>
                <th className="py-2 font-medium">Main concern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {c.points.map((p) => (
                <tr key={p.careerId}>
                  <td className="py-2 pr-3 font-medium text-text">{p.title}</td>
                  <td className="py-2 pr-3 text-text-soft">{p.distinctiveStrength}</td>
                  <td className="py-2 text-text-soft">{p.mainConcern}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs text-muted">A written comparison only — no scores are generated by the AI.</p>
    </>
  );
}

function EducationTab({ view }: { view: AnalysisView }) {
  const a = view.academicDirection;
  return (
    <>
      {a ? (
        <div className="space-y-3">
          <p className="text-sm text-text">
            <span className="font-medium">Suggested level:</span> {a.levelLabel}
          </p>
          <Block title="Fields of study">
            <List items={a.fields} />
          </Block>
          <p className="text-sm text-text-soft">{a.rationale}</p>
          <Block title="To verify before advising">
            <List items={a.toVerify} />
          </Block>
        </div>
      ) : (
        <p className="text-sm text-muted">No academic direction in this analysis.</p>
      )}
      {view.careers.map((c) =>
        c.educationPathways.length + c.catalogueEducationRoutes.length > 0 ? (
          <Block key={c.careerId} title={`${c.title} — routes`}>
            <List items={[...c.catalogueEducationRoutes.map((r) => `${r} (catalogue)`), ...c.educationPathways]} />
          </Block>
        ) : null,
      )}
      <p className="text-xs text-muted">No institutions, fees, admission chances or visa outcomes are generated. Verify any specific institution from Nextwise&apos;s verified records.</p>
    </>
  );
}

function PlanSteps({ items }: { items: Array<{ action: string; timeframe: string }> }) {
  if (items.length === 0) return <p className="text-sm text-muted">None.</p>;
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.action} className="flex items-start justify-between gap-3 text-sm">
          <span className="text-text">{s.action}</span>
          <span className="shrink-0 text-xs text-muted">{s.timeframe}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanTab({ view }: { view: AnalysisView }) {
  const p = view.developmentPlan;
  if (!p) return <p className="text-sm text-muted">No development plan in this analysis.</p>;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Block title="Short term">
        <PlanSteps items={p.shortTerm} />
      </Block>
      <Block title="Longer term">
        <PlanSteps items={p.longTerm} />
      </Block>
    </div>
  );
}

function GapsTab({ view }: { view: AnalysisView }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Block title="Missing information">
        <List items={view.missingInformation} />
      </Block>
      <Block title="Questions to ask the student">
        <List items={view.followUpQuestions} />
      </Block>
      <Block title="Uncertainties">
        <List items={view.uncertainties} />
      </Block>
      <Block title="Flags for the counsellor">
        <List items={view.flags} />
      </Block>
    </div>
  );
}
