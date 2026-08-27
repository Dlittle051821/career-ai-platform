import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { InvoiceHeaderForm } from "@/components/admin/invoices/InvoiceHeaderForm";
import { listStudentOptions } from "@/lib/supabase/admin/invoices";
import { createDraftInvoiceAction } from "../actions";

export const metadata: Metadata = { title: "New Invoice" };

export default async function NewInvoicePage() {
  const studentOptions = await listStudentOptions();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/invoices" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to invoices
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Invoices</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New invoice</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          This creates a draft. Add line items and issue it (which assigns an invoice number and freezes billing
          details) from the next screen — nothing is shown to the student until it&apos;s issued.
        </p>
      </div>
      <InvoiceHeaderForm action={createDraftInvoiceAction} studentOptions={studentOptions} submitLabel="Create draft" />
    </div>
  );
}
