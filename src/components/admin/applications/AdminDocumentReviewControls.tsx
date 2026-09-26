"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { reviewApplicationDocumentAction } from "@/app/admin/applications/actions";
import { APPLICATION_DOCUMENT_REVIEW_STATUS_LABELS, type ApplicationDocumentReviewStatus } from "@/lib/applications/application-documents";

/**
 * Milestone 18 — staff document review controls. Every mutation goes
 * through reviewApplicationDocumentAction(), which itself goes through
 * staff_review_application_document() (0020_application_processing_
 * workspace.sql PART 2) — this component never talks to Supabase directly
 * and never sets applications.stage. Two fields are kept explicitly
 * separate throughout — an INTERNAL note (staff-only) and a STUDENT-FACING
 * correction message — matching the task's own "do not mix internal notes
 * and student-facing requests in one field" instruction.
 */
export function AdminDocumentReviewControls({
  applicationId,
  documentId,
  reviewStatus,
  correctionMessage,
  reviewNote,
  reviewedAt,
}: {
  applicationId: string;
  documentId: string;
  reviewStatus: ApplicationDocumentReviewStatus;
  correctionMessage: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}) {
  const [mode, setMode] = useState<"idle" | "correcting">("idle");
  const [message, setMessage] = useState(correctionMessage ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitReview(status: ApplicationDocumentReviewStatus, options: { correctionMessage?: string; reviewNote?: string } = {}) {
    setError(null);
    startTransition(async () => {
      const result = await reviewApplicationDocumentAction(applicationId, documentId, status, options);
      if (!result.success) {
        setError(result.error ?? "We couldn't save this review. Please try again.");
        return;
      }
      setMode("idle");
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={reviewStatus === "accepted" ? "success" : reviewStatus === "needs_correction" ? "warning" : "neutral"}>
          {APPLICATION_DOCUMENT_REVIEW_STATUS_LABELS[reviewStatus]}
        </Badge>
        {reviewedAt ? <span className="text-xs text-muted">Reviewed {new Date(reviewedAt).toLocaleString("en-IN")}</span> : null}
      </div>

      {reviewNote ? <p className="rounded-md bg-surface-alt px-2 py-1.5 text-xs text-text-soft">Internal note: {reviewNote}</p> : null}

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={isPending || reviewStatus === "accepted"} onClick={() => submitReview("accepted")}>
            Accept
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending || reviewStatus === "needs_correction"} onClick={() => setMode("correcting")}>
            Request correction
          </Button>
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-border p-3">
          <FormField id={`correction-${documentId}`} label="Message to the student (required)">
            <Textarea
              id={`correction-${documentId}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. Upload a clearer passport copy — the current scan is unreadable."
            />
          </FormField>
          <FormField id={`review-note-${documentId}`} label="Internal note (staff only, optional)">
            <Textarea id={`review-note-${documentId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} />
          </FormField>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !message.trim()}
              onClick={() => submitReview("needs_correction", { correctionMessage: message.trim(), reviewNote: note.trim() || undefined })}
            >
              {isPending ? "Saving…" : "Send correction request"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
