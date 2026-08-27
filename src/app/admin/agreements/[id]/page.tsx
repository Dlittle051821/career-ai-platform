import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AgreementForm } from "@/components/admin/agreements/AgreementForm";
import { getAgreementById } from "@/lib/supabase/admin/agreements";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { updateAgreementAction } from "../actions";

interface AgreementDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Agreement" };

export default async function AgreementDetailPage({ params }: AgreementDetailPageProps) {
  const { id } = await params;
  const [agreement, universityOptions, counsellorOptions] = await Promise.all([getAgreementById(id), listUniversityOptions(), listCounsellorOptions()]);
  if (!agreement) notFound();

  const boundAction = updateAgreementAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/agreements" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to agreements
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Agreements</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{agreement.agreementType}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(agreement.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <AgreementForm action={boundAction} defaultValues={agreement} universityOptions={universityOptions} counsellorOptions={counsellorOptions} submitLabel="Save changes" />
    </div>
  );
}
