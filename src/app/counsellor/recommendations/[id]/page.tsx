import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  EditRecommendationDraftContentForm,
  SubmitForReviewForm,
  ApproveDraftForm,
  RequestChangesForm,
  ReleaseDraftForm,
  WithdrawDraftForm,
  ArchiveDraftForm,
} from "@/components/counsellor/RecommendationDraftActionForms";
import { getRecommendationDraftWithStudentNameById, listRecommendationDraftVersions } from "@/lib/supabase/admin/recommendation-drafts";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import {
  RECOMMENDATION_DRAFT_STATUS_LABELS,
  isRecommendationDraftStatus,
  getAllowedRecommendationDraftActions,
  canReviewOwnDraft,
  type RecommendationDraftContent,
} from "@/lib/recommendations/drafts";
import {
  updateRecommendationDraftContentAction,
  submitRecommendationDraftForReviewAction,
  reviewRecommendationDraftAction,
  releaseRecommendationDraftAction,
  withdrawRecommendationDraftAction,
  archiveRecommendationDraftAction,
} from "./actions";

interface RecommendationDraftPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Recommendation Report" };

const CONTENT_FIELD_LABELS: Record<keyof RecommendationDraftContent, string> = {
  summary: "Summary",
  careerGuidance: "Career guidance",
  courseGuidance: "Course guidance",
  collegeGuidance: "College guidance",
  pathwayGuidance: "Pathway guidance",
  counsellorRationale: "Counsellor rationale",
};

/**
 * NW07.6 — the Recommendation Review page: author, submit, independently
 * review (approve/request changes), release, withdraw, or archive one
 * recommendation report. Every button is gated two ways before it's even
 * rendered — getAllowedRecommendationDraftActions(status) (never render an
 * impossible-for-this-status action) AND, for Approve/Request changes,
 * canReviewOwnDraft() (never render a self-review control for the draft's
 * own author) — but neither gate is trusted as the real boundary; the
 * underlying staff_* RPC re-checks both server-side regardless, and a
 * request that slips past this UI (e.g. a replayed form POST) still fails
 * there. Self-approval has NO role-based exception, including for admin.
 */
export default async function RecommendationDraftPage({ params }: RecommendationDraftPageProps) {
  const { id } = await params;
  const [draft, admin] = await Promise.all([getRecommendationDraftWithStudentNameById(id), getCurrentAdmin()]);
  if (!draft) notFound();

  const status = isRecommendationDraftStatus(draft.status) ? draft.status : null;
  const versions = await listRecommendationDraftVersions(id);
  const latestVersion = versions[versions.length - 1] ?? null;
  const content: RecommendationDraftContent = latestVersion?.content ?? {};
  const contentEntries = (Object.keys(CONTENT_FIELD_LABELS) as (keyof RecommendationDraftContent)[]).filter((key) => content[key]);

  const allowedActions = status ? getAllowedRecommendationDraftActions(status) : [];
  const viewerMayReview = admin ? canReviewOwnDraft(draft.createdBy, admin.userId) : false;
  const isEditable = allowedActions.includes("edit");

  const boundUpdateContent = updateRecommendationDraftContentAction.bind(null, id);
  const boundSubmit = submitRecommendationDraftForReviewAction.bind(null, id);
  const boundApprove = reviewRecommendationDraftAction.bind(null, id, "approve");
  const boundRequestChanges = reviewRecommendationDraftAction.bind(null, id, "request_changes");
  const boundRelease = releaseRecommendationDraftAction.bind(null, id);
  const boundWithdraw = withdrawRecommendationDraftAction.bind(null, id);
  const boundArchive = archiveRecommendationDraftAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/counsellor/recommendations" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to Recommendations
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Recommendation Report</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{draft.title}</h1>
          <p className="mt-2 text-sm text-muted">
            For{" "}
            <Link href={`/counsellor/students/${draft.studentUserId}`} className="font-semibold text-secondary-dark hover:text-primary">
              {draft.studentName || "this student"}
            </Link>
            {draft.recommendationType ? ` · ${draft.recommendationType}` : ""}
          </p>
        </div>
        {status ? <Badge tone={status === "released_to_student" ? "success" : status === "changes_requested" ? "warning" : "neutral"}>{RECOMMENDATION_DRAFT_STATUS_LABELS[status]}</Badge> : null}
      </div>

      {status === "changes_requested" && draft.reviewNotes ? (
        <Card className="mb-6 border-warning/30 bg-warning-light">
          <p className="text-sm font-semibold text-warning">Changes requested</p>
          <p className="mt-1 text-sm text-warning">{draft.reviewNotes}</p>
        </Card>
      ) : null}

      <Card className="mb-6 flex items-center justify-between gap-3 border-info/25 bg-info-light">
        <p className="text-sm text-info">
          Draft → submitted → approved → released. A draft only reaches the student once an independent reviewer
          (never its own author) approves it and it is explicitly released.
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="text-base font-semibold text-primary">Report content {latestVersion ? `(version ${latestVersion.versionNumber})` : ""}</h2>
        {isEditable ? (
          <div className="mt-4">
            <EditRecommendationDraftContentForm action={boundUpdateContent} content={content} />
          </div>
        ) : contentEntries.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No content has been written yet.</p>
        ) : (
          <dl className="mt-4 space-y-4">
            {contentEntries.map((key) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{CONTENT_FIELD_LABELS[key]}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-text">{content[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {allowedActions.includes("submit_for_review") ? (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-primary">Submit for review</h2>
          <div className="mt-3">
            <SubmitForReviewForm action={boundSubmit} />
          </div>
        </Card>
      ) : null}

      {(allowedActions.includes("review_approve") || allowedActions.includes("review_request_changes")) && (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-primary">Independent review</h2>
          {!viewerMayReview ? (
            <p className="mt-3 text-sm text-muted">
              You authored this report, so you can&apos;t review it yourself — another authorized reviewer needs to
              approve it or request changes.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-text">Approve</p>
                <ApproveDraftForm action={boundApprove} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text">Request changes</p>
                <RequestChangesForm action={boundRequestChanges} />
              </div>
            </div>
          )}
        </Card>
      )}

      {allowedActions.includes("release") ? (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-primary">Release to student</h2>
          <div className="mt-3">
            <ReleaseDraftForm action={boundRelease} />
          </div>
        </Card>
      ) : null}

      {allowedActions.includes("withdraw") ? (
        <Card className="mb-6">
          <h2 className="text-base font-semibold text-primary">Withdraw from review</h2>
          <div className="mt-3">
            <WithdrawDraftForm action={boundWithdraw} />
          </div>
        </Card>
      ) : null}

      {allowedActions.includes("archive") ? (
        <Card>
          <h2 className="text-base font-semibold text-primary">Archive</h2>
          <div className="mt-3">
            <ArchiveDraftForm action={boundArchive} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
