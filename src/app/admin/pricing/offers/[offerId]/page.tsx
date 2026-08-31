import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PricingOfferForm } from "@/components/admin/pricing/PricingOfferForm";
import { PricingOfferWorkflowCard } from "@/components/admin/pricing/PricingOfferWorkflowCard";
import { Card } from "@/components/ui/Card";
import { getPricingOfferById, getPricingPlanById } from "@/lib/supabase/admin/pricing";
import {
  updatePricingOfferAction,
  publishPricingOfferAction,
  archivePricingOfferAction,
  restorePricingOfferToDraftAction,
  setPricingOfferActiveAction,
} from "../../actions";

interface PricingOfferDetailPageProps {
  params: Promise<{ offerId: string }>;
}

export const metadata: Metadata = { title: "Offer" };

export default async function PricingOfferDetailPage({ params }: PricingOfferDetailPageProps) {
  const { offerId } = await params;
  const offer = await getPricingOfferById(offerId);
  if (!offer) notFound();
  const planDetail = await getPricingPlanById(offer.planId);
  if (!planDetail) notFound();

  const currentVersion = planDetail.versions.find((v) => v.id === planDetail.plan.currentVersionId);
  const planCurrency = currentVersion?.currency ?? offer.discountCurrency ?? "INR";

  const updateAction = updatePricingOfferAction.bind(null, offer.planId, offerId);
  const publishAction = publishPricingOfferAction.bind(null, offer.planId, offerId);
  const archiveAction = archivePricingOfferAction.bind(null, offer.planId, offerId);
  const restoreAction = restorePricingOfferToDraftAction.bind(null, offer.planId, offerId);
  const activateAction = setPricingOfferActiveAction.bind(null, offer.planId, offerId, true);
  const deactivateAction = setPricingOfferActiveAction.bind(null, offer.planId, offerId, false);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/pricing/${offer.planId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to {planDetail.plan.internalName}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{planDetail.plan.internalName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{offer.publicOfferName}</h1>
        {offer.redemptionCount > 0 ? (
          <p className="mt-2 text-sm text-muted">
            Redeemed {offer.redemptionCount} time{offer.redemptionCount === 1 ? "" : "s"}
            {offer.maxRedemptions ? ` of ${offer.maxRedemptions} allowed` : ""}.
          </p>
        ) : null}
      </div>

      <div className="mb-6">
        <PricingOfferWorkflowCard
          status={offer.status}
          isActive={offer.isActive}
          onPublish={publishAction}
          onArchive={archiveAction}
          onRestore={restoreAction}
          onActivate={activateAction}
          onDeactivate={deactivateAction}
        />
      </div>

      {offer.status === "draft" ? (
        <PricingOfferForm action={updateAction} planCurrency={planCurrency} defaultValues={offer} submitLabel="Save changes" />
      ) : (
        <Card className="space-y-4">
          <p className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
            Restore this offer to draft to edit its discount, dates, or coupon code.
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Discount</dt>
              <dd className="mt-1 text-sm text-text">
                {offer.discountType === "percentage"
                  ? `${((offer.discountPercentBps ?? 0) / 100).toFixed(2)}% off`
                  : `${offer.discountCurrency ?? planCurrency} ${((offer.discountAmountMinorUnits ?? 0) / 100).toFixed(2)} off`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Coupon code</dt>
              <dd className="mt-1 text-sm text-text">{offer.couponCode ?? "Applies automatically — no code"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Window</dt>
              <dd className="mt-1 text-sm text-text">
                {new Date(offer.startsAt).toLocaleString("en-IN")} – {new Date(offer.endsAt).toLocaleString("en-IN")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Limits</dt>
              <dd className="mt-1 text-sm text-text">
                {offer.maxRedemptions ? `${offer.maxRedemptions} total` : "Unlimited total"} ·{" "}
                {offer.perUserLimit ? `${offer.perUserLimit} per student` : "No per-student limit"}
              </dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  );
}
