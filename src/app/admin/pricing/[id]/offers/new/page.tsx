import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PricingOfferForm } from "@/components/admin/pricing/PricingOfferForm";
import { getPricingPlanById } from "@/lib/supabase/admin/pricing";
import { createPricingOfferAction } from "../../../actions";

interface NewPricingOfferPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "New Offer" };

export default async function NewPricingOfferPage({ params }: NewPricingOfferPageProps) {
  const { id } = await params;
  const detail = await getPricingPlanById(id);
  if (!detail) notFound();

  const currentVersion = detail.versions.find((v) => v.id === detail.plan.currentVersionId);
  const boundAction = createPricingOfferAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/pricing/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to {detail.plan.internalName}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{detail.plan.internalName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New offer</h1>
      </div>
      <PricingOfferForm action={boundAction} planCurrency={currentVersion?.currency ?? "INR"} submitLabel="Save draft offer" />
    </div>
  );
}
