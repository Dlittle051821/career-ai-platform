import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageSquareText, UserCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ApplicationForm } from "@/components/admin/applications/ApplicationForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WORK_QUEUE_BUCKET_ICON, WORK_QUEUE_BUCKET_ICON_CLASS, WORK_QUEUE_BUCKET_TONE } from "@/components/admin/applications/work-queue-visuals";
import { getWorkQueueBucket, WORK_QUEUE_BUCKET_LABELS } from "@/lib/applications/application-work-queue";
import { getApplicationById } from "@/lib/supabase/admin/applications";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCourseOptions } from "@/lib/supabase/admin/courses";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { listApplicationDocumentsForAdmin } from "@/lib/supabase/admin/application-documents";
import { getApplicationChecklistItems } from "@/lib/supabase/admin/application-checklist";
import { getApplicationInternalNotes } from "@/lib/supabase/admin/application-notes";
import { getApplicationSubmissionForAdmin, listApplicationSubmissionDocumentsForAdmin } from "@/lib/supabase/admin/application-submissions";
import {
  APPLICATION_DOCUMENT_TYPE_LABELS,
  getApplicationDocumentCompleteness,
  getApplicationDocumentReviewCompleteness,
  type ApplicationDocumentType,
} from "@/lib/applications/application-documents";
import { getApplicationChecklistView } from "@/lib/applications/application-checklist";
import { getApplicationReadiness } from "@/lib/applications/application-readiness";
import { getApplicationSubmissionReadiness } from "@/lib/applications/application-submission";
import { getNextOperationalAction } from "@/lib/applications/next-operational-action";
import { AdminDocumentDownloadButton } from "@/components/admin/applications/AdminDocumentDownloadButton";
import { AdminDocumentReviewControls } from "@/components/admin/applications/AdminDocumentReviewControls";
import { AdminApplicationChecklist } from "@/components/admin/applications/AdminApplicationChecklist";
import { AdminApplicationNotes } from "@/components/admin/applications/AdminApplicationNotes";
import { AdminApplicationSubmissionPanel } from "@/components/admin/applications/AdminApplicationSubmissionPanel";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { APPLICATION_STAGE_LABELS } from "@/types/admin";
import { updateApplicationAction } from "../actions";

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Application workspace" };

/**
 * Milestone 18 — Counsellor Application Processing Workspace. Improves this
 * SAME page (never a parallel application-detail architecture) into the
 * recommended section hierarchy: HEADER (ApplicationForm, unchanged, already
 * has assignment/stage) -> PROCESSING SUMMARY (new) -> DOCUMENTS (M17,
 * extended with M18 review controls) -> CHECKLIST (new) -> NOTES (new) ->
 * HISTORY (M16 stage history, unchanged). Every M18 section is gated behind
 * `application-documents:review` — the same narrow permission that
 * authorizes the underlying mutations — so a finance/analyst/content_editor
 * caller (who can still reach this page via `applications:read`) sees
 * exactly the same page M17 already gave them: no Documents card, and now
 * also no Checklist/Notes/Processing-summary cards, rather than a crash.
 */
export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const [application, universityOptions, courseOptions, counsellorOptions, admin] = await Promise.all([
    getApplicationById(id),
    listUniversityOptions(),
    listCourseOptions(),
    listCounsellorOptions(),
    getCurrentAdmin(),
  ]);
  if (!application) notFound();

  const canReadDocuments = hasPermission(admin?.role, "application-documents:read");
  const canReviewWorkspace = hasPermission(admin?.role, "application-documents:review");
  const canReadSubmissions = hasPermission(admin?.role, "application-submissions:read");
  const canWriteSubmissions = hasPermission(admin?.role, "application-submissions:write");

  const documents = canReadDocuments ? await listApplicationDocumentsForAdmin(id) : [];
  const [checklistItems, internalNotes] = canReviewWorkspace
    ? await Promise.all([getApplicationChecklistItems(id), getApplicationInternalNotes(id)])
    : [[], []];
  const existingSubmission = canReadSubmissions ? await getApplicationSubmissionForAdmin(id) : null;
  const submissionDocuments = existingSubmission ? await listApplicationSubmissionDocumentsForAdmin(existingSubmission.id) : [];

  const documentCompleteness = getApplicationDocumentCompleteness(documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, originalFilename: d.originalFilename })));
  const documentReviewCompleteness = getApplicationDocumentReviewCompleteness(
    documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, reviewStatus: d.reviewStatus }))
  );
  const readiness = getApplicationReadiness({
    stage: application.stage,
    documentCompleteness,
    documentReviewCompleteness,
    manualChecklistItems: checklistItems,
  });
  const checklistView = getApplicationChecklistView({
    manualItems: checklistItems,
    documentCompleteness,
    documentReviewCompleteness,
    isReady: readiness.isReady,
  });
  const submissionReadiness = getApplicationSubmissionReadiness({
    stage: application.stage,
    applicationReadiness: readiness,
    hasExistingSubmission: !!existingSubmission,
  });
  const documentPack = documents.filter((d) => d.reviewStatus === "accepted").map((d) => ({ documentType: d.documentType, originalFilename: d.originalFilename }));

  const nextAction = getNextOperationalAction({
    stage: application.stage,
    currentDocuments: documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, reviewStatus: d.reviewStatus })),
    documentCompleteness,
    documentReviewCompleteness,
    manualChecklistItems: checklistItems,
    submission: existingSubmission ? { hasExternalReference: !!existingSubmission.externalReference } : null,
  });

  const boundAction = updateApplicationAction.bind(null, id, application.studentUserId);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to applications
      </Link>

      {/* APPLICATION HEADER — identity (hierarchy step 1). Stage, assigned
          counsellor, and every other editable field live in ApplicationForm
          just below (step 2/3) — an existing M16 component this pass does
          not redesign, only relocates relative to. */}
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Application</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
          {application.studentName ?? "Unnamed student"}
          {application.universityName ? ` — ${application.universityName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(application.updatedAt).toLocaleString("en-IN")}</p>
      </div>

      {/* NEXT OPERATIONAL ACTION — Milestone 18/19, UX09-restyled and moved
          here, immediately after identity and ahead of every editable field
          (hierarchy step 4: "what happens next" before "what IS it").
          Sticky on desktop so it stays visible while scrolling through a
          long workspace; collapses into normal flow below sm (task's own
          "on mobile/tablet: collapse into normal flow" instruction) since
          a sticky element pinned mid-scroll on a small screen just eats
          content height for no benefit. Purely informational — never
          mutates stage, never auto-submits. Omitted for a caller without
          application-documents:review (finance/analyst/content_editor). */}
      {canReviewWorkspace ? (
        <Card className="sm:sticky sm:top-4 sm:z-10 mb-6 space-y-3 transition-shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-primary">Next operational action</h2>
            <Badge tone={WORK_QUEUE_BUCKET_TONE[getWorkQueueBucket(nextAction.kind)]} className="gap-1.5">
              {(() => {
                const Icon = WORK_QUEUE_BUCKET_ICON[getWorkQueueBucket(nextAction.kind)];
                return <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${WORK_QUEUE_BUCKET_ICON_CLASS[getWorkQueueBucket(nextAction.kind)]}`} />;
              })()}
              {WORK_QUEUE_BUCKET_LABELS[getWorkQueueBucket(nextAction.kind)]}
            </Badge>
          </div>
          <p className="text-sm text-text">{nextAction.label}</p>
          {readiness.blockers.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">What&apos;s blocking the next step</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted">
                {readiness.blockers.map((b) => (
                  <li key={b.reason}>• {b.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-success">Every readiness signal is satisfied — ready for the staff-controlled submission step.</p>
          )}
        </Card>
      ) : null}

      <ApplicationForm
        action={boundAction}
        defaultValues={application}
        universityOptions={universityOptions}
        courseOptions={courseOptions}
        counsellorOptions={counsellorOptions}
        submitLabel="Save changes"
      />

      {/* READINESS — Milestone 18's checklist, surfaced right after the
          editable identity/stage fields (hierarchy step 5), ahead of
          documents/submission. A checklist + blocker list, deliberately
          never collapsed into a misleading percentage (task's own
          instruction). */}
      {canReviewWorkspace ? (
        <Card className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-primary">Readiness checklist</h2>
          <AdminApplicationChecklist applicationId={id} items={checklistView} />
        </Card>
      ) : null}

      {/* STUDENT ACTION REQUIRED — new in UX09, purely presentational: a
          direct re-read of documents already fetched above (never a new
          query, never new logic) framed from the STUDENT's side of the
          workflow (hierarchy step 6), distinct from "Next operational
          action" above (which is framed from STAFF's side). Shows the
          student's own note (Milestone 16) alongside, since both answer
          "what does the student currently see/need to do". */}
      <Card className="mt-6 space-y-3">
        <h2 className="text-base font-semibold text-primary">Student action required</h2>
        {documents.some((d) => d.reviewStatus === "needs_correction") ? (
          <ul className="space-y-2">
            {documents
              .filter((d) => d.reviewStatus === "needs_correction")
              .map((d) => (
                <li key={d.id} className="flex items-start gap-2 rounded-md border border-accent/25 bg-accent-light px-2.5 py-2 text-xs">
                  <MessageSquareText aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-dark" />
                  <div>
                    <p className="font-semibold text-accent-dark">{APPLICATION_DOCUMENT_TYPE_LABELS[d.documentType as ApplicationDocumentType] ?? d.documentType}</p>
                    <p className="mt-0.5 text-text">{d.correctionMessage}</p>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-success">Nothing is currently waiting on the student.</p>
        )}
        <div className="border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <UserCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            Student&apos;s own note
          </p>
          <p className="mt-1 text-sm text-text">{application.studentNote?.trim() ? application.studentNote : "No note from the student yet."}</p>
        </div>
      </Card>

      {/* SUBMISSION PREPARATION — Milestone 19. Extends this SAME page
          (never a parallel system). Gated behind application-submissions:read
          — omitted entirely for a caller without it (finance/analyst/
          content_editor), same "card disappears rather than crashes" posture
          as every other M18/M19 card on this page. Viewing this page never
          mutates anything by itself — only the explicit "Record submitted
          application" action inside the panel does. */}
      {canReadSubmissions ? (
        <Card className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-primary">Submission preparation</h2>
          <AdminApplicationSubmissionPanel
            applicationId={id}
            canWrite={canWriteSubmissions}
            readiness={submissionReadiness}
            underlyingBlockers={readiness.blockers}
            documentPack={documentPack}
            existingSubmission={existingSubmission}
            submissionDocuments={submissionDocuments}
          />
        </Card>
      ) : null}

      {/* Milestone 16 — key lifecycle timestamps. (The student's own note
          moved up into "Student action required" above, so it is not
          repeated here.) */}
      <Card className="mt-6 space-y-3">
        <h2 className="text-base font-semibold text-primary">Lifecycle timestamps</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Submitted</p>
            <p className="mt-0.5 text-text">{application.submittedAt ? new Date(application.submittedAt).toLocaleString("en-IN") : "Not yet"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Decision recorded</p>
            <p className="mt-0.5 text-text">{application.decisionAt ? new Date(application.decisionAt).toLocaleString("en-IN") : "Not yet"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Withdrawn</p>
            <p className="mt-0.5 text-text">{application.withdrawnAt ? new Date(application.withdrawnAt).toLocaleString("en-IN") : "Not withdrawn"}</p>
          </div>
        </div>
      </Card>

      {/* DOCUMENTS — Milestone 17 (list/view), extended by Milestone 18
          (review controls). Shows CURRENT documents only. */}
      {canReadDocuments && (
        <Card className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-primary">Documents</h2>
          {!documentCompleteness.isRequiredComplete ? (
            <p className="text-xs text-muted">
              {documentCompleteness.missingRequired.map((t) => APPLICATION_DOCUMENT_TYPE_LABELS[t]).join(", ")} still missing.
            </p>
          ) : null}
          {documents.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No documents uploaded yet.</p>
          ) : (
            <ul className="mt-1 space-y-3">
              {documents.map((doc) => (
                <li key={doc.id} className="border-t border-border pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-text">{APPLICATION_DOCUMENT_TYPE_LABELS[doc.documentType as ApplicationDocumentType] ?? doc.documentType}</p>
                      <p className="mt-0.5 text-xs text-muted">{doc.originalFilename}</p>
                    </div>
                    <AdminDocumentDownloadButton storagePath={doc.storagePath} />
                  </div>
                  {canReviewWorkspace ? (
                    <AdminDocumentReviewControls
                      applicationId={id}
                      documentId={doc.id}
                      reviewStatus={doc.reviewStatus}
                      correctionMessage={doc.correctionMessage}
                      reviewNote={doc.reviewNote}
                      reviewedAt={doc.reviewedAt}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* NOTES — Milestone 18. INTERNAL ONLY. */}
      {canReviewWorkspace ? (
        <Card className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-primary">Internal notes</h2>
          <AdminApplicationNotes applicationId={id} initialNotes={internalNotes} />
        </Card>
      ) : null}

      {/* HISTORY — Milestone 16, unchanged. */}
      <Card className="mt-6">
        <h2 className="text-base font-semibold text-primary">Stage history</h2>
        {application.statusHistory.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No stage changes recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {application.statusHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm first:border-0 first:pt-0">
                <span className="flex flex-wrap items-center gap-2 text-text-soft">
                  {h.fromStatus ? (
                    <StatusBadge status={h.fromStatus} labelOverride={APPLICATION_STAGE_LABELS[h.fromStatus as keyof typeof APPLICATION_STAGE_LABELS] ?? h.fromStatus} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  →
                  <StatusBadge status={h.toStatus} labelOverride={APPLICATION_STAGE_LABELS[h.toStatus as keyof typeof APPLICATION_STAGE_LABELS] ?? h.toStatus} />
                  <span className="text-xs text-muted">({h.actorType})</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{new Date(h.createdAt).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
