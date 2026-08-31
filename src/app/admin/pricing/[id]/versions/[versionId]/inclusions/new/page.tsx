import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PricingInclusionForm } from "@/components/admin/pricing/PricingInclusionForm";
import { getPricingPlanById } from "@/lib/supabase/admin/pricing";
import { createPricingInclusionAction } from "../../../../../actions";

interface NewPricingInclusionPageProps {
  params: Promise<{ id: string; versionId: string }>;
}

export const metadata: Metadata = { title: "New Inclusion" };

export default async function NewPricingInclusionPage({ params }: NewPricingInclusionPageProps) {
  const { id, versionId } = await params;
  const detail = await getPricingPlanById(id);
  if (!detail) notFound();
  const version = detail.versions.find((v) => v.id === versionId);
  if (!version) notFound();
  if (version.status !== "draft") notFound();

  const boundAction = createPricingInclusionAction.bind(null, id, versionId);

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/pricing/${id}/versions/${versionId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to version {version.versionNumber}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{detail.plan.internalName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New inclusion</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Added to the end of the list — reorder it afterward from the version page.</p>
      </div>
      <PricingInclusionForm action={boundAction} submitLabel="Add inclusion" />
    </div>
  );
}
