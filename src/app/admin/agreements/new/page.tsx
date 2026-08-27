import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AgreementForm } from "@/components/admin/agreements/AgreementForm";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { createAgreementAction } from "../actions";

export const metadata: Metadata = { title: "New Agreement" };

export default async function NewAgreementPage() {
  const [universityOptions, counsellorOptions] = await Promise.all([listUniversityOptions(), listCounsellorOptions()]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/agreements" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to agreements
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Agreements</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New agreement</h1>
      </div>
      <AgreementForm action={createAgreementAction} universityOptions={universityOptions} counsellorOptions={counsellorOptions} submitLabel="Create agreement" />
    </div>
  );
}
