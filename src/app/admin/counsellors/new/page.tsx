import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CounsellorForm } from "@/components/admin/counsellors/CounsellorForm";
import { createCounsellorAction } from "../actions";

export const metadata: Metadata = { title: "New Counsellor" };

export default function NewCounsellorPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/counsellors" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to counsellors
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellors</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New counsellor</h1>
      </div>
      <CounsellorForm action={createCounsellorAction} submitLabel="Create counsellor" />
    </div>
  );
}
