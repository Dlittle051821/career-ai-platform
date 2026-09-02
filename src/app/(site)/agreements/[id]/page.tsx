import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileSignature, Stamp } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getMyAgreementById } from "@/lib/supabase/agreements/my-agreements";

interface AgreementDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Agreement" };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
  draft: "neutral",
  pending: "warning",
  sent: "info",
  viewed: "warning",
  signed: "success",
  declined: "error",
  cancelled: "neutral",
  expired: "neutral",
  failed: "error",
};

const STAMP_STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
  draft: "neutral",
  pending: "warning",
  processing: "info",
  completed: "success",
  failed: "error",
  cancelled: "neutral",
  expired: "neutral",
};

/**
 * Milestone 10 (F-122) — the student's own agreement detail page.
 * getMyAgreementById() re-derives ownership from the signed-in student's
 * own session server-side (never trusts the [id] URL segment alone) — see
 * that function's own docblock. An id that is not the caller's own
 * agreement resolves identically to notFound() as an id that doesn't
 * exist at all.
 */
export default async function StudentAgreementDetailPage({ params }: AgreementDetailPageProps) {
  const { id } = await params;
  const agreement = await getMyAgreementById(id);
  if (!agreement) notFound();

  const request = agreement.latestSignatureRequest;
  const stampRequest = agreement.latestStampRequest;

  return (
    <>
      <PageHero
        eyebrow="Agreements"
        title={agreement.agreementType}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agreements", href: "/dashboard" }, { label: agreement.agreementType }]}
      />
      <Section>
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={request ? (STATUS_TONE[request.status] ?? "neutral") : "neutral"}>
                {request ? signatureStatusLabel(request.status) : "No signature request yet"}
              </Badge>
              {request?.hasSignedDocument ? (
                <a href={`/agreements/${agreement.id}/signed-document`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Download signed agreement
                </a>
              ) : null}
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Effective date</dt>
                <dd className="mt-1 text-sm font-medium text-text">{agreement.effectiveDate ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Last updated</dt>
                <dd className="mt-1 text-sm font-medium text-text">{new Date(agreement.updatedAt).toLocaleString("en-IN")}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-muted">
              Electronic signature is a technical capability provided by this application — it does not assert legal
              validity in any particular jurisdiction.
            </p>
          </Card>

          {request ? (
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
                <FileSignature aria-hidden="true" className="h-5 w-5" />
                Signature status
              </h2>
              <ol className="mt-4 space-y-3 text-sm">
                <TimelineRow label="Sent" at={request.sentAt} />
                <TimelineRow label="Viewed" at={request.viewedAt} />
                <TimelineRow label="Signed" at={request.signedAt} />
                {request.declinedAt ? <TimelineRow label="Declined" at={request.declinedAt} tone="error" /> : null}
                {request.cancelledAt ? <TimelineRow label="Cancelled" at={request.cancelledAt} tone="neutral" /> : null}
                {request.expiredAt ? <TimelineRow label="Expired" at={request.expiredAt} tone="neutral" /> : null}
              </ol>
              {request.status === "sent" || request.status === "viewed" ? (
                <p className="mt-4 rounded-[var(--radius-control)] border border-info/25 bg-info-light px-3.5 py-2.5 text-xs text-info">
                  Awaiting signature from {request.signerName} ({request.signerEmail}). You will be notified once this
                  is signed.
                </p>
              ) : null}
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">This agreement has not yet been sent for signature.</p>
            </Card>
          )}

          {agreement.stampSignSequence === "SIGN_ONLY" ? null : agreement.stampSignSequence && stampRequest ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
                  <Stamp aria-hidden="true" className="h-5 w-5" />
                  Stamping status
                </h2>
                <Badge tone={STAMP_STATUS_TONE[stampRequest.status] ?? "neutral"}>{stampStatusLabel(stampRequest.status)}</Badge>
              </div>
              <ol className="mt-4 space-y-3 text-sm">
                <TimelineRow label="Processing" at={stampRequest.processingAt} />
                <TimelineRow label="Completed" at={stampRequest.completedAt} />
                {stampRequest.failedAt ? <TimelineRow label="Failed" at={stampRequest.failedAt} tone="error" /> : null}
                {stampRequest.cancelledAt ? <TimelineRow label="Cancelled" at={stampRequest.cancelledAt} tone="neutral" /> : null}
                {stampRequest.expiredAt ? <TimelineRow label="Expired" at={stampRequest.expiredAt} tone="neutral" /> : null}
              </ol>
              {stampRequest.hasStampedDocument ? (
                <a href={`/agreements/${agreement.id}/stamped-document`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Download stamped agreement
                </a>
              ) : null}
            </Card>
          ) : null}
        </div>
      </Section>
    </>
  );
}

function stampStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Stamp request created",
    pending: "Stamp requested",
    processing: "Stamping in progress",
    completed: "Stamped",
    failed: "Stamping failed",
    cancelled: "Cancelled",
    expired: "Expired",
  };
  return labels[status] ?? status;
}

function signatureStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Agreement generated",
    pending: "Sent for signature",
    sent: "Awaiting signature",
    viewed: "Awaiting signature",
    signed: "Signed",
    declined: "Declined",
    cancelled: "Cancelled",
    expired: "Expired",
    failed: "Failed",
  };
  return labels[status] ?? status;
}

function TimelineRow({ label, at, tone = "info" }: { label: string; at: string | null; tone?: "info" | "error" | "neutral" }) {
  const toneClass = at ? (tone === "error" ? "bg-error" : tone === "neutral" ? "bg-muted" : "bg-success") : "bg-border-strong";
  return (
    <li className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClass}`} aria-hidden="true" />
      <span className="w-20 shrink-0 font-medium text-text">{label}</span>
      <span className="text-text-soft">{at ? new Date(at).toLocaleString("en-IN") : "—"}</span>
    </li>
  );
}
