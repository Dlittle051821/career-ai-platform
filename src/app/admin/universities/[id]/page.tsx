import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UniversityForm } from "@/components/admin/universities/UniversityForm";
import { getUniversityById } from "@/lib/supabase/admin/universities";
import { updateUniversityAction } from "../actions";

interface UniversityDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit University" };

export default async function UniversityDetailPage({ params }: UniversityDetailPageProps) {
  const { id } = await params;
  const university = await getUniversityById(id);
  if (!university) notFound();

  const boundAction = updateUniversityAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/universities" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to universities
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Universities</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{university.name}</h1>
        <p className="mt-2 text-sm text-muted">
          Last updated {new Date(university.updatedAt).toLocaleString("en-IN")}
        </p>
      </div>
      <UniversityForm action={boundAction} defaultValues={university} submitLabel="Save changes" />
    </div>
  );
}
