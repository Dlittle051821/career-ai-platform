import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, FileSignature } from "lucide-react";
import { AgreementForm } from "@/components/admin/agreements/AgreementForm";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  CreateAgreementVersionForm,
  SendForSignatureForm,
  ResendSignatureRequestForm,
  CancelSignatureRequestForm,
} from "@/components/admin/agreements/SignatureActionForms";
import { getAgreementById } from "@/lib/supabase/admin/agreements";
import { listAgreementVersions, listSignatureRequests } from "@/lib/supabase/admin/signatures";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { NON_TERMINAL_SIGNATURE_REQUEST_STATUSES } from "@/types/signatures";
import {
  updateAgreementAction,
  createAgreementVersionAction,
  sendForSignatureAction,
  resendSignatureRequestFormAction,
  cancelSignatureRequestFormAction,
} from "../actions";

interface AgreementDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Agreement" };

export default async function AgreementDetailPage({ params }: AgreementDetailPageProps) {
  const { id } = await params;
  const [agreement, universityOptions, counsellorOptions, versions, requests, admin] = await Promise.all([
    getAgreementById(id),
    listUniversityOptions(),
    listCounsellorOptions(),
    listAgreementVersions(id),
    listSignatureRequests(id),
    getCurrentAdmin(),
  ]);
  if (!agreement) notFound();

  const canWrite = hasPermission(admin?.role, "agreements:write");
  const boundAction = updateAgreementAction.bind(null, id);
  const boundCreateVersion = createAgreementVersionAction.bind(null, id);
  const boundSendForSignature = sendForSignatureAction.bind(null, id);

  const draftVersions = versions.filter((v) => v.status === "draft");
  const activeRequest = requests.find((r) => NON_TERMINAL_SIGNATURE_REQUEST_STATUSES.includes(r.status));
  const hasSignedDocument = requests.some((r) => r.hasSignedDocument);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/agreements" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to agreements
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Agreements</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{agreement.agreementType}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(agreement.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <AgreementForm action={boundAction} defaultValues={agreement} universityOptions={universityOptions} counsellorOptions={counsellorOptions} submitLabel="Save changes" />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <FileSignature aria-hidden="true" className="h-5 w-5" />
            Electronic signature
          </h2>
          {hasSignedDocument ? (
            <a href={`/admin/agreements/${agreement.id}/signed-document`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
              <Download aria-hidden="true" className="h-4 w-4" />
              View signed agreement
            </a>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          A version is locked (immutable) the moment it is sent for signature. Editing an agreement after that means
          creating a new version and sending it separately — the old request/version pair is left untouched.
        </p>

        <div className="mt-5 space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-text">Versions</h3>
            {versions.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No versions yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2">
                    <span className="text-text">Version #{v.versionNumber}</span>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <div className="mt-3">
                <CreateAgreementVersionForm action={boundCreateVersion} />
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text">Signature requests</h3>
            {requests.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No signature requests yet.</p>
            ) : (
              <ul className="mt-2 space-y-3 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-[var(--radius-control)] border border-border-strong p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-text">
                        {r.signerName} <span className="text-muted">({r.signerEmail})</span>
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
                      <div>Sent: {formatOrDash(r.sentAt)}</div>
                      <div>Viewed: {formatOrDash(r.viewedAt)}</div>
                      <div>Signed: {formatOrDash(r.signedAt)}</div>
                      <div>{r.declinedAt ? `Declined: ${formatOrDash(r.declinedAt)}` : r.cancelledAt ? `Cancelled: ${formatOrDash(r.cancelledAt)}` : r.expiredAt ? `Expired: ${formatOrDash(r.expiredAt)}` : ""}</div>
                    </dl>
                    {canWrite && (r.status === "sent" || r.status === "viewed") ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <ResendSignatureRequestForm action={resendSignatureRequestFormAction.bind(null, id, r.id)} />
                        <CancelSignatureRequestForm action={cancelSignatureRequestFormAction.bind(null, id, r.id)} />
                      </div>
                    ) : canWrite && NON_TERMINAL_SIGNATURE_REQUEST_STATUSES.includes(r.status) ? (
                      <div className="mt-3">
                        <CancelSignatureRequestForm action={cancelSignatureRequestFormAction.bind(null, id, r.id)} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canWrite && !activeRequest ? (
            <section>
              <h3 className="text-sm font-semibold text-text">Send for signature</h3>
              <div className="mt-2">
                <SendForSignatureForm
                  action={boundSendForSignature}
                  draftVersions={draftVersions}
                  studentName={agreement.studentName}
                  agreementType={agreement.agreementType}
                />
              </div>
            </section>
          ) : activeRequest ? (
            <p className="text-sm text-muted">A signature request is already active — resend or cancel it above before sending a new one.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function formatOrDash(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN") : "—";
}
