import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus, ExternalLink } from "lucide-react";
import { PricingPlanForm } from "@/components/admin/pricing/PricingPlanForm";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { getPricingPlanById } from "@/lib/supabase/admin/pricing";
import { formatMoney } from "@/lib/admin/money";
import { PRICING_CATEGORY_LABELS } from "@/types/pricing";
import { updatePricingPlanAction } from "../actions";

interface PricingPlanDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Pricing Plan" };

function discountLabel(offer: { discountType: "fixed" | "percentage"; discountPercentBps: number | null; discountAmountMinorUnits: number | null; discountCurrency: string | null }): string {
  if (offer.discountType === "percentage") return `${((offer.discountPercentBps ?? 0) / 100).toFixed(2)}% off`;
  return `${formatMoney(offer.discountAmountMinorUnits ?? 0, offer.discountCurrency ?? "INR")} off`;
}

export default async function PricingPlanDetailPage({ params }: PricingPlanDetailPageProps) {
  const { id } = await params;
  const detail = await getPricingPlanById(id);
  if (!detail) notFound();
  const { plan, versions, offers } = detail;

  const boundAction = updatePricingPlanAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/pricing" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to pricing
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{PRICING_CATEGORY_LABELS[plan.category]}</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{plan.internalName}</h1>
          <p className="mt-2 text-sm text-muted">
            Slug <code className="rounded bg-surface-alt px-1.5 py-0.5">{plan.slug}</code> · Last updated {new Date(plan.updatedAt).toLocaleString("en-IN")}
          </p>
        </div>
        <LinkButton href={`/pricing#${plan.slug}`} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}>
          Preview public page
        </LinkButton>
      </div>

      <PricingPlanForm action={boundAction} defaultValues={plan} submitLabel="Save changes" />

      <div className="mt-6 space-y-6">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Price versions</h2>
              <p className="mt-1 text-sm text-muted">
                Each row is an immutable snapshot once published. Editing a live price always means publishing a new
                version — a published invoice keeps the version it was created against forever.
              </p>
            </div>
            <LinkButton href={`/admin/pricing/${id}/versions/new`} size="sm" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              New version
            </LinkButton>
          </div>

          {versions.length === 0 ? (
            <p className="text-sm text-muted">No versions yet — this plan has no price and won&rsquo;t appear on the public pricing page.</p>
          ) : (
            <AdminTable headers={["Version", "Title", "Price", "Status", "Effective", ""]}>
              {versions.map((v) => (
                <tr key={v.id} className="hover:bg-surface-alt/50">
                  <Td className="text-text-soft">
                    v{v.versionNumber}
                    {plan.currentVersionId === v.id ? (
                      <span className="ml-2">
                        <Badge tone="success">Live</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td className="font-medium text-text">{v.publicTitle}</Td>
                  <Td className="text-text-soft">{formatMoney(v.amountMinorUnits, v.currency)}</Td>
                  <Td>
                    <StatusBadge status={v.status} />
                  </Td>
                  <Td className="text-text-soft">
                    {v.effectiveFrom ? new Date(v.effectiveFrom).toLocaleDateString("en-IN") : "Immediately"}
                    {v.effectiveUntil ? ` – ${new Date(v.effectiveUntil).toLocaleDateString("en-IN")}` : ""}
                  </Td>
                  <Td>
                    <Link href={`/admin/pricing/${id}/versions/${v.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                      {v.status === "draft" ? "Edit" : "View"}
                    </Link>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Offers</h2>
              <p className="mt-1 text-sm text-muted">
                No offer is active by default. Each one is a separate opt-in discount you publish and activate
                explicitly.
              </p>
            </div>
            <LinkButton href={`/admin/pricing/${id}/offers/new`} size="sm" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              New offer
            </LinkButton>
          </div>

          {offers.length === 0 ? (
            <p className="text-sm text-muted">No offers on this plan.</p>
          ) : (
            <AdminTable headers={["Name", "Discount", "Window", "Status", "Active", ""]}>
              {offers.map((offer) => (
                <tr key={offer.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">
                    {offer.publicOfferName}
                    {offer.couponCode ? <p className="mt-0.5 text-xs text-muted">Code: {offer.couponCode}</p> : null}
                  </Td>
                  <Td className="text-text-soft">{discountLabel(offer)}</Td>
                  <Td className="text-text-soft">
                    {new Date(offer.startsAt).toLocaleDateString("en-IN")} – {new Date(offer.endsAt).toLocaleDateString("en-IN")}
                  </Td>
                  <Td>
                    <StatusBadge status={offer.status} />
                  </Td>
                  <Td>
                    <Badge tone={offer.isActive ? "success" : "neutral"}>{offer.isActive ? "Active" : "Inactive"}</Badge>
                  </Td>
                  <Td>
                    <Link href={`/admin/pricing/offers/${offer.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                      Manage
                    </Link>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}
        </Card>
      </div>
    </div>
  );
}
