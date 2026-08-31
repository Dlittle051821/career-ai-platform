import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ImportUploadForm } from "@/components/admin/education-imports/ImportUploadForm";
import { createImportBatchAction } from "../actions";

export const metadata: Metadata = { title: "New Import" };

export default function NewEducationImportPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/admin/education/imports" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to imports
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Data Imports</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New import</h1>
        <p className="mt-2 text-sm text-muted">
          Upload a CSV to bulk-load records. The file is parsed and validated first — you&apos;ll see a row-by-row
          preview with any errors or warnings before anything is written to the live database.
        </p>
      </div>
      <Card>
        <ImportUploadForm action={createImportBatchAction} />
      </Card>
    </div>
  );
}
