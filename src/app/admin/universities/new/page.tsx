import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { UniversityForm } from "@/components/admin/universities/UniversityForm";
import { createUniversityAction } from "../actions";

export const metadata: Metadata = { title: "New University" };

export default function NewUniversityPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/universities" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to universities
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Universities</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New university</h1>
      </div>
      <UniversityForm action={createUniversityAction} submitLabel="Create university" />
    </div>
  );
}
