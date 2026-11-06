import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CareerIntelligenceRequestForm } from "@/components/counsellor/CareerIntelligenceRequestForm";
import { EditRecommendationDraftContentForm, SubmitForReviewForm } from "@/components/counsellor/RecommendationDraftActionForms";
import { AiAnalysisView } from "@/components/counsellor/ai/AiAnalysisView";
import { RecordAiConsentForm, WithdrawAiConsentForm } from "@/components/counsellor/ai/AiConsentForms";
import {
  AiGateList,
  AiProfileSnapshotCard,
  AiProviderStatusBar,
  AiReadinessCard,
  AiUsageCard,
  AiWorkflowCard,
  StudentCaseTabs,
} from "@/components/counsellor/ai/AiWorkspaceCards";
import { getAiConfig } from "@/lib/ai/get-provider";
import { hasPermission } from "@/lib/admin/permissions";
import { calculateCompletion } from "@/lib/profile/completion";
import { prepareAnalysis } from "@/lib/career-intelligence/pipeline";
import { classifyInputs } from "@/lib/career-intelligence/provenance";
import {
  buildAnalysisView,
  buildSnapshotRows,
  buildUsageView,
  computeGates,
  configuredModel,
  CONSENT_METHOD_LABELS,
  CONSENT_PARTY_LABELS,
  formatDate,
  formatDateTime,
  formatUsd,
  generateDisabledReason,
  providerLabel,
  workflowSteps,
} from "@/lib/career-intelligence/workspace";
import { RECOMMENDATION_DRAFT_STATUS_LABELS, getAllowedRecommendationDraftActions, isRecommendationDraftStatus } from "@/lib/recommendations/drafts";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { getStudentDetail } from "@/lib/supabase/admin/students";
import { getStudentProfileSnapshotForAdmin } from "@/lib/supabase/admin/student-profile";
import { getSectionProvenanceMap } from "@/lib/supabase/admin/profile-provenance";
import { getCareersForMatching } from "@/lib/supabase/careers";
import { getRecommendationDraftById, listRecommendationDraftVersions } from "@/lib/supabase/admin/recommendation-drafts";
import {
  createCareerIntelligenceGateway,
  getAiUsageSummary,
  getLatestAiAnalysisForStudent,
  listAiRunsForStudent,
  readConsentStatus,
} from "@/lib/supabase/admin/career-intelligence";
import { updateRecommendationDraftContentAction, submitRecommendationDraftForReviewAction } from "@/app/counsellor/recommendations/[id]/actions";
import { recordAiConsentAction, requestCareerAnalysisAction, withdrawAiConsentAction } from "../../actions";

export const metadata: Metadata = { title: "AI Career Intelligence" };

const RUN_STATUS_LABELS: Record<string, string> = {
  reserved: "In progress",
  succeeded: "Draft created",
  failed: "Failed",
  refused: "Declined by provider",
  invalid_output: "Discarded (invalid answer)",
  blocked: "Not run",
  expired: "Expired",
};

/**
 * NW09.2 — Counsellor Studio "AI Career Intelligence" workspace for one
 * student. Composes existing pieces: getStudentDetail() (RLS-scoped — a
 * counsellor without case access gets a 404), the profile snapshot and
 * provenance, the deterministic M5 candidates, the NW09 run ledger, the
 * NW09.2 consent register and usage summary, and NW07's draft editor and
 * submit-for-review forms (unchanged; approval stays on the report page and
 * can never be done by the draft's author).
 *
 * Every value on this page comes from those reads or from configuration.
 * Nothing here calls an AI provider: a paid request happens only when the
 * counsellor presses Generate and every server-side check passes again.
 */
export default async function AiCareerIntelligencePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [student, admin] = await Promise.all([getStudentDetail(studentId), getCurrentAdmin()]);
  if (!student) notFound();
  const allowed = hasPermission(admin?.role, "career-intelligence:generate") && hasPermission(admin?.role, "recommendation-drafts:write");
  if (!allowed) notFound();

  const config = getAiConfig();
  const gateway = createCareerIntelligenceGateway(config);
  const canReadProfile = hasPermission(admin?.role, "profile-verification:read");

  const [snapshot, provenanceMap, catalogue, runsResult, dataClass, consent, usageSummary, latest] = await Promise.all([
    getStudentProfileSnapshotForAdmin(studentId).catch(() => null),
    canReadProfile ? getSectionProvenanceMap(studentId).catch(() => null) : Promise.resolve(null),
    getCareersForMatching(),
    listAiRunsForStudent(studentId),
    gateway.classifyStudentData(studentId),
    readConsentStatus(studentId),
    getAiUsageSummary(),
    getLatestAiAnalysisForStudent(studentId),
  ]);
  const entitlement = dataClass === "fictional" ? null : await gateway.hasPaidCareerEntitlement(studentId);

  const prepared = snapshot ? prepareAnalysis({ snapshot, catalogue }) : null;
  const completion = snapshot ? calculateCompletion(snapshot) : null;
  const provenanceValues = provenanceMap ? Object.fromEntries(Object.entries(provenanceMap).map(([k, v]) => [k, v.provenance])) : null;
  const inputs = snapshot ? classifyInputs(snapshot, provenanceValues) : [];

  const runs = runsResult.available ? runsResult.runs : [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const studentToday = runsResult.available ? runs.filter((r) => r.status !== "blocked" && new Date(r.createdAt) >= dayStart).length : null;
  const usage = buildUsageView(config, usageSummary, studentToday);

  const gates = computeGates({
    config,
    dataClass,
    consent,
    entitlement,
    usage,
    databaseAvailable: runsResult.available && consent.status !== "unavailable" && usageSummary.available,
    profileReady: Boolean(prepared?.assessment.ready),
    profileMissing: prepared?.assessment.missing ?? ["profile could not be loaded"],
    candidateCount: prepared?.candidates.length ?? 0,
  });
  const disabledReason = generateDisabledReason(gates);
  const inProgress = runs.some((r) => r.status === "reserved");

  // The NW07 draft behind the latest analysis (if any).
  const draftId = latest?.run.draftId ?? null;
  const [draft, versions] = draftId ? await Promise.all([getRecommendationDraftById(draftId), listRecommendationDraftVersions(draftId)]) : [null, []];
  const draftStatus = draft && isRecommendationDraftStatus(draft.status) ? draft.status : null;
  const draftActions = draftStatus ? getAllowedRecommendationDraftActions(draftStatus) : [];
  const latestContent = versions[versions.length - 1]?.content ?? {};

  const steps = workflowSteps({
    profileReady: Boolean(prepared?.assessment.ready),
    consentValid: consent.status === "valid",
    analysis: latest ? { createdAt: latest.run.createdAt } : null,
    draft: draft ? { status: draft.status, submittedAt: draft.submittedAt, approvedAt: draft.approvedAt, releasedAt: draft.releasedAt } : null,
  });

  const analysisView =
    latest && latest.report
      ? buildAnalysisView(
          {
            provider: latest.run.provider,
            model: latest.run.model,
            createdAt: latest.run.createdAt,
            inputTokens: latest.run.inputTokens,
            outputTokens: latest.run.outputTokens,
            estimatedCostUsd: latest.run.estimatedCostUsd,
            cachedInputTokens: latest.evidence.cachedInputTokens,
            reasoningTokens: latest.evidence.reasoningTokens,
            providerResponseId: latest.evidence.providerResponseId,
          },
          latest.report,
        )
      : null;

  const previousRuns = runs.filter((r) => r.status === "succeeded").map((r) => ({ id: r.id, label: `${formatDateTime(r.createdAt)} · ${r.provider} · ${r.model}` }));
  const today = new Date().toISOString().slice(0, 10);
  const isPaid = config.mode === "openai";

  return (
    <div className="max-w-7xl">
      <Link href={`/counsellor/students/${studentId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to the student case
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Student Case</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{student.fullName || "Unnamed student"}</h1>
          <p className="mt-1 text-sm text-muted">
            {completion ? `${completion.percent}% profile complete` : "Profile not available"} · Counsellor: {student.assignedCounsellorName ?? "Unassigned"}
          </p>
        </div>
        <Badge tone={dataClass === "fictional" ? "accent" : "neutral"}>{dataClass === "fictional" ? "Fictional test student" : "Real student"}</Badge>
      </div>

      <StudentCaseTabs studentId={studentId} active="ai" />

      <AiProviderStatusBar providerLabel={providerLabel(config)} model={configuredModel(config)} mode={config.mode} gates={gates} dataClassLabel={dataClass === "fictional" ? "Fictional test data" : "Real student data"} />

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        {/* Left — readiness and snapshot */}
        <aside>
          {completion ? <AiReadinessCard percent={completion.percent} inputs={inputs} /> : null}
          <AiProfileSnapshotCard rows={buildSnapshotRows(snapshot)} />
        </aside>

        {/* Centre — analysis and report editor */}
        <section className="min-w-0">
          <Card className="mb-4">
            {analysisView ? (
              <AiAnalysisView view={analysisView} />
            ) : latest && !latest.report ? (
              <p className="text-sm text-muted">The latest analysis&apos;s stored report is no longer available (purged or an unrecognised version). Its draft, if any, is still editable below.</p>
            ) : (
              <div>
                <h2 className="text-base font-semibold text-primary">AI career analysis</h2>
                <p className="mt-2 text-sm text-muted">No analysis has been generated for this student yet. When every check on the right passes, use “Generate analysis”.</p>
              </div>
            )}
          </Card>

          {draft ? (
            <Card className="mb-4" id="report-editor">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-primary">Counsellor report (draft)</h2>
                {draftStatus ? <Badge tone={draftStatus === "released_to_student" ? "success" : draftStatus === "changes_requested" ? "warning" : "neutral"}>{RECOMMENDATION_DRAFT_STATUS_LABELS[draftStatus]}</Badge> : null}
              </div>
              {draftStatus === "changes_requested" && draft.reviewNotes ? <p className="mt-3 rounded-md border border-warning/25 bg-warning-light px-3 py-2 text-sm text-warning">Reviewer: {draft.reviewNotes}</p> : null}
              {draftActions.includes("edit") ? (
                <div className="mt-4">
                  <EditRecommendationDraftContentForm action={updateRecommendationDraftContentAction.bind(null, draft.id)} content={latestContent} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">This report is not editable in its current status. Open the report page to review, approve, release or withdraw it.</p>
              )}
              {draftActions.includes("submit_for_review") ? (
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-text">Submit for review</h3>
                  <div className="mt-2">
                    <SubmitForReviewForm action={submitRecommendationDraftForReviewAction.bind(null, draft.id)} />
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          {runs.length > 0 ? (
            <Card className="mb-4">
              <h2 className="text-sm font-semibold text-primary">Analysis history</h2>
              <ul className="mt-2 divide-y divide-border text-sm">
                {runs.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-text-soft">
                      {formatDateTime(r.createdAt)} · {r.provider} · {r.model}
                      {r.inputTokens + r.outputTokens > 0 ? ` · ${(r.inputTokens + r.outputTokens).toLocaleString("en-IN")} tokens · est. ${formatUsd(r.estimatedCostUsd)}` : ""}
                      {r.status !== "succeeded" && r.reason ? ` · ${r.reason}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={r.status === "succeeded" ? "success" : r.status === "reserved" ? "info" : "neutral"}>{RUN_STATUS_LABELS[r.status] ?? r.status}</Badge>
                      {r.draftId ? (
                        <Link href={`/counsellor/recommendations/${r.draftId}`} className="font-medium text-secondary-dark hover:text-primary">
                          Draft
                        </Link>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>

        {/* Right — workflow, generate, consent, usage */}
        <aside>
          <AiWorkflowCard steps={steps} draftHref={draft ? `/counsellor/recommendations/${draft.id}` : null} draftStatusLabel={draftStatus ? RECOMMENDATION_DRAFT_STATUS_LABELS[draftStatus] : null} />

          <Card className="mb-4">
            <h2 className="text-sm font-semibold text-primary">Actions</h2>
            <div className="mt-3">
              <AiGateList gates={gates} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <CareerIntelligenceRequestForm
                action={requestCareerAnalysisAction.bind(null, studentId)}
                idempotencyKey={randomUUID().replace(/-/g, "")}
                previousRuns={previousRuns}
                disabledReason={inProgress ? "An analysis for this student is already in progress." : disabledReason}
                submitLabel={isPaid ? "Generate (paid request)" : "Generate analysis"}
                pendingLabel="Generating — this can take up to a minute…"
                paidNote={isPaid ? "Sends one billed request to OpenAI. The result is a draft for you to edit; nothing reaches the student without independent approval." : null}
              />
            </div>
          </Card>

          <Card className="mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
              <h2 className="text-sm font-semibold text-primary">AI-processing consent</h2>
            </div>
            {consent.status === "valid" ? (
              <>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-text-soft">Given by</dt><dd className="text-right text-text">{CONSENT_PARTY_LABELS[consent.consentingParty]}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-text-soft">Method</dt><dd className="text-right text-text">{CONSENT_METHOD_LABELS[consent.method] ?? consent.method}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-text-soft">Evidence</dt><dd className="text-right text-text">{consent.evidenceReference}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-text-soft">Given on</dt><dd className="text-right text-text">{formatDate(consent.givenOn)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-text-soft">Recorded</dt><dd className="text-right text-text">{formatDateTime(consent.recordedAt)}{consent.recordedByName ? ` · ${consent.recordedByName}` : ""}</dd></div>
                </dl>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-secondary-dark">Withdraw consent</summary>
                  <div className="mt-2">
                    <WithdrawAiConsentForm action={withdrawAiConsentAction.bind(null, studentId, consent.consentId)} />
                  </div>
                </details>
              </>
            ) : consent.status === "unavailable" ? (
              <p className="mt-2 text-sm text-muted">The consent register is not available yet — the NW09.2 database changes have not been applied. No analysis can be requested until it is.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">
                  {consent.status === "withdrawn" ? `Consent was withdrawn on ${formatDate(consent.withdrawnAt)}.` : "No consent is recorded."} Record the consent you hold before requesting an analysis. Students under 18 need a parent or guardian&apos;s consent.
                </p>
                <div className="mt-3">
                  <RecordAiConsentForm action={recordAiConsentAction.bind(null, studentId)} allowFictionalMethod={dataClass === "fictional"} today={today} />
                </div>
              </>
            )}
          </Card>

          <AiUsageCard usage={usage} isPaid={isPaid} lastRun={latest ? { inputTokens: latest.run.inputTokens, outputTokens: latest.run.outputTokens, costUsd: latest.run.estimatedCostUsd } : null} />
        </aside>
      </div>
    </div>
  );
}
