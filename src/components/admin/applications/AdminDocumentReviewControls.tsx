"use client";

import { useState, useTransition } from "react";
import { Lock, MessageSquareText } from "lucide-react";
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

      {/* UX09 — the two messages below were already stored and already
          distinct in the data model (correction_message is STUDENT-FACING,
          review_note is STAFF-ONLY — see this file's own header comment),
          but only reviewNote was ever actually rendered once set; the
          active correction message a student was actually sent had no
          read-only display at all outside the edit form. Fixing that (never
          changing which field is which, never adding a new field) and
          giving the two a deliberately different visual treatment — accent/
          message-icon for what the student sees, neutral/lock-icon for what
          only staff sees — so the distinction the task requires is obvious
          at a glance, not just correct in the data. */}
      {reviewStatus === "needs_correction" && correctionMessage ? (
        <div className="flex items-start gap-2 rounded-md border border-accent/25 bg-accent-light px-2.5 py-2 text-xs">
          <MessageSquareText aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-dark" />
          <div>
            <p className="font-semibold uppercase tracking-wide text-accent-dark">Sent to student</p>
            <p className="mt-0.5 text-text">{correctionMessage}</p>
          </div>
        </div>
      ) : null}

      {reviewNote ? (
        <div className="flex items-start gap-2 rounded-md border border-border-strong bg-surface-alt px-2.5 py-2 text-xs">
          <Lock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted">Internal note — staff only</p>
            <p className="mt-0.5 text-text-soft">{reviewNote}</p>
          </div>
        </div>
      ) : null}

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
