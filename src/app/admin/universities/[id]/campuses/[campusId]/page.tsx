import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CampusForm } from "@/components/admin/universities/CampusForm";
import { getCampusById } from "@/lib/supabase/admin/education-campuses";
import { listCountryOptions } from "@/lib/supabase/admin/education-countries";
import { updateCampusAction } from "../actions";

interface CampusDetailPageProps {
  params: Promise<{ id: string; campusId: string }>;
}

export const metadata: Metadata = { title: "Edit Campus" };

export default async function CampusDetailPage({ params }: CampusDetailPageProps) {
  const { id, campusId } = await params;
  const campus = await getCampusById(campusId);
  if (!campus || campus.universityId !== id) notFound();

  const countryOptions = await listCountryOptions();
  const boundAction = updateCampusAction.bind(null, id, campusId);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/universities/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to {campus.universityName ?? "university"}
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Campuses</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{campus.name}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(campus.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <CampusForm action={boundAction} universityId={id} countryOptions={countryOptions} defaultValues={campus} submitLabel="Save changes" />
    </div>
  );
}
