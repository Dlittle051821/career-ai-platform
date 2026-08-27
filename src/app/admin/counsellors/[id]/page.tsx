import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CounsellorForm } from "@/components/admin/counsellors/CounsellorForm";
import { getCounsellorById } from "@/lib/supabase/admin/counsellors";
import { updateCounsellorAction } from "../actions";

interface CounsellorDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Counsellor" };

export default async function CounsellorDetailPage({ params }: CounsellorDetailPageProps) {
  const { id } = await params;
  const counsellor = await getCounsellorById(id);
  if (!counsellor) notFound();

  const boundAction = updateCounsellorAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/counsellors" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to counsellors
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellors</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{counsellor.displayName}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(counsellor.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <CounsellorForm action={boundAction} defaultValues={counsellor} submitLabel="Save changes" />
    </div>
  );
}
