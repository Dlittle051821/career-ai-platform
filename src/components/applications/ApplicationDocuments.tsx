"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  APPLICATION_DOCUMENT_CHECKLIST_ORDER,
  APPLICATION_DOCUMENT_TYPE_LABELS,
  REQUIRED_APPLICATION_DOCUMENT_TYPES,
  getApplicationDocumentCompleteness,
  type ApplicationDocumentType,
} from "@/lib/applications/application-documents";
import type { MyApplicationDocument } from "@/lib/supabase/education/application-documents";
import {
  getApplicationDocumentDownloadUrlAction,
  removeApplicationDocumentAction,
  uploadApplicationDocumentAction,
} from "@/app/(site)/applications/actions";

/**
 * Milestone 17 (v2) — the student's own document checklist on
 * /applications/[id]. Renders all nine document types in a fixed order
 * (required first — APPLICATION_DOCUMENT_CHECKLIST_ORDER), each row either
 * "Missing" with an upload control, or showing the current document with
 * View/Replace/Remove controls. Every mutation goes through the four Server
 * Actions in src/app/(site)/applications/actions.ts, which themselves go
 * through the SECURITY DEFINER RPCs in
 * 0018_application_documents_foundation.sql — this component never talks to
 * Supabase directly and never mutates applications.stage.
 *
 * "Remove" uses the same inline arm/confirm pattern as
 * ApplicationActions.tsx (never a native window.confirm(), which blocks the
 * whole page and reads poorly to assistive tech).
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ApplicationDocuments({ applicationId, initialDocuments }: { applicationId: string; initialDocuments: MyApplicationDocument[] }) {
  const [documentsByType, setDocumentsByType] = useState<Partial<Record<ApplicationDocumentType, MyApplicationDocument>>>(() => {
    const map: Partial<Record<ApplicationDocumentType, MyApplicationDocument>> = {};
    for (const doc of initialDocuments) {
      map[doc.documentType as ApplicationDocumentType] = doc;
    }
    return map;
  });

  const completeness = getApplicationDocumentCompleteness(
    Object.values(documentsByType)
      .filter((d): d is MyApplicationDocument => !!d)
      .map((d) => ({ documentType: d.documentType as ApplicationDocumentType, originalFilename: d.originalFilename }))
  );

  function handleRowChange(type: ApplicationDocumentType, doc: MyApplicationDocument | null) {
    setDocumentsByType((prev) => {
      const next = { ...prev };
      if (doc) next[type] = doc;
      else delete next[type];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text">
        {completeness.isRequiredComplete
          ? "All required documents are uploaded."
          : `${completeness.requiredUploaded} of ${completeness.requiredTotal} required documents uploaded.`}
      </p>
      <ul className="space-y-3">
        {APPLICATION_DOCUMENT_CHECKLIST_ORDER.map((type) => (
          <ApplicationDocumentRow
            key={type}
            applicationId={applicationId}
            documentType={type}
            isRequired={REQUIRED_APPLICATION_DOCUMENT_TYPES.includes(type)}
            currentDocument={documentsByType[type] ?? null}
            onChange={(doc) => handleRowChange(type, doc)}
          />
        ))}
      </ul>
    </div>
  );
}

function ApplicationDocumentRow({
  applicationId,
  documentType,
  isRequired,
  currentDocument,
  onChange,
}: {
  applicationId: string;
  documentType: ApplicationDocumentType;
  isRequired: boolean;
  currentDocument: MyApplicationDocument | null;
  onChange: (doc: MyApplicationDocument | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("documentType", documentType);
    startTransition(async () => {
      const result = await uploadApplicationDocumentAction(applicationId, formData);
      if (!result.success || !result.document) {
        setError(result.error ?? "We couldn't save this document. Please try again.");
        return;
      }
      onChange(result.document);
      formRef.current?.reset();
    });
  }

  function handleRemove() {
    if (!currentDocument) return;
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      setError(null);
      return;
    }
    setError(null);
    const documentId = currentDocument.id;
    startTransition(async () => {
      const result = await removeApplicationDocumentAction(applicationId, documentId);
      setConfirmingRemove(false);
      if (!result.success) {
        setError(result.error ?? "We couldn't remove this document. Please try again.");
        return;
      }
      onChange(null);
    });
  }

  function handleView() {
    if (!currentDocument) return;
    setError(null);
    const storagePath = currentDocument.storagePath;
    startTransition(async () => {
      const { url } = await getApplicationDocumentDownloadUrlAction(storagePath);
      if (!url) {
        setError("This document is not available right now. Please refresh and try again.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <li className="border-t border-border pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">
            {APPLICATION_DOCUMENT_TYPE_LABELS[documentType]}
            {isRequired ? <span className="ml-1.5 text-xs font-normal text-muted">(required)</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {currentDocument ? `${currentDocument.originalFilename} — ${formatFileSize(currentDocument.fileSizeBytes)}` : "Missing"}
          </p>
        </div>
        {currentDocument ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleView} disabled={isPending}>
              View
            </Button>
            <Button type="button" size="sm" variant={confirmingRemove ? "destructive" : "outline"} onClick={handleRemove} disabled={isPending}>
              {confirmingRemove ? "Click again to confirm" : "Remove"}
            </Button>
          </div>
        ) : null}
      </div>

      <form ref={formRef} onSubmit={handleUpload} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="text-xs text-text-soft" />
        <Button type="submit" size="sm" variant={currentDocument ? "outline" : "primary"} disabled={isPending}>
          {isPending ? "Saving…" : currentDocument ? "Replace" : "Upload"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}
