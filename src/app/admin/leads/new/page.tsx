import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LeadForm } from "@/components/admin/leads/LeadForm";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { createLeadAction } from "../actions";

export const metadata: Metadata = { title: "New Lead" };

export default async function NewLeadPage() {
  const counsellorOptions = await listCounsellorOptions();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to leads
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Leads</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New lead</h1>
      </div>
      <LeadForm action={createLeadAction} counsellorOptions={counsellorOptions} submitLabel="Create lead" />
    </div>
  );
}
