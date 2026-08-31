import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PricingInclusionForm } from "@/components/admin/pricing/PricingInclusionForm";
import { getPricingPlanById, getPricingInclusionById } from "@/lib/supabase/admin/pricing";
import { updatePricingInclusionAction } from "../../../../../actions";

interface EditPricingInclusionPageProps {
  params: Promise<{ id: string; versionId: string; inclusionId: string }>;
}

export const metadata: Metadata = { title: "Edit Inclusion" };

export default async function EditPricingInclusionPage({ params }: EditPricingInclusionPageProps) {
  const { id, versionId, inclusionId } = await params;
  const [detail, inclusion] = await Promise.all([getPricingPlanById(id), getPricingInclusionById(inclusionId)]);
  if (!detail || !inclusion) notFound();
  const version = detail.versions.find((v) => v.id === versionId);
  if (!version || inclusion.planVersionId !== versionId) notFound();
  if (version.status !== "draft") notFound();

  const boundAction = updatePricingInclusionAction.bind(null, id, versionId, inclusionId);

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/pricing/${id}/versions/${versionId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to version {version.versionNumber}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{detail.plan.internalName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Edit inclusion</h1>
      </div>
      <PricingInclusionForm action={boundAction} defaultValues={inclusion} submitLabel="Save changes" />
    </div>
  );
}
