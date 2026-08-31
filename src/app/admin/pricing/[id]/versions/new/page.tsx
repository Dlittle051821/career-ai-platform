import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PricingPlanVersionForm } from "@/components/admin/pricing/PricingPlanVersionForm";
import { getPricingPlanById } from "@/lib/supabase/admin/pricing";
import { createPricingPlanVersionAction } from "../../../actions";

interface NewPricingPlanVersionPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "New Price Version" };

export default async function NewPricingPlanVersionPage({ params }: NewPricingPlanVersionPageProps) {
  const { id } = await params;
  const detail = await getPricingPlanById(id);
  if (!detail) notFound();

  const latestVersion = detail.versions[0];
  const boundAction = createPricingPlanVersionAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/pricing/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to {detail.plan.internalName}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{detail.plan.internalName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New price version</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Saved as a new draft — it has no effect on the live public price until you publish it. Content pre-fills
          from the most recent version so you only need to change what&rsquo;s different.
        </p>
      </div>
      <PricingPlanVersionForm action={boundAction} currency={latestVersion?.currency ?? "INR"} defaultValues={latestVersion} submitLabel="Save draft version" />
    </div>
  );
}
