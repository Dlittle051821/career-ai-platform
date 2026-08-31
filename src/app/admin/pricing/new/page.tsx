import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PricingPlanForm } from "@/components/admin/pricing/PricingPlanForm";
import { createPricingPlanAction } from "../actions";

export const metadata: Metadata = { title: "New Pricing Plan" };

export default function NewPricingPlanPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/pricing" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to pricing
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Pricing</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New pricing plan</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          This creates the plan&rsquo;s catalog identity only — it has no price and won&rsquo;t appear on the public
          pricing page until you publish a version for it next.
        </p>
      </div>
      <PricingPlanForm action={createPricingPlanAction} submitLabel="Create plan" />
    </div>
  );
}
