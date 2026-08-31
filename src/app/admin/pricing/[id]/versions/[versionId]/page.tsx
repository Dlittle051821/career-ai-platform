import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PricingPlanVersionForm } from "@/components/admin/pricing/PricingPlanVersionForm";
import { PricingPlanVersionWorkflowCard } from "@/components/admin/pricing/PricingPlanVersionWorkflowCard";
import { PricingInclusionsManager } from "@/components/admin/pricing/PricingInclusionsManager";
import { Card } from "@/components/ui/Card";
import { getPricingPlanById, listPricingInclusions } from "@/lib/supabase/admin/pricing";
import { formatMoney } from "@/lib/admin/money";
import { formatComparisonCell, hasApprovedBenefits, NEUTRAL_SCOPE_FALLBACK } from "@/lib/pricing/plan-versions";
import { publishPricingPlanVersionAction, archivePricingPlanVersionAction, updatePricingPlanVersionAction } from "../../../actions";

interface PricingPlanVersionDetailPageProps {
  params: Promise<{ id: string; versionId: string }>;
}

export const metadata: Metadata = { title: "Price Version" };

export default async function PricingPlanVersionDetailPage({ params }: PricingPlanVersionDetailPageProps) {
  const { id, versionId } = await params;
  const detail = await getPricingPlanById(id);
  if (!detail) notFound();
  const version = detail.versions.find((v) => v.id === versionId);
  if (!version) notFound();
  const inclusions = await listPricingInclusions(versionId);

  const publishAction = publishPricingPlanVersionAction.bind(null, id, versionId);
  const archiveAction = archivePricingPlanVersionAction.bind(null, id, versionId);
  const updateAction = updatePricingPlanVersionAction.bind(null, id, versionId);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/pricing/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to {detail.plan.internalName}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{detail.plan.internalName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
          Version {version.versionNumber} — {formatMoney(version.amountMinorUnits, version.currency)}
        </h1>
      </div>

      <div className="mb-6">
        <PricingPlanVersionWorkflowCard status={version.status} onPublish={publishAction} onArchive={archiveAction} />
      </div>

      {version.status === "draft" ? (
        <div className="space-y-6">
          <PricingPlanVersionForm action={updateAction} currency={version.currency} defaultValues={version} submitLabel="Save changes" />
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Inclusions</h2>
              <p className="mt-1 text-sm text-muted">
                Structured, ordered service lines shown on the public pricing card. Save the form above first if you
                just created this version.
              </p>
            </div>
            <PricingInclusionsManager planId={id} versionId={versionId} inclusions={inclusions} />
          </Card>
        </div>
      ) : (
        <Card className="space-y-4">
          <p className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
            This version is {version.status === "published" ? "published" : "archived"} and can no longer be edited —
            the database enforces this immutability once a version leaves draft. Create a new version to change
            anything.
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Public title</dt>
              <dd className="mt-1 text-sm text-text">{version.publicTitle}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Price</dt>
              <dd className="mt-1 text-sm text-text">{formatMoney(version.amountMinorUnits, version.currency)} — one-time payment</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Effective window</dt>
              <dd className="mt-1 text-sm text-text">
                {version.effectiveFrom ? new Date(version.effectiveFrom).toLocaleString("en-IN") : "Immediately upon publishing"}
                {version.effectiveUntil ? ` – ${new Date(version.effectiveUntil).toLocaleString("en-IN")}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Tax status</dt>
              <dd className="mt-1 text-sm text-text">{version.taxStatus}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Short description</dt>
              <dd className="mt-1 text-sm text-text">{version.shortDescription || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Counselling sessions</dt>
              <dd className="mt-1 text-sm text-text">{formatComparisonCell(version.sessionCount)}{version.sessionDurationNote ? ` — ${version.sessionDurationNote}` : ""}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Recommended audience</dt>
              <dd className="mt-1 text-sm text-text">{formatComparisonCell(version.audienceLabel)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">University shortlist / application limit</dt>
              <dd className="mt-1 text-sm text-text">
                {formatComparisonCell(version.universityShortlistLimit)} / {formatComparisonCell(version.applicationSupportLimit)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">SOP rounds / mock interviews</dt>
              <dd className="mt-1 text-sm text-text">
                {formatComparisonCell(version.sopReviewRounds)} / {formatComparisonCell(version.mockInterviewCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Counsellor tier</dt>
              <dd className="mt-1 text-sm text-text">{formatComparisonCell(version.counsellorTier)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Support duration</dt>
              <dd className="mt-1 text-sm text-text">{formatComparisonCell(version.supportDurationNote)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Scholarship support</dt>
              <dd className="mt-1 text-sm text-text">{formatComparisonCell(version.scholarshipSupportNote)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Included services (legacy free-text list)</dt>
              <dd className="mt-1 text-sm text-text">
                {hasApprovedBenefits(version) ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {version.includedServices.map((item, idx) => (
                      <li key={idx}>
                        {item.label}
                        {item.description ? ` — ${item.description}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  NEUTRAL_SCOPE_FALLBACK
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Inclusions (structured list)</dt>
              <dd className="mt-1 text-sm text-text">
                {inclusions.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {inclusions
                      .filter((i) => i.isActive)
                      .map((item) => (
                        <li key={item.id}>
                          {item.title}
                          {item.isHighlight ? " ★" : ""}
                        </li>
                      ))}
                  </ul>
                ) : (
                  "No structured inclusions on this version."
                )}
              </dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  );
}
