import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ApplicationForm } from "@/components/admin/applications/ApplicationForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getApplicationById } from "@/lib/supabase/admin/applications";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCourseOptions } from "@/lib/supabase/admin/courses";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { listApplicationDocumentsForAdmin } from "@/lib/supabase/admin/application-documents";
import { APPLICATION_DOCUMENT_TYPE_LABELS, type ApplicationDocumentType } from "@/lib/applications/application-documents";
import { AdminDocumentDownloadButton } from "@/components/admin/applications/AdminDocumentDownloadButton";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { APPLICATION_STAGE_LABELS } from "@/types/admin";
import { updateApplicationAction } from "../actions";

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Application" };

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

  // Milestone 17 (v3) — read-only. `applications:read` (required just to
  // reach this page at all, via getApplicationById above) is deliberately
  // NOT what gates the Documents card below: this table's own access model
  // is narrower (super_admin/admin/assigned counsellor only — see
  // 0018_application_documents_foundation.sql PART 2/5 and
  // docs/application-documents-guide.md's "Least-privilege document access
  // (M17-v3)" section for the full reasoning), so a finance/analyst caller
  // — who DOES hold applications:read and can reach this page — must not
  // trip an AdminAuthorizationError just by loading it. Checked explicitly
  // here (rather than assumed) so the card simply disappears instead of
  // crashing the page if the two ever drift, same pattern this codebase
  // already uses for "profile-verification:read"/"recommendation-readiness:
  // read" on src/app/admin/students/[id]/page.tsx.
  const canReadDocuments = hasPermission(admin?.role, "application-documents:read");
  const documents = canReadDocuments ? await listApplicationDocumentsForAdmin(id) : [];

  const boundAction = updateApplicationAction.bind(null, id, application.studentUserId);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to applications
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Applications</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
          {application.studentName ?? "Unnamed student"}
          {application.universityName ? ` — ${application.universityName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(application.updatedAt).toLocaleString("en-IN")}</p>
      </div>

      <ApplicationForm
        action={boundAction}
        defaultValues={application}
        universityOptions={universityOptions}
        courseOptions={courseOptions}
        counsellorOptions={counsellorOptions}
        submitLabel="Save changes"
      />

      {/* Milestone 16 — student-authored fields, shown read-only here. The
          student note is editable only by the student themselves (via
          student_update_application_note()); this admin page never writes
          to it, matching the "student note is student-editable, visible to
          authorized admin" requirement without conflating it with
          internal_notes above. */}
      <Card className="mt-6 space-y-3">
        <h2 className="text-base font-semibold text-primary">Student-visible details</h2>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Student&apos;s note</p>
          <p className="mt-1 text-sm text-text">{application.studentNote?.trim() ? application.studentNote : "No note from the student yet."}</p>
        </div>
        <div className="grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
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

      {/* Milestone 17 — read-only. No upload/replace/remove control anywhere
          on this page — every document mutation is student-only
          (src/lib/supabase/education/application-documents.ts), matching
          this milestone's "keep admin changes minimal, no M18 review
          workflow" scope. Shows CURRENT documents only
          (listApplicationDocumentsForAdmin() filters is_current — this
          milestone has no version-history UI). Omitted entirely (not shown
          as an empty state) for a caller without application-documents:read
          — see canReadDocuments above. */}
      {canReadDocuments && (
        <Card className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-primary">Documents</h2>
          {documents.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No documents uploaded yet.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm first:border-0 first:pt-0">
                  <div>
                    <p className="text-text">{APPLICATION_DOCUMENT_TYPE_LABELS[doc.documentType as ApplicationDocumentType] ?? doc.documentType}</p>
                    <p className="mt-0.5 text-xs text-muted">{doc.originalFilename}</p>
                  </div>
                  <AdminDocumentDownloadButton storagePath={doc.storagePath} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

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
